/**
 * Protocole de certification et certificats.
 *  - Institutions délivrantes : renseignées par le formateur (logo, cachet, signataire, signature,
 *    attestation d'autorisation), validées par Talent Bridge (ACADEMY_MANAGE, autre personne).
 *  - Cosignataires Talent Bridge : nom, fonction, signature (gérés par un super-administrateur).
 *  - Une formation ne peut être mise en ligne qu'avec une institution validée et un cosignataire actif.
 *  - Tout certificat délivré fige une copie de ces éléments (snapshot) : il ne change plus ensuite.
 */
import type { Prisma } from "@prisma/client";
import { prisma, inTransaction, type Db } from "@/infrastructure/db";
import { DomainError } from "@/domain/errors";
import { hasAdminPermission, orgRoleCan, type OrgRole } from "@/domain/permissions";
import {
  consultantCertificateCode,
  consultantChecks,
  consultantValidUntil,
  coursePublishBlockers,
  issuerMissing,
  type BadgeKind,
  type CertificateSnapshot,
  type ConsultantCheck,
} from "@/domain/certificates";
import { storage } from "@/infrastructure/storage/storage";
import type { SessionUser } from "./auth.service";
import { requireAdmin } from "./access";
import { audit } from "./audit.service";
import { notify } from "./notification.service";

type IssuerFile = "logo" | "seal" | "signature";
const FILE_FIELD = { logo: "logoFileId", seal: "sealFileId", signature: "signatureFileId" } as const;
const FILE_PURPOSE = { logo: "CERT_LOGO", seal: "CERT_SEAL", signature: "CERT_SIGNATURE" } as const;

// ── Institutions délivrantes ─────────────────────────────────

function canEditIssuer(user: SessionUser, issuer: { createdById: string; organizationId: string | null }): boolean {
  if (issuer.createdById === user.id || hasAdminPermission(user, "ACADEMY_MANAGE")) return true;
  return !!issuer.organizationId && user.memberships.some((m) => m.organizationId === issuer.organizationId && orgRoleCan(m.role as OrgRole, "org.manage"));
}

async function editableIssuer(user: SessionUser, issuerId: string, db: Db) {
  const issuer = await db.certificateIssuer.findUnique({ where: { id: issuerId } });
  if (!issuer) throw new DomainError("NOT_FOUND", "Institution introuvable.");
  if (!canEditIssuer(user, issuer)) throw new DomainError("FORBIDDEN", "Vous ne pouvez pas modifier cette institution.");
  return issuer;
}

async function instructorCourse(user: SessionUser, courseId: string, db: Db) {
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) throw new DomainError("NOT_FOUND", "Formation introuvable.");
  if (course.instructorId !== user.id && !hasAdminPermission(user, "ACADEMY_MANAGE")) throw new DomainError("FORBIDDEN", "Réservé au formateur de la formation.");
  return course;
}

/** Une modification d'une institution déjà validée ou soumise la renvoie en brouillon (nouvelle validation). */
const RESET_REVIEW = { status: "DRAFT" as const, reviewedById: null, reviewedAt: null, reviewNote: null };

export async function issuersForUser(user: SessionUser, db: Db = prisma) {
  const orgIds = user.memberships.map((m) => m.organizationId);
  return db.certificateIssuer.findMany({ where: { OR: [{ createdById: user.id }, { organizationId: { in: orgIds } }] }, orderBy: { updatedAt: "desc" } });
}

export async function saveIssuer(
  user: SessionUser,
  input: { issuerId?: string | null; courseId?: string | null; name: string; tagline: string | null; signatoryName: string | null; signatoryTitle: string | null; attest: boolean },
  db: Db = prisma,
) {
  return inTransaction(db, async (tx) => {
    const data = {
      name: input.name,
      tagline: input.tagline,
      signatoryName: input.signatoryName,
      signatoryTitle: input.signatoryTitle,
      authorizationAttested: input.attest,
      attestedAt: input.attest ? new Date() : null,
    };
    let issuer;
    if (input.issuerId) {
      await editableIssuer(user, input.issuerId, tx);
      issuer = await tx.certificateIssuer.update({ where: { id: input.issuerId }, data: { ...data, ...RESET_REVIEW } });
    } else {
      const orgId = user.memberships.find((m) => m.organization.type === "TRAINING_PROVIDER")?.organizationId ?? user.activeOrgId ?? null;
      issuer = await tx.certificateIssuer.create({ data: { ...data, createdById: user.id, organizationId: orgId } });
    }
    if (input.courseId) {
      const course = await instructorCourse(user, input.courseId, tx);
      if (course.status === "PUBLISHED" && course.issuerId !== issuer.id) throw new DomainError("INVALID_STATE", "Archivez la formation avant de changer d'institution délivrante.");
      await tx.course.update({ where: { id: course.id }, data: { issuerId: issuer.id } });
    }
    await audit({ actorId: user.id, action: "certificate.issuer.save", entityType: "CertificateIssuer", entityId: issuer.id, metadata: { attest: input.attest } }, tx);
    return issuer;
  });
}

