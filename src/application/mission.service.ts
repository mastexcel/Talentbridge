/**
 * Marketplace des missions.
 * Processus : Brouillon → Publication → Réception des candidatures → Présélection → Entretiens
 * → Sélection → Contractualisation → Exécution → Clôture (cf. domain/workflows).
 */
import type { Prisma } from "@prisma/client";
import { prisma, inTransaction, type Db } from "@/infrastructure/db";
import { DomainError } from "@/domain/errors";
import { toMinor } from "@/domain/money";
import { formatReference } from "@/domain/text";
import { applicationFlow, missionFlow, MISSION_OPEN_STATUSES, MISSION_STATUS_LABELS, APPLICATION_STATUS_LABELS, type ApplicationStatus, type MissionStatus } from "@/domain/workflows";
import type { MissionInput } from "./schemas";
import type { SessionUser } from "./auth.service";
import { requireOrgPermission, requireExpert } from "./access";
import { audit } from "./audit.service";
import { notify } from "./notification.service";

export const MISSION_PAGE_SIZE = 10;

async function nextMissionReference(db: Db) {
  const year = new Date().getUTCFullYear();
  const count = await db.mission.count({ where: { reference: { startsWith: `TB-M-${year}-` } } });
  return formatReference("M", year, count + 1);
}

function missionData(input: MissionInput) {
  return {
    title: input.title,
    description: input.description,
    objectives: input.objectives,
    expectedResults: input.expectedResults,
    domainId: input.domainId,
    experienceYearsMin: input.experienceYearsMin,
    languages: input.languages,
    countryCode: input.countryCode,
    city: input.city,
    workMode: input.workMode,
    durationDays: input.durationDays ?? null,
    startDate: input.startDate,
    budgetMinMinor: input.budgetMin != null ? toMinor(input.budgetMin, input.currency) : null,
    budgetMaxMinor: input.budgetMax != null ? toMinor(input.budgetMax, input.currency) : null,
    currency: input.currency,
    applicationDeadline: input.applicationDeadline,
    visibility: input.visibility,
  };
}

export async function createMission(user: SessionUser, organizationId: string, input: MissionInput, db: Db = prisma) {
  requireOrgPermission(user, organizationId, "missions.manage");
  return inTransaction(db, async (tx) => {
    const mission = await tx.mission.create({
      data: {
        ...missionData(input),
        reference: await nextMissionReference(tx),
        organizationId,
        createdById: user.id,
        requirements: { create: input.requirements.map((r) => ({ skillId: r.skillId, mandatory: r.mandatory, minLevel: r.minLevel })) },
      },
    });
    await audit({ actorId: user.id, organizationId, action: "mission.create", entityType: "Mission", entityId: mission.id }, tx);
    return mission;
  });
}

async function loadOwnedMission(user: SessionUser, missionId: string, permission: "missions.manage" | "applications.review" | "org.view", db: Db) {
  const mission = await db.mission.findUnique({ where: { id: missionId } });
  if (!mission) throw new DomainError("NOT_FOUND", "Mission introuvable.");
  requireOrgPermission(user, mission.organizationId, permission);
  return mission;
}

export async function updateMission(user: SessionUser, missionId: string, input: MissionInput, db: Db = prisma) {
  const mission = await loadOwnedMission(user, missionId, "missions.manage", db);
  if (!["DRAFT", "PUBLISHED"].includes(mission.status)) throw new DomainError("INVALID_STATE", "La mission ne peut plus être modifiée à ce stade.");
  await inTransaction(db, async (tx) => {
    await tx.mission.update({ where: { id: missionId }, data: missionData(input) });
    await tx.missionRequirement.deleteMany({ where: { missionId } });
    await tx.missionRequirement.createMany({ data: input.requirements.map((r) => ({ missionId, ...r })) });
    await audit({ actorId: user.id, organizationId: mission.organizationId, action: "mission.update", entityType: "Mission", entityId: missionId }, tx);
  });
}

