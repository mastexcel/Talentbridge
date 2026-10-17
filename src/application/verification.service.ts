/**
 * Centre de vérification et de certification des experts.
 * Parcours : dépôt → complétude → contrôles (administratif, diplômes, références, compétences)
 * → décision → badge → renouvellement. Chaque transition est historisée (verification_events)
 * et journalisée (audit_logs). Un badge n'est JAMAIS attribué sur simple dépôt de document :
 * la décision « Vérifié » exige que tous les contrôles requis aient été saisis par un administrateur.
 */
import { prisma, inTransaction, type Db } from "@/infrastructure/db";
import { DomainError } from "@/domain/errors";
import { MIN_COMPLETENESS_FOR_VERIFICATION } from "@/domain/profile";
import {
  BADGE_FOR_TYPE,
  canApproveVerification,
  verificationFlow,
  VERIFICATION_TYPE_LABELS,
  type VerificationStatus,
  type VerificationStep,
  type VerificationType,
} from "@/domain/workflows";
import type { SessionUser } from "./auth.service";
import { requireAdmin } from "./access";
import { audit } from "./audit.service";
import { notify } from "./notification.service";
import { getSetting } from "./settings.service";
import { recomputeCompleteness } from "./expert.service";

async function transition(requestId: string, from: VerificationStatus, to: VerificationStatus, step: VerificationStep, actorId: string | null, note: string | null, db: Db, extra: Record<string, unknown> = {}) {
  verificationFlow.assert(from, to);
  // Mise à jour conditionnelle : échoue si le statut a changé entre-temps (concurrence).
  const res = await db.verificationRequest.updateMany({ where: { id: requestId, status: from }, data: { status: to, currentStep: step, ...extra } });
  if (res.count === 0) throw new DomainError("CONFLICT", "La demande a été modifiée entre-temps. Rechargez la page.");
  await db.verificationEvent.create({ data: { requestId, actorId, fromStatus: from, toStatus: to, step, note } });
}

/** Demande en cours (ou nouvelle) pour un type donné. */
export async function getOrCreateRequest(expertId: string, type: VerificationType, db: Db = prisma) {
  const open = await db.verificationRequest.findFirst({ where: { expertId, type, status: { in: ["NOT_SUBMITTED", "PENDING", "IN_REVIEW", "INFO_REQUESTED"] } }, orderBy: { createdAt: "desc" } });
  if (open) return open;
  return db.verificationRequest.create({ data: { expertId, type } });
}

export async function addDocument(user: SessionUser, expertId: string, requestId: string, fileId: string, kind: string, label: string | null, db: Db = prisma) {
  const req = await db.verificationRequest.findFirst({ where: { id: requestId, expertId } });
  if (!req) throw new DomainError("NOT_FOUND", "Demande introuvable.");
  if (!["NOT_SUBMITTED", "INFO_REQUESTED"].includes(req.status)) throw new DomainError("INVALID_STATE", "Les pièces ne peuvent plus être modifiées à ce stade.");
  const file = await db.storedFile.findUnique({ where: { id: fileId } });
  if (!file || file.ownerUserId !== user.id || file.purpose !== "VERIFICATION") throw new DomainError("VALIDATION", "Justificatif invalide.");
  return db.verificationDocument.create({ data: { requestId, fileId, kind, label } });
}

export async function submitRequest(user: SessionUser, expertId: string, requestId: string, db: Db = prisma) {
  const req = await db.verificationRequest.findFirst({ where: { id: requestId, expertId }, include: { _count: { select: { documents: true } } } });
  if (!req) throw new DomainError("NOT_FOUND", "Demande introuvable.");
  const { score } = await recomputeCompleteness(expertId, db);
  if (score < MIN_COMPLETENESS_FOR_VERIFICATION) throw new DomainError("INVALID_STATE", `Votre profil doit être complété à ${MIN_COMPLETENESS_FOR_VERIFICATION} % au moins (actuellement ${score} %).`);
  if (req.type !== "SKILLS" && req._count.documents === 0) throw new DomainError("VALIDATION", "Déposez au moins un justificatif avant de soumettre.");
  await inTransaction(db, async (tx) => {
    await transition(req.id, req.status, "PENDING", "COMPLETENESS", user.id, null, tx, { submittedAt: new Date() });
    await audit({ actorId: user.id, action: "verification.submit", entityType: "VerificationRequest", entityId: req.id, metadata: { type: req.type } }, tx);
  });
}

