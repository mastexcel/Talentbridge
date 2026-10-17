/**
 * Contractualisation, équipes projet, tâches/livrables (Kanban + chronologie) et évaluations.
 * Accès à un projet : membres du projet, ou gestionnaires de l'organisation (projects.manage).
 * Un consultant ne voit que les projets dont il est membre.
 */
import { prisma, inTransaction, type Db } from "@/infrastructure/db";
import { DomainError } from "@/domain/errors";
import { formatReference } from "@/domain/text";
import { contractFlow, missionFlow, type ContractStatus } from "@/domain/workflows";
import type { SessionUser } from "./auth.service";
import { requireOrgPermission, roleIn } from "./access";
import { orgRoleCan } from "@/domain/permissions";
import { audit } from "./audit.service";
import { notify } from "./notification.service";
import { getSetting } from "./settings.service";

// ── Contrats ─────────────────────────────────────────────────

export async function createContractFromApplication(user: SessionUser, applicationId: string, input: { amountMinor: number; startDate: Date | null; endDate: Date | null; terms: string | null }, db: Db = prisma) {
  const app = await db.application.findUnique({ where: { id: applicationId }, include: { mission: true, expert: { select: { userId: true } }, contract: true } });
  if (!app) throw new DomainError("NOT_FOUND", "Candidature introuvable.");
  requireOrgPermission(user, app.mission.organizationId, "contracts.manage");
  if (app.status !== "SELECTED") throw new DomainError("INVALID_STATE", "Seule une candidature retenue peut être contractualisée.");
  if (app.contract) throw new DomainError("CONFLICT", "Un contrat existe déjà pour cette candidature.");
  if (input.amountMinor <= 0) throw new DomainError("VALIDATION", "Montant du contrat invalide.");
  const commissionBps = await getSetting("commission.defaultBps", db);
  return inTransaction(db, async (tx) => {
    const year = new Date().getUTCFullYear();
    const count = await tx.contract.count({ where: { reference: { startsWith: `TB-C-${year}-` } } });
    const contract = await tx.contract.create({
      data: {
        reference: formatReference("C", year, count + 1),
        organizationId: app.mission.organizationId,
        missionId: app.missionId,
        expertId: app.expertId,
        applicationId: app.id,
        amountMinor: input.amountMinor,
        currency: app.mission.currency,
        commissionBps,
        startDate: input.startDate,
        endDate: input.endDate,
        terms: input.terms,
      },
    });
    if (missionFlow.can(app.mission.status, "CONTRACTING")) {
      await tx.mission.update({ where: { id: app.missionId }, data: { status: "CONTRACTING" } });
      await tx.missionEvent.create({ data: { missionId: app.missionId, actorId: user.id, fromStatus: app.mission.status, toStatus: "CONTRACTING", note: `Contrat ${contract.reference}` } });
    }
    await audit({ actorId: user.id, organizationId: app.mission.organizationId, action: "contract.create", entityType: "Contract", entityId: contract.id }, tx);
    return contract;
  });
}

export async function transitionContract(user: SessionUser, contractId: string, to: ContractStatus, db: Db = prisma) {
  const c = await db.contract.findUnique({ where: { id: contractId }, include: { expert: { select: { userId: true } }, mission: true } });
  if (!c) throw new DomainError("NOT_FOUND", "Contrat introuvable.");
  const isExpert = c.expert.userId === user.id;
  // L'expert signe ; l'organisation gère toutes les autres transitions.
  if (to === "SIGNED") {
    if (!isExpert) throw new DomainError("FORBIDDEN", "Seul l'expert concerné peut signer le contrat.");
  } else {
    requireOrgPermission(user, c.organizationId, "contracts.manage");
  }
  contractFlow.assert(c.status, to);
  await inTransaction(db, async (tx) => {
    await tx.contract.update({
      where: { id: contractId },
      data: { status: to, ...(to === "SIGNED" ? { signedAt: new Date() } : {}), ...(to === "COMPLETED" ? { completedAt: new Date() } : {}) },
    });
    if (to === "SENT") await notify({ userId: c.expert.userId, type: "APPLICATION", title: "Contrat à signer", body: `Le contrat ${c.reference} (« ${c.mission.title} ») vous attend.`, link: "/espace/contrats" }, tx);
    if (to === "ACTIVE") {
      await tx.application.updateMany({ where: { id: c.applicationId ?? "", status: "SELECTED" }, data: { status: "CONTRACTED" } });
      if (missionFlow.can(c.mission.status, "IN_PROGRESS")) {
        await tx.mission.update({ where: { id: c.missionId }, data: { status: "IN_PROGRESS" } });
        await tx.missionEvent.create({ data: { missionId: c.missionId, actorId: user.id, fromStatus: c.mission.status, toStatus: "IN_PROGRESS" } });
      }
    }
    if (to === "COMPLETED") {
      await tx.expertProfile.update({ where: { id: c.expertId }, data: { completedMissions: { increment: 1 } } });
      // Commission plateforme due sur le contrat (facturée par la finance).
      if (c.commissionBps > 0) {
        await tx.commission.create({ data: { contractId: c.id, rateBps: c.commissionBps, baseMinor: c.amountMinor, amountMinor: Math.round((c.amountMinor * c.commissionBps) / 10_000), currency: c.currency } });
      }
    }
    await audit({ actorId: user.id, organizationId: c.organizationId, action: "contract.status", entityType: "Contract", entityId: c.id, metadata: { from: c.status, to } }, tx);
  });
}