export async function changeMissionStatus(user: SessionUser, missionId: string, to: MissionStatus, note: string | null = null, db: Db = prisma) {
  const mission = await loadOwnedMission(user, missionId, "missions.manage", db);
  missionFlow.assert(mission.status, to);
  if (to === "PUBLISHED" && mission.status === "DRAFT") {
    const reqs = await db.missionRequirement.count({ where: { missionId } });
    if (reqs === 0) throw new DomainError("VALIDATION", "Ajoutez au moins une compétence requise avant publication.");
    const org = await db.organization.findUniqueOrThrow({ where: { id: mission.organizationId }, select: { status: true } });
    if (org.status === "SUSPENDED" || org.status === "REJECTED") throw new DomainError("FORBIDDEN", "Votre organisation ne peut pas publier de mission (statut : non validée).");
  }
  await inTransaction(db, async (tx) => {
    await tx.mission.update({
      where: { id: missionId },
      data: {
        status: to,
        ...(to === "PUBLISHED" && !mission.publishedAt ? { publishedAt: new Date() } : {}),
        ...(to === "CLOSED" || to === "CANCELLED" ? { closedAt: new Date() } : {}),
      },
    });
    await tx.missionEvent.create({ data: { missionId, actorId: user.id, fromStatus: mission.status, toStatus: to, note } });
    await audit({ actorId: user.id, organizationId: mission.organizationId, action: "mission.status", entityType: "Mission", entityId: missionId, metadata: { from: mission.status, to } }, tx);
    if (to === "CANCELLED") {
      const apps = await tx.application.findMany({ where: { missionId, status: { notIn: ["REJECTED", "WITHDRAWN"] } }, include: { expert: { select: { userId: true } } } });
      for (const a of apps) await notify({ userId: a.expert.userId, type: "APPLICATION", title: "Mission annulée", body: `La mission « ${mission.title} » a été annulée par l'organisation.`, link: "/espace/candidatures" }, tx);
    }
  });
}

export async function listOrgMissions(user: SessionUser, organizationId: string, filter: { status?: MissionStatus; page?: number } = {}, db: Db = prisma) {
  requireOrgPermission(user, organizationId, "org.view");
  const where: Prisma.MissionWhereInput = { organizationId, ...(filter.status ? { status: filter.status } : {}) };
  const [items, total] = await Promise.all([
    db.mission.findMany({ where, orderBy: { updatedAt: "desc" }, take: 20, skip: ((filter.page ?? 1) - 1) * 20, include: { _count: { select: { applications: true } }, domain: { select: { nameFr: true } } } }),
    db.mission.count({ where }),
  ]);
  return { items, total, pageSize: 20 };
}

export async function getOrgMission(user: SessionUser, missionId: string, db: Db = prisma) {
  await loadOwnedMission(user, missionId, "org.view", db);
  return db.mission.findUniqueOrThrow({
    where: { id: missionId },
    include: {
      requirements: { include: { skill: true } },
      domain: true,
      attachments: true,
      events: { orderBy: { createdAt: "asc" } },
      organization: { select: { name: true } },
      _count: { select: { applications: true, matchScores: true } },
    },
  });
}

// ── Côté public / candidat ───────────────────────────────────

function publicVisibility(user: SessionUser | null): Prisma.MissionWhereInput {
  return { status: { in: [...MISSION_OPEN_STATUSES] }, visibility: user ? { in: ["PUBLIC", "MEMBERS"] } : "PUBLIC" };
}

export async function searchMissions(user: SessionUser | null, f: { q?: string; country?: string; domain?: string; workMode?: "ONSITE" | "REMOTE" | "HYBRID"; page: number }, db: Db = prisma) {
  const where: Prisma.MissionWhereInput = {
    AND: [
      publicVisibility(user),
      { OR: [{ applicationDeadline: null }, { applicationDeadline: { gte: new Date() } }] },
      f.q ? { OR: [{ title: { contains: f.q, mode: "insensitive" } }, { description: { contains: f.q, mode: "insensitive" } }, { requirements: { some: { skill: { nameFr: { contains: f.q, mode: "insensitive" } } } } }] } : {},
      f.country ? { countryCode: f.country } : {},
      f.domain ? { domain: { slug: f.domain } } : {},
      f.workMode ? { workMode: f.workMode } : {},
    ],
  };
  const [items, total] = await Promise.all([
    db.mission.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      take: MISSION_PAGE_SIZE,
      skip: (f.page - 1) * MISSION_PAGE_SIZE,
      include: { organization: { select: { name: true, type: true, status: true } }, domain: { select: { nameFr: true } }, requirements: { include: { skill: { select: { nameFr: true } } } }, _count: { select: { applications: true } } },
    }),
    db.mission.count({ where }),
  ]);
  return { items, total, page: f.page, pages: Math.max(1, Math.ceil(total / MISSION_PAGE_SIZE)) };
}