// ── Back-office ──────────────────────────────────────────────

export async function adminQueue(user: SessionUser, filter: { status?: VerificationStatus; type?: VerificationType; page?: number }, db: Db = prisma) {
  requireAdmin(user, "EXPERTS_VERIFY");
  const take = 25;
  const where = {
    status: filter.status ?? { in: ["PENDING", "IN_REVIEW", "INFO_REQUESTED"] as VerificationStatus[] },
    ...(filter.type ? { type: filter.type } : {}),
  };
  const [items, total] = await Promise.all([
    db.verificationRequest.findMany({
      where,
      orderBy: { submittedAt: "asc" },
      take,
      skip: ((filter.page ?? 1) - 1) * take,
      include: { expert: { select: { id: true, slug: true, headline: true, completeness: true, user: { select: { firstName: true, lastName: true, email: true } } } }, _count: { select: { documents: true, checks: true } } },
    }),
    db.verificationRequest.count({ where }),
  ]);
  return { items, total, pageSize: take };
}

export async function adminGetRequest(user: SessionUser, requestId: string, db: Db = prisma) {
  requireAdmin(user, "EXPERTS_VERIFY");
  return db.verificationRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: {
      expert: {
        include: {
          user: { select: { firstName: true, lastName: true, email: true, phone: true } },
          qualifications: true,
          references: true,
          skills: { include: { skill: true } },
          experiences: { orderBy: { startDate: "desc" } },
        },
      },
      documents: { include: { file: { select: { id: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true } } } },
      checks: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "asc" } },
      badges: { include: { badge: true } },
    },
  });
}

export async function recordCheck(user: SessionUser, requestId: string, input: { step: VerificationStep; result: "PASS" | "FAIL" | "NOT_APPLICABLE"; note: string | null }, db: Db = prisma) {
  requireAdmin(user, "EXPERTS_VERIFY");
  const req = await db.verificationRequest.findUniqueOrThrow({ where: { id: requestId } });
  if (req.status !== "IN_REVIEW") throw new DomainError("INVALID_STATE", "Passez la demande « en vérification » avant de saisir les contrôles.");
  await db.verificationCheck.upsert({
    where: { requestId_step: { requestId, step: input.step } },
    create: { requestId, step: input.step, result: input.result, note: input.note, checkedById: user.id },
    update: { result: input.result, note: input.note, checkedById: user.id },
  });
  await db.verificationRequest.update({ where: { id: requestId }, data: { currentStep: input.step } });
  await audit({ actorId: user.id, action: "verification.check", entityType: "VerificationRequest", entityId: requestId, metadata: input }, db);
}

/** Vérifie individuellement une référence ou un diplôme (après contact du référent / de l'établissement). */
export async function verifyProfileItem(user: SessionUser, kind: "reference" | "qualification", id: string, verified: boolean, db: Db = prisma) {
  requireAdmin(user, "EXPERTS_VERIFY");
  const status = verified ? "VERIFIED" : "REJECTED";
  if (kind === "reference") await db.expertReference.update({ where: { id }, data: { status, verifiedAt: new Date(), verifiedById: user.id } });
  else await db.qualification.update({ where: { id }, data: { status } });
  await audit({ actorId: user.id, action: `verification.${kind}`, entityType: kind === "reference" ? "ExpertReference" : "Qualification", entityId: id, metadata: { status } }, db);
}