export async function listOrgContracts(user: SessionUser, organizationId: string, db: Db = prisma) {
  requireOrgPermission(user, organizationId, "org.view");
  return db.contract.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, include: { mission: { select: { title: true, reference: true } }, expert: { select: { slug: true, user: { select: { firstName: true, lastName: true } } } }, reviews: { select: { id: true } } } });
}

export async function listExpertContracts(expertId: string, db: Db = prisma) {
  return db.contract.findMany({ where: { expertId }, orderBy: { createdAt: "desc" }, include: { mission: { select: { title: true, reference: true } }, organization: { select: { name: true } } } });
}

/** Évaluation finale : uniquement sur contrat terminé, par un membre de l'organisation cliente. */
export async function reviewContract(user: SessionUser, contractId: string, rating: number, comment: string | null, db: Db = prisma) {
  const c = await db.contract.findUnique({ where: { id: contractId } });
  if (!c) throw new DomainError("NOT_FOUND", "Contrat introuvable.");
  requireOrgPermission(user, c.organizationId, "contracts.manage");
  if (c.status !== "COMPLETED") throw new DomainError("INVALID_STATE", "L'évaluation n'est possible qu'une fois le contrat terminé.");
  if (rating < 1 || rating > 5) throw new DomainError("VALIDATION", "Note de 1 à 5.");
  await inTransaction(db, async (tx) => {
    await tx.review.create({ data: { contractId, organizationId: c.organizationId, expertId: c.expertId, authorId: user.id, rating, comment } });
    const agg = await tx.review.aggregate({ where: { expertId: c.expertId }, _avg: { rating: true }, _count: true });
    await tx.expertProfile.update({ where: { id: c.expertId }, data: { averageRating: agg._avg.rating, ratingsCount: agg._count } });
    await audit({ actorId: user.id, organizationId: c.organizationId, action: "review.create", entityType: "Contract", entityId: contractId, metadata: { rating } }, tx);
  });
}

// ── Projets / équipes ────────────────────────────────────────

async function projectAccess(user: SessionUser, projectId: string, db: Db) {
  const project = await db.project.findUnique({ where: { id: projectId }, include: { members: true } });
  if (!project) throw new DomainError("NOT_FOUND", "Projet introuvable.");
  const member = project.members.find((m) => m.userId === user.id) ?? null;
  const manager = orgRoleCan(roleIn(user, project.organizationId), "projects.manage");
  if (!member && !manager) throw new DomainError("FORBIDDEN", "Vous n'êtes pas membre de ce projet.");
  return { project, member, canManage: manager || member?.role === "LEAD" };
}

export async function createProject(user: SessionUser, organizationId: string, input: { name: string; description: string | null; missionId: string | null; startDate: Date | null; endDate: Date | null }, db: Db = prisma) {
  requireOrgPermission(user, organizationId, "projects.manage");
  if (input.missionId) {
    const m = await db.mission.findFirst({ where: { id: input.missionId, organizationId } });
    if (!m) throw new DomainError("NOT_FOUND", "Mission introuvable dans votre organisation.");
  }
  const project = await db.project.create({ data: { organizationId, ...input, members: { create: { userId: user.id, role: "CLIENT_REVIEWER" } } } });
  await audit({ actorId: user.id, organizationId, action: "project.create", entityType: "Project", entityId: project.id }, db);
  return project;
}