export async function setIssuerFile(user: SessionUser, issuerId: string, kind: IssuerFile, fileId: string, db: Db = prisma) {
  await editableIssuer(user, issuerId, db);
  const file = await db.storedFile.findUnique({ where: { id: fileId } });
  if (!file || file.ownerUserId !== user.id || file.purpose !== FILE_PURPOSE[kind]) throw new DomainError("VALIDATION", "Fichier invalide pour cet usage.");
  await db.certificateIssuer.update({ where: { id: issuerId }, data: { [FILE_FIELD[kind]]: fileId, ...RESET_REVIEW } });
  await audit({ actorId: user.id, action: `certificate.issuer.${kind}`, entityType: "CertificateIssuer", entityId: issuerId }, db);
}

export async function submitIssuer(user: SessionUser, issuerId: string, db: Db = prisma) {
  const issuer = await editableIssuer(user, issuerId, db);
  const missing = issuerMissing(issuer);
  if (missing.length) throw new DomainError("VALIDATION", `Éléments manquants : ${missing.join(", ")}.`);
  if (issuer.status === "VALIDATED") return issuer;
  const updated = await db.certificateIssuer.update({ where: { id: issuerId }, data: { status: "SUBMITTED" } });
  await audit({ actorId: user.id, action: "certificate.issuer.submit", entityType: "CertificateIssuer", entityId: issuerId }, db);
  return updated;
}

export async function attachIssuer(user: SessionUser, courseId: string, issuerId: string, db: Db = prisma) {
  const course = await instructorCourse(user, courseId, db);
  await editableIssuer(user, issuerId, db);
  if (course.status === "PUBLISHED") throw new DomainError("INVALID_STATE", "Archivez la formation avant de changer d'institution délivrante.");
  await db.course.update({ where: { id: courseId }, data: { issuerId } });
}

export async function reviewIssuer(user: SessionUser, issuerId: string, approve: boolean, note: string | null, db: Db = prisma) {
  requireAdmin(user, "ACADEMY_MANAGE");
  const issuer = await db.certificateIssuer.findUnique({ where: { id: issuerId } });
  if (!issuer) throw new DomainError("NOT_FOUND", "Institution introuvable.");
  if (issuer.createdById === user.id) throw new DomainError("FORBIDDEN", "La validation doit être faite par une autre personne que le déclarant.");
  if (issuer.status !== "SUBMITTED") throw new DomainError("INVALID_STATE", "Seule une institution soumise peut être validée ou refusée.");
  if (approve && issuerMissing(issuer).length) throw new DomainError("VALIDATION", "Institution incomplète.");
  if (!approve && !note?.trim()) throw new DomainError("VALIDATION", "Indiquez le motif du refus.");
  await db.certificateIssuer.update({ where: { id: issuerId }, data: { status: approve ? "VALIDATED" : "REJECTED", reviewedById: user.id, reviewedAt: new Date(), reviewNote: note } });
  await audit({ actorId: user.id, action: approve ? "certificate.issuer.validate" : "certificate.issuer.reject", entityType: "CertificateIssuer", entityId: issuerId, metadata: { note } }, db);
  await notify({ userId: issuer.createdById, type: "CERTIFICATION", title: approve ? "Institution validée" : "Institution refusée", body: approve ? `« ${issuer.name} » est validée : ses logo, cachet et signature figureront sur les certificats.` : `« ${issuer.name} » a été refusée : ${note}`, link: "/academy/formateur" }, db);
}

// ── Cosignataires Talent Bridge ──────────────────────────────