export async function getPublicMission(user: SessionUser | null, reference: string, db: Db = prisma) {
  const m = await db.mission.findUnique({
    where: { reference },
    include: { organization: { select: { id: true, name: true, type: true, status: true, countryCode: true } }, domain: true, requirements: { include: { skill: true } }, attachments: true },
  });
  if (!m) return null;
  const isOwner = !!user?.memberships.some((x) => x.organizationId === m.organizationId);
  const invited = user?.expertProfile ? await db.missionInvitation.findUnique({ where: { missionId_expertId: { missionId: m.id, expertId: user.expertProfile.id } } }) : null;
  const visible = isOwner || invited || ((MISSION_OPEN_STATUSES as readonly string[]).includes(m.status) && (m.visibility === "PUBLIC" || (m.visibility === "MEMBERS" && !!user)));
  if (!visible) return null;
  const application = user?.expertProfile ? await db.application.findUnique({ where: { missionId_expertId: { missionId: m.id, expertId: user.expertProfile.id } }, select: { id: true, status: true } }) : null;
  const saved = user ? !!(await db.savedMission.findUnique({ where: { userId_missionId: { userId: user.id, missionId: m.id } } })) : false;
  return { mission: m, isOwner, application, saved, invited: !!invited };
}

export async function toggleSaveMission(userId: string, missionId: string, db: Db = prisma) {
  const key = { userId_missionId: { userId, missionId } };
  if (await db.savedMission.findUnique({ where: key })) {
    await db.savedMission.delete({ where: key });
    return { saved: false };
  }
  await db.savedMission.create({ data: { userId, missionId } });
  return { saved: true };
}

export async function apply(
  user: SessionUser,
  missionId: string,
  input: { coverLetter: string; proposedRate?: number | null; currency?: string | null; availableFrom: Date | null; technicalFileId: string | null; financialFileId: string | null },
  db: Db = prisma,
) {
  const { expertId } = requireExpert(user);
  const mission = await db.mission.findUnique({ where: { id: missionId } });
  if (!mission) throw new DomainError("NOT_FOUND", "Mission introuvable.");
  if (!(MISSION_OPEN_STATUSES as readonly string[]).includes(mission.status)) throw new DomainError("INVALID_STATE", "Cette mission n'accepte plus de candidatures.");
  if (mission.applicationDeadline && mission.applicationDeadline < new Date()) throw new DomainError("INVALID_STATE", "La date limite de candidature est dépassée.");
  if (mission.visibility === "INVITE_ONLY" && !(await db.missionInvitation.findUnique({ where: { missionId_expertId: { missionId, expertId } } }))) {
    throw new DomainError("FORBIDDEN", "Cette mission est réservée aux experts invités.");
  }
  if (user.memberships.some((m) => m.organizationId === mission.organizationId)) throw new DomainError("FORBIDDEN", "Vous ne pouvez pas candidater à une mission de votre propre organisation.");
  for (const fid of [input.technicalFileId, input.financialFileId].filter(Boolean) as string[]) {
    const f = await db.storedFile.findUnique({ where: { id: fid } });
    if (!f || f.ownerUserId !== user.id || f.purpose !== "PROPOSAL") throw new DomainError("VALIDATION", "Document de proposition invalide.");
  }
  if (await db.application.findUnique({ where: { missionId_expertId: { missionId, expertId } } })) throw new DomainError("CONFLICT", "Vous avez déjà candidaté à cette mission.");
  const currency = input.currency ?? mission.currency;
  const app = await inTransaction(db, async (tx) => {
    const created = await tx.application.create({
      data: {
        missionId,
        expertId,
        coverLetter: input.coverLetter,
        proposedRateMinor: input.proposedRate != null ? toMinor(input.proposedRate, currency) : null,
        currency,
        availableFrom: input.availableFrom,
        technicalFileId: input.technicalFileId,
        financialFileId: input.financialFileId,
      },
    });
    await tx.missionInvitation.updateMany({ where: { missionId, expertId, status: "SENT" }, data: { status: "ACCEPTED", respondedAt: new Date() } });
    await audit({ actorId: user.id, organizationId: mission.organizationId, action: "application.create", entityType: "Application", entityId: created.id }, tx);
    const reviewers = await tx.organizationMember.findMany({ where: { organizationId: mission.organizationId, role: { in: ["OWNER", "ADMIN", "RECRUITER"] } } });
    for (const r of reviewers) {
      await notify({ userId: r.userId, type: "APPLICATION", title: "Nouvelle candidature", body: `${user.firstName} ${user.lastName} a candidaté à « ${mission.title} ».`, link: `/organisation/missions/${missionId}` }, tx);
    }
    return created;
  });
  return app;
}