export async function decide(user: SessionUser, requestId: string, decision: "START_REVIEW" | "REQUEST_INFO" | "APPROVE" | "REJECT", note: string | null, db: Db = prisma) {
  requireAdmin(user, "EXPERTS_VERIFY");
  const req = await db.verificationRequest.findUniqueOrThrow({ where: { id: requestId }, include: { checks: true, expert: { select: { userId: true } } } });
  const label = VERIFICATION_TYPE_LABELS[req.type];

  await inTransaction(db, async (tx) => {
    switch (decision) {
      case "START_REVIEW":
        await transition(req.id, req.status, "IN_REVIEW", "ADMINISTRATIVE", user.id, note, tx);
        break;
      case "REQUEST_INFO":
        if (!note) throw new DomainError("VALIDATION", "Précisez le complément demandé.");
        await transition(req.id, req.status, "INFO_REQUESTED", req.currentStep, user.id, note, tx);
        await notify({ userId: req.expert.userId, type: "VERIFICATION", title: "Complément demandé", body: `${label} : ${note}`, link: "/espace/verification" }, tx);
        break;
      case "REJECT":
        if (!note) throw new DomainError("VALIDATION", "Motivez le refus.");
        await transition(req.id, req.status, "REJECTED", "DECISION", user.id, note, tx, { decidedAt: new Date(), decidedById: user.id, decisionNote: note });
        await notify({ userId: req.expert.userId, type: "VERIFICATION", title: "Vérification refusée", body: `${label} : ${note}`, link: "/espace/verification" }, tx);
        break;
      case "APPROVE": {
        const gate = canApproveVerification(req.type, req.checks);
        if (!gate.ok) {
          throw new DomainError("INVALID_STATE", "Tous les contrôles requis doivent être réalisés et réussis avant la décision.", { missing: gate.missing, failed: gate.failed });
        }
        const validityDays = await getSetting("verification.validityDays", tx);
        const badgeCode = BADGE_FOR_TYPE[req.type];
        const badge = await tx.badge.findUnique({ where: { code: badgeCode } });
        if (!badge) throw new DomainError("INVALID_STATE", `Badge ${badgeCode} non configuré.`);
        const expiresAt = new Date(Date.now() + (badge.validityDays ?? validityDays) * 86_400_000);
        await transition(req.id, req.status, "VERIFIED", "BADGE", user.id, note, tx, { decidedAt: new Date(), decidedById: user.id, decisionNote: note, expiresAt });
        // Un seul badge actif par type : l'ancien est révoqué (renouvellement).
        await tx.expertBadge.updateMany({ where: { expertId: req.expertId, badgeId: badge.id, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.expertBadge.create({ data: { expertId: req.expertId, badgeId: badge.id, verificationRequestId: req.id, awardedById: user.id, expiresAt } });
        await notify({ userId: req.expert.userId, type: "CERTIFICATION", title: "Badge obtenu", body: `${label} validée : le badge « ${badge.nameFr} » apparaît sur votre profil.`, link: "/espace/verification" }, tx);
        break;
      }
    }
    await audit({ actorId: user.id, action: `verification.${decision.toLowerCase()}`, entityType: "VerificationRequest", entityId: req.id, metadata: { type: req.type, note } }, tx);
  });
}

export async function revokeBadge(user: SessionUser, expertBadgeId: string, reason: string, db: Db = prisma) {
  requireAdmin(user, "EXPERTS_VERIFY");
  await db.expertBadge.update({ where: { id: expertBadgeId }, data: { revokedAt: new Date() } });
  await audit({ actorId: user.id, action: "badge.revoke", entityType: "ExpertBadge", entityId: expertBadgeId, metadata: { reason } }, db);
}

/** Tâche planifiée : expire les vérifications arrivées à échéance et notifie (renouvellement). */
export async function expireVerifications(now = new Date(), db: Db = prisma) {
  const due = await db.verificationRequest.findMany({ where: { status: "VERIFIED", expiresAt: { lte: now } }, include: { expert: { select: { userId: true } } } });
  for (const r of due) {
    await inTransaction(db, async (tx) => {
      await transition(r.id, "VERIFIED", "EXPIRED", "RENEWAL", null, "Échéance de validité atteinte", tx);
      await notify({ userId: r.expert.userId, type: "RENEWAL", title: "Vérification expirée", body: `${VERIFICATION_TYPE_LABELS[r.type]} : renouvelez votre vérification pour conserver votre badge.`, link: "/espace/verification" }, tx);
    });
  }
  return due.length;
}

export async function myVerifications(expertId: string, db: Db = prisma) {
  return db.verificationRequest.findMany({
    where: { expertId },
    orderBy: { createdAt: "desc" },
    include: { documents: { include: { file: { select: { id: true, filename: true } } } }, events: { orderBy: { createdAt: "asc" } } },
  });
}