export async function saveTbSignatory(
  user: SessionUser,
  input: { id?: string | null; fullName: string; title: string; signatureFileId: string | null; sealFileId: string | null; forVerification: boolean; isActive: boolean },
  db: Db = prisma,
) {
  requireAdmin(user, "SUPER_ADMIN");
  for (const [fid, purpose] of [[input.signatureFileId, "CERT_SIGNATURE"], [input.sealFileId, "CERT_SEAL"]] as const) {
    if (!fid) continue;
    const f = await db.storedFile.findUnique({ where: { id: fid } });
    if (!f || f.purpose !== purpose) throw new DomainError("VALIDATION", "Fichier de signature ou de cachet invalide.");
  }
  return inTransaction(db, async (tx) => {
    const existing = input.id ? await tx.tbSignatory.findUnique({ where: { id: input.id } }) : null;
    const signatureFileId = input.signatureFileId ?? existing?.signatureFileId;
    if (!signatureFileId) throw new DomainError("VALIDATION", "Déposez la signature du cosignataire.");
    if (input.forVerification) await tx.tbSignatory.updateMany({ where: { forVerification: true, ...(input.id ? { id: { not: input.id } } : {}) }, data: { forVerification: false } });
    const data = { fullName: input.fullName, title: input.title, signatureFileId, sealFileId: input.sealFileId ?? existing?.sealFileId ?? null, forVerification: input.forVerification, isActive: input.isActive };
    const s = existing ? await tx.tbSignatory.update({ where: { id: existing.id }, data }) : await tx.tbSignatory.create({ data: { ...data, createdById: user.id } });
    await audit({ actorId: user.id, action: "certificate.tb_signatory.save", entityType: "TbSignatory", entityId: s.id, metadata: { isActive: s.isActive, forVerification: s.forVerification } }, tx);
    return s;
  });
}

export async function assignCosigner(user: SessionUser, courseId: string, tbSignatoryId: string | null, db: Db = prisma) {
  requireAdmin(user, "ACADEMY_MANAGE");
  if (tbSignatoryId) {
    const s = await db.tbSignatory.findUnique({ where: { id: tbSignatoryId } });
    if (!s?.isActive) throw new DomainError("VALIDATION", "Cosignataire inactif ou introuvable.");
  }
  await db.course.update({ where: { id: courseId }, data: { tbSignatoryId } });
  await audit({ actorId: user.id, action: "certificate.cosigner.assign", entityType: "Course", entityId: courseId, metadata: { tbSignatoryId } }, db);
}

// ── Formations : contrôle avant mise en ligne et copie figée ─

export async function courseCertificateState(courseId: string, db: Db = prisma) {
  const course = await db.course.findUniqueOrThrow({ where: { id: courseId }, include: { issuer: true, tbSignatory: true } });
  const lessons = await db.lesson.count({ where: { module: { courseId } } });
  return { course, blockers: coursePublishBlockers({ lessons, issuer: course.issuer, tbSignatory: course.tbSignatory }) };
}

export function courseSnapshot(course: {
  durationHours: number;
  issuer: { name: string; tagline: string | null; logoFileId: string | null; sealFileId: string | null; signatoryName: string | null; signatoryTitle: string | null; signatureFileId: string | null; status: string } | null;
  tbSignatory: { fullName: string; title: string; signatureFileId: string; sealFileId: string | null; isActive: boolean } | null;
}): CertificateSnapshot {
  const i = course.issuer;
  const t = course.tbSignatory;
  if (!i || i.status !== "VALIDATED" || !i.logoFileId || !i.sealFileId || !i.signatureFileId || !i.signatoryName || !i.signatoryTitle) {
    throw new DomainError("INVALID_STATE", "Certificat indisponible : l'institution délivrante de cette formation n'est pas validée.");
  }
  if (!t?.isActive) throw new DomainError("INVALID_STATE", "Certificat indisponible : aucun cosignataire Talent Bridge actif.");
  return {
    issuer: { name: i.name, tagline: i.tagline, logoFileId: i.logoFileId, sealFileId: i.sealFileId, signatoryName: i.signatoryName, signatoryTitle: i.signatoryTitle, signatureFileId: i.signatureFileId },
    tb: { fullName: t.fullName, title: t.title, signatureFileId: t.signatureFileId, sealFileId: t.sealFileId },
    durationHours: course.durationHours,
  };
}

// ── Certificat « Consultant vérifié » ────────────────────────