export async function withdraw(user: SessionUser, applicationId: string, db: Db = prisma) {
  const { expertId } = requireExpert(user);
  const app = await db.application.findFirst({ where: { id: applicationId, expertId } });
  if (!app) throw new DomainError("NOT_FOUND", "Candidature introuvable.");
  applicationFlow.assert(app.status, "WITHDRAWN");
  await inTransaction(db, async (tx) => {
    await tx.application.update({ where: { id: app.id }, data: { status: "WITHDRAWN" } });
    await tx.applicationEvent.create({ data: { applicationId: app.id, actorId: user.id, fromStatus: app.status, toStatus: "WITHDRAWN" } });
  });
}

export async function myApplications(expertId: string, db: Db = prisma) {
  return db.application.findMany({
    where: { expertId },
    orderBy: { updatedAt: "desc" },
    include: { mission: { select: { id: true, reference: true, title: true, status: true, countryCode: true, organization: { select: { name: true } } } }, interviews: { orderBy: { scheduledAt: "asc" } }, events: { orderBy: { createdAt: "asc" } } },
  });
}

// ── Côté recruteur ───────────────────────────────────────────

export async function listApplications(user: SessionUser, missionId: string, db: Db = prisma) {
  await loadOwnedMission(user, missionId, "applications.review", db);
  return db.application.findMany({
    where: { missionId },
    orderBy: { createdAt: "asc" },
    include: {
      expert: {
        select: {
          id: true, slug: true, headline: true, countryCode: true, yearsExperience: true, cvFileId: true, averageRating: true, availability: true,
          user: { select: { id: true, firstName: true, lastName: true } },
          badges: { where: { revokedAt: null }, select: { badge: { select: { code: true, nameFr: true } } } },
        },
      },
      interviews: { orderBy: { scheduledAt: "asc" } },
    },
  });
}

export async function decideApplication(user: SessionUser, applicationId: string, to: Exclude<ApplicationStatus, "WITHDRAWN" | "CONTRACTED" | "SUBMITTED">, note: string | null, db: Db = prisma) {
  const app = await db.application.findUnique({ where: { id: applicationId }, include: { mission: true, expert: { select: { userId: true } } } });
  if (!app) throw new DomainError("NOT_FOUND", "Candidature introuvable.");
  requireOrgPermission(user, app.mission.organizationId, "applications.review");
  applicationFlow.assert(app.status, to);
  await inTransaction(db, async (tx) => {
    await tx.application.update({ where: { id: app.id }, data: { status: to, ...(note ? { recruiterNote: note } : {}) } });
    await tx.applicationEvent.create({ data: { applicationId: app.id, actorId: user.id, fromStatus: app.status, toStatus: to, note } });
    // La mission avance automatiquement à l'étape correspondante si elle est en retard sur la décision.
    const autoAdvance: Partial<Record<typeof to, MissionStatus>> = { SHORTLISTED: "SHORTLISTING", INTERVIEW: "INTERVIEWS", SELECTED: "SELECTION" };
    const target = autoAdvance[to];
    if (target && missionFlow.can(app.mission.status, target)) {
      await tx.mission.update({ where: { id: app.missionId }, data: { status: target } });
      await tx.missionEvent.create({ data: { missionId: app.missionId, actorId: user.id, fromStatus: app.mission.status, toStatus: target, note: "Avancement automatique suite à une décision sur candidature" } });
    }
    await audit({ actorId: user.id, organizationId: app.mission.organizationId, action: "application.decision", entityType: "Application", entityId: app.id, metadata: { from: app.status, to } }, tx);
    await notify({ userId: app.expert.userId, type: "APPLICATION", title: `Candidature : ${APPLICATION_STATUS_LABELS[to]}`, body: `Mission « ${app.mission.title} » : votre candidature est désormais « ${APPLICATION_STATUS_LABELS[to]} ».`, link: "/espace/candidatures" }, tx);
  });
}