export async function listProjects(user: SessionUser, db: Db = prisma) {
  const managedOrgs = user.memberships.filter((m) => orgRoleCan(m.role as never, "projects.manage")).map((m) => m.organizationId);
  return db.project.findMany({
    where: { OR: [{ members: { some: { userId: user.id } } }, { organizationId: { in: managedOrgs } }] },
    orderBy: { updatedAt: "desc" },
    include: { organization: { select: { name: true } }, _count: { select: { tasks: true, members: true } }, tasks: { select: { status: true } } },
  });
}

export async function getProject(user: SessionUser, projectId: string, db: Db = prisma) {
  const { canManage } = await projectAccess(user, projectId, db);
  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      organization: { select: { id: true, name: true } },
      mission: { select: { title: true, reference: true } },
      members: { include: { user: { select: { id: true, firstName: true, lastName: true, expertProfile: { select: { slug: true, headline: true } } } } } },
      tasks: { orderBy: [{ status: "asc" }, { position: "asc" }], include: { assignee: { select: { firstName: true, lastName: true } }, comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { firstName: true, lastName: true } } } } } },
    },
  });
  return { project, canManage };
}

export async function addProjectMember(user: SessionUser, projectId: string, input: { expertId?: string; userId?: string; role: "LEAD" | "CONSULTANT" | "CLIENT_REVIEWER" | "OBSERVER"; responsibilities: string | null }, db: Db = prisma) {
  const { project, canManage } = await projectAccess(user, projectId, db);
  if (!canManage) throw new DomainError("FORBIDDEN", "Seuls le chef de mission et les gestionnaires peuvent composer l'équipe.");
  let userId = input.userId;
  if (input.expertId) {
    // Un consultant n'est ajouté que s'il est sous contrat avec l'organisation (ou retenu sur la mission).
    const expert = await db.expertProfile.findUniqueOrThrow({ where: { id: input.expertId }, select: { userId: true } });
    const linked = await db.contract.findFirst({ where: { expertId: input.expertId, organizationId: project.organizationId, status: { in: ["SIGNED", "ACTIVE", "SENT", "DRAFT"] } } })
      ?? await db.application.findFirst({ where: { expertId: input.expertId, mission: { organizationId: project.organizationId }, status: { in: ["SELECTED", "CONTRACTED"] } } });
    if (!linked) throw new DomainError("INVALID_STATE", "Ce consultant doit d'abord être retenu ou contractualisé par votre organisation.");
    userId = expert.userId;
  } else if (userId && !(await db.organizationMember.findFirst({ where: { organizationId: project.organizationId, userId } }))) {
    throw new DomainError("FORBIDDEN", "Ce collaborateur n'appartient pas à l'organisation.");
  }
  if (!userId) throw new DomainError("VALIDATION", "Membre requis.");
  if (input.role === "LEAD") await db.projectMember.updateMany({ where: { projectId, role: "LEAD" }, data: { role: "CONSULTANT" } });
  await db.projectMember.upsert({ where: { projectId_userId: { projectId, userId } }, create: { projectId, userId, role: input.role, responsibilities: input.responsibilities }, update: { role: input.role, responsibilities: input.responsibilities } });
  await notify({ userId, type: "INVITATION", title: "Ajout à une équipe projet", body: `Vous avez été ajouté(e) au projet « ${project.name} ».`, link: `/projets/${projectId}` }, db);
  await audit({ actorId: user.id, organizationId: project.organizationId, action: "project.member", entityType: "Project", entityId: projectId, metadata: { userId, role: input.role } }, db);
}

export async function createTask(user: SessionUser, projectId: string, input: { title: string; description: string | null; assigneeId: string | null; startDate: Date | null; dueDate: Date | null; isDeliverable: boolean }, db: Db = prisma) {
  const { project, canManage } = await projectAccess(user, projectId, db);
  if (!canManage) throw new DomainError("FORBIDDEN", "Seuls le chef de mission et les gestionnaires créent les tâches.");
  if (input.assigneeId && !project.members.some((m) => m.userId === input.assigneeId)) throw new DomainError("VALIDATION", "La personne assignée doit être membre du projet.");
  const position = await db.projectTask.count({ where: { projectId } });
  return db.projectTask.create({
    data: { projectId, title: input.title, description: input.description, assigneeId: input.assigneeId, startDate: input.startDate, dueDate: input.dueDate, deliverableStatus: input.isDeliverable ? "PENDING" : "NOT_DELIVERABLE", position },
  });
}