export async function expertCertificateEligibility(expertId: string, db: Db = prisma) {
  const now = new Date();
  const badges = await db.expertBadge.findMany({ where: { expertId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, include: { badge: { select: { kind: true } } } });
  return { badges, ...consultantChecks(badges.map((b) => b.badge.kind as BadgeKind)) };
}

export async function claimExpertCertificate(user: SessionUser, db: Db = prisma) {
  if (!user.expertProfile) throw new DomainError("FORBIDDEN", "Réservé aux consultants.");
  const expertId = user.expertProfile.id;
  const now = new Date();
  const current = await db.expertCertificate.findFirst({ where: { expertId, revokedAt: null, validUntil: { gt: now } }, orderBy: { issuedAt: "desc" } });
  if (current) return current;
  const elig = await expertCertificateEligibility(expertId, db);
  if (!elig.eligible) throw new DomainError("INVALID_STATE", elig.reason!);
  const signatory = await db.tbSignatory.findFirst({ where: { forVerification: true, isActive: true } });
  if (!signatory) throw new DomainError("NOT_AVAILABLE", "La délivrance des certificats n'est pas encore ouverte : aucun signataire Talent Bridge n'est désigné.");
  const profile = await db.expertProfile.findUniqueOrThrow({ where: { id: expertId }, include: { user: { select: { firstName: true, lastName: true } }, domains: { include: { domain: { select: { nameFr: true } } } } } });
  return inTransaction(db, async (tx) => {
    const [{ nextval }] = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('expert_certificate_seq')`;
    const snapshot: CertificateSnapshot = { tb: { fullName: signatory.fullName, title: signatory.title, signatureFileId: signatory.signatureFileId, sealFileId: signatory.sealFileId } };
    const cert = await tx.expertCertificate.create({
      data: {
        code: consultantCertificateCode(now.getFullYear(), Number(nextval)),
        expertId,
        holderName: `${profile.user.firstName} ${profile.user.lastName}`,
        headline: profile.headline ?? "Consultant",
        photoFileId: profile.photoFileId,
        domains: profile.domains.map((d) => d.domain.nameFr).slice(0, 5),
        checks: elig.checks,
        yearsExperience: profile.yearsExperience || null,
        validUntil: consultantValidUntil(now, elig.badges.map((b) => b.expiresAt)),
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        isDemo: profile.isDemo,
      },
    });
    await audit({ actorId: user.id, action: "certificate.consultant.issue", entityType: "ExpertCertificate", entityId: cert.id }, tx);
    await notify({ userId: user.id, type: "CERTIFICATION", title: "Certificat « Consultant vérifié » délivré", body: `Numéro ${cert.code}.`, link: `/certificats/${cert.code}` }, tx);
    return cert;
  });
}

export async function revokeExpertCertificate(user: SessionUser, certificateId: string, reason: string, db: Db = prisma) {
  requireAdmin(user, "EXPERTS_VERIFY");
  await db.expertCertificate.update({ where: { id: certificateId }, data: { revokedAt: new Date(), revokeReason: reason } });
  await audit({ actorId: user.id, action: "certificate.consultant.revoke", entityType: "ExpertCertificate", entityId: certificateId, metadata: { reason } }, db);
}

// ── Lecture publique ─────────────────────────────────────────

export type PublicCertificate =
  | {
      type: "academy";
      code: string;
      holderName: string;
      courseTitle: string;
      scorePct: number;
      issuedAt: Date;
      revokedAt: Date | null;
      revokeReason: string | null;
      snapshot: CertificateSnapshot | null;
      isDemo: boolean;
    }
  | {
      type: "consultant";
      code: string;
      holderName: string;
      headline: string;
      photoFileId: string | null;
      domains: string[];
      checks: ConsultantCheck[];
      yearsExperience: number | null;
      issuedAt: Date;
      validUntil: Date;
      revokedAt: Date | null;
      revokeReason: string | null;
      snapshot: CertificateSnapshot;
      isDemo: boolean;
    };

export async function findCertificate(code: string, db: Db = prisma): Promise<PublicCertificate | null> {
  const c = code.trim().toUpperCase();
  if (c.startsWith("TB-CV-")) {
    const e = await db.expertCertificate.findUnique({ where: { code: c } });
    return e ? { type: "consultant", ...e, checks: e.checks as ConsultantCheck[], snapshot: e.snapshot as unknown as CertificateSnapshot } : null;
  }
  const l = await db.learningCertificate.findUnique({ where: { code: c }, include: { enrollment: { select: { course: { select: { isDemo: true } } } } } });
  if (!l) return null;
  return { type: "academy", code: l.code, holderName: l.holderName, courseTitle: l.courseTitle, scorePct: l.scorePct, issuedAt: l.issuedAt, revokedAt: l.revokedAt, revokeReason: l.revokeReason, snapshot: (l.snapshot as unknown as CertificateSnapshot | null) ?? null, isDemo: l.enrollment.course.isDemo };
}

/** Contenu d'une image de certificat (logo, cachet, signature, photo) pour la génération PDF. */
export async function certificateImage(fileId: string | null | undefined, db: Db = prisma): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (!fileId) return null;
  const f = await db.storedFile.findUnique({ where: { id: fileId } });
  if (!f || !["image/png", "image/jpeg"].includes(f.mimeType)) return null;
  try {
    return { bytes: await storage().get(f.storageKey), mime: f.mimeType };
  } catch {
    return null;
  }
}