export async function scheduleInterview(user: SessionUser, applicationId: string, input: { scheduledAt: Date; durationMin: number; mode: string; location: string | null; notes: string | null }, db: Db = prisma) {
  const app = await db.application.findUnique({ where: { id: applicationId }, include: { mission: true, expert: { select: { userId: true } } } });
  if (!app) throw new DomainError("NOT_FOUND", "Candidature introuvable.");
  requireOrgPermission(user, app.mission.organizationId, "applications.review");
  if (!["SHORTLISTED", "INTERVIEW"].includes(app.status)) throw new DomainError("INVALID_STATE", "Présélectionnez la candidature avant de planifier un entretien.");
  const interview = await db.interview.create({ data: { applicationId, ...input, createdById: user.id } });
  if (app.status === "SHORTLISTED") await decideApplication(user, applicationId, "INTERVIEW", null, db);
  await notify({ userId: app.expert.userId, type: "APPLICATION", title: "Entretien planifié", body: `Entretien pour « ${app.mission.title} » le ${input.scheduledAt.toLocaleString("fr-FR", { timeZone: "UTC" })} UTC (${input.mode}).`, link: "/espace/candidatures" }, db);
  return interview;
}

export async function inviteExpert(user: SessionUser, missionId: string, expertId: string, message: string | null, db: Db = prisma) {
  const mission = await loadOwnedMission(user, missionId, "missions.manage", db);
  if (["CLOSED", "CANCELLED", "IN_PROGRESS"].includes(mission.status)) throw new DomainError("INVALID_STATE", "Mission non ouverte.");
  const expert = await db.expertProfile.findUniqueOrThrow({ where: { id: expertId }, select: { userId: true } });
  const inv = await db.missionInvitation.upsert({
    where: { missionId_expertId: { missionId, expertId } },
    create: { missionId, expertId, invitedById: user.id, message },
    update: { message, status: "SENT" },
  });
  await notify({ userId: expert.userId, type: "INVITATION", title: "Invitation à une mission", body: `Vous êtes invité(e) à candidater à « ${mission.title} ».`, link: `/missions/${mission.reference}` }, db);
  await audit({ actorId: user.id, organizationId: mission.organizationId, action: "mission.invite", entityType: "MissionInvitation", entityId: inv.id }, db);
  return inv;
}

export async function myInvitations(expertId: string, db: Db = prisma) {
  return db.missionInvitation.findMany({ where: { expertId }, orderBy: { createdAt: "desc" }, include: { mission: { select: { reference: true, title: true, status: true, organization: { select: { name: true } } } } } });
}

export async function respondInvitation(user: SessionUser, invitationId: string, accept: boolean, db: Db = prisma) {
  const { expertId } = requireExpert(user);
  const res = await db.missionInvitation.updateMany({ where: { id: invitationId, expertId, status: "SENT" }, data: { status: accept ? "ACCEPTED" : "DECLINED", respondedAt: new Date() } });
  if (res.count === 0) throw new DomainError("NOT_FOUND", "Invitation introuvable.");
}

// ── Shortlists ───────────────────────────────────────────────

export async function addToShortlist(user: SessionUser, organizationId: string, input: { shortlistId?: string; name?: string; missionId?: string | null; expertId: string; note?: string | null }, db: Db = prisma) {
  requireOrgPermission(user, organizationId, "shortlists.manage");
  let shortlistId = input.shortlistId;
  if (shortlistId) {
    const s = await db.shortlist.findFirst({ where: { id: shortlistId, organizationId } });
    if (!s) throw new DomainError("NOT_FOUND", "Shortlist introuvable.");
  } else {
    if (input.missionId) await loadOwnedMission(user, input.missionId, "org.view", db);
    const s = await db.shortlist.create({ data: { organizationId, name: input.name ?? "Nouvelle shortlist", missionId: input.missionId ?? null, createdById: user.id } });
    shortlistId = s.id;
  }
  await db.shortlistEntry.upsert({ where: { shortlistId_expertId: { shortlistId, expertId: input.expertId } }, create: { shortlistId, expertId: input.expertId, note: input.note ?? null }, update: { note: input.note ?? null } });
  return { shortlistId };
}

export async function listShortlists(user: SessionUser, organizationId: string, db: Db = prisma) {
  requireOrgPermission(user, organizationId, "org.view");
  return db.shortlist.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    include: { mission: { select: { title: true, reference: true } }, entries: { include: { expert: { select: { id: true, slug: true, headline: true, user: { select: { firstName: true, lastName: true } } } } } } },
  });
}

export async function removeFromShortlist(user: SessionUser, organizationId: string, shortlistId: string, expertId: string, db: Db = prisma) {
  requireOrgPermission(user, organizationId, "shortlists.manage");
  const s = await db.shortlist.findFirst({ where: { id: shortlistId, organizationId } });
  if (!s) throw new DomainError("NOT_FOUND", "Shortlist introuvable.");
  await db.shortlistEntry.deleteMany({ where: { shortlistId, expertId } });
}

export { MISSION_STATUS_LABELS };