export async function moveTask(user: SessionUser, taskId: string, status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE", db: Db = prisma) {
  const task = await db.projectTask.findUnique({ where: { id: taskId } });
  if (!task) throw new DomainError("NOT_FOUND", "Tâche introuvable.");
  const { canManage } = await projectAccess(user, task.projectId, db);
  if (!canManage && task.assigneeId !== user.id) throw new DomainError("FORBIDDEN", "Vous ne pouvez déplacer que vos propres tâches.");
  // Un livrable n'est « terminé » qu'après validation.
  if (status === "DONE" && task.deliverableStatus !== "NOT_DELIVERABLE" && task.deliverableStatus !== "APPROVED") throw new DomainError("INVALID_STATE", "Ce livrable doit être validé avant d'être marqué terminé.");
  return db.projectTask.update({ where: { id: taskId }, data: { status } });
}

export async function submitDeliverable(user: SessionUser, taskId: string, fileId: string, db: Db = prisma) {
  const task = await db.projectTask.findUnique({ where: { id: taskId }, include: { project: { include: { members: true } } } });
  if (!task) throw new DomainError("NOT_FOUND", "Tâche introuvable.");
  await projectAccess(user, task.projectId, db);
  if (task.deliverableStatus === "NOT_DELIVERABLE") throw new DomainError("INVALID_STATE", "Cette tâche n'est pas un livrable.");
  const f = await db.storedFile.findUnique({ where: { id: fileId } });
  if (!f || f.ownerUserId !== user.id || f.purpose !== "DELIVERABLE") throw new DomainError("VALIDATION", "Fichier de livrable invalide.");
  await db.projectTask.update({ where: { id: taskId }, data: { fileId, deliverableStatus: "SUBMITTED", status: "REVIEW" } });
  for (const m of task.project.members.filter((x) => x.role === "CLIENT_REVIEWER" || x.role === "LEAD")) {
    if (m.userId !== user.id) await notify({ userId: m.userId, type: "DEADLINE", title: "Livrable à valider", body: `« ${task.title} » a été déposé.`, link: `/projets/${task.projectId}` }, db);
  }
}

export async function reviewDeliverable(user: SessionUser, taskId: string, approve: boolean, comment: string | null, db: Db = prisma) {
  const task = await db.projectTask.findUnique({ where: { id: taskId }, include: { project: true } });
  if (!task) throw new DomainError("NOT_FOUND", "Tâche introuvable.");
  const { canManage } = await projectAccess(user, task.projectId, db);
  if (!canManage) throw new DomainError("FORBIDDEN", "Validation réservée au chef de mission et aux gestionnaires.");
  if (task.deliverableStatus !== "SUBMITTED") throw new DomainError("INVALID_STATE", "Aucun livrable soumis à valider.");
  await inTransaction(db, async (tx) => {
    await tx.projectTask.update({ where: { id: taskId }, data: { deliverableStatus: approve ? "APPROVED" : "CHANGES_REQUESTED", status: approve ? "DONE" : "IN_PROGRESS" } });
    if (comment) await tx.taskComment.create({ data: { taskId, authorId: user.id, body: comment } });
    await audit({ actorId: user.id, organizationId: task.project.organizationId, action: approve ? "deliverable.approve" : "deliverable.reject", entityType: "ProjectTask", entityId: taskId }, tx);
    if (task.assigneeId) await notify({ userId: task.assigneeId, type: "DEADLINE", title: approve ? "Livrable validé" : "Modifications demandées", body: `« ${task.title} »${comment ? ` : ${comment}` : ""}`, link: `/projets/${task.projectId}` }, tx);
  });
}

export async function commentTask(user: SessionUser, taskId: string, body: string, db: Db = prisma) {
  const task = await db.projectTask.findUnique({ where: { id: taskId } });
  if (!task) throw new DomainError("NOT_FOUND", "Tâche introuvable.");
  await projectAccess(user, task.projectId, db);
  return db.taskComment.create({ data: { taskId, authorId: user.id, body } });
}

export async function updateProjectStatus(user: SessionUser, projectId: string, status: "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED", db: Db = prisma) {
  const { project, canManage } = await projectAccess(user, projectId, db);
  if (!canManage) throw new DomainError("FORBIDDEN", "Action réservée aux gestionnaires du projet.");
  await db.project.update({ where: { id: projectId }, data: { status } });
  await audit({ actorId: user.id, organizationId: project.organizationId, action: "project.status", entityType: "Project", entityId: projectId, metadata: { status } }, db);
}
