/**
 * Données personnelles : export (droit d'accès / portabilité), suppression de compte
 * (anonymisation des données personnelles, conservation des pièces comptables),
 * consentements. Durées de conservation : docs/SECURITY.md (à valider juridiquement,
 * notamment au regard de la loi ivoirienne n° 2013-450 et des exigences de l'ARTCI).
 */
import { prisma, inTransaction, type Db } from "@/infrastructure/db";
import { randomToken } from "@/infrastructure/crypto";
import { hashPassword } from "@/infrastructure/auth/password";
import { DomainError } from "@/domain/errors";
import type { SessionUser } from "./auth.service";
import { audit } from "./audit.service";
import { CONSENT_VERSION } from "./auth.service";

export async function exportMyData(userId: string, db: Db = prisma) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      email: true, firstName: true, lastName: true, phone: true, locale: true, createdAt: true,
      consents: { select: { type: true, granted: true, version: true, createdAt: true } },
      memberships: { select: { role: true, organization: { select: { name: true } } } },
      expertProfile: { include: { skills: { include: { skill: { select: { nameFr: true } } } }, experiences: true, qualifications: true, references: true, portfolio: true, applications: { select: { missionId: true, status: true, createdAt: true, coverLetter: true } } } },
      notifications: { select: { type: true, title: true, createdAt: true }, take: 500 },
      invoices: { select: { number: true, totalMinor: true, currency: true, status: true, issuedAt: true } },
    },
  });
  return { exportedAt: new Date().toISOString(), user };
}

export async function setConsent(user: SessionUser, type: "MARKETING_EMAIL" | "MARKETING_SMS" | "PROFILE_PUBLIC", granted: boolean, db: Db = prisma) {
  await db.consent.create({ data: { userId: user.id, type, granted, version: CONSENT_VERSION } });
  if (type === "PROFILE_PUBLIC" && !granted && user.expertProfile) await db.expertProfile.update({ where: { id: user.expertProfile.id }, data: { visibility: "PRIVATE" } });
}

export async function currentConsents(userId: string, db: Db = prisma) {
  const rows = await db.consent.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  const latest = new Map<string, boolean>();
  for (const r of rows) if (!latest.has(r.type)) latest.set(r.type, r.granted);
  return Object.fromEntries(latest);
}

/**
 * Suppression de compte : impossible si l'utilisateur est seul propriétaire d'une organisation
 * ou a un contrat en cours. Les données personnelles sont anonymisées ; les factures restent
 * (obligation comptable) avec l'instantané acheteur figé à l'émission.
 */
export async function deleteAccount(user: SessionUser, db: Db = prisma) {
  for (const m of user.memberships.filter((x) => x.role === "OWNER")) {
    const owners = await db.organizationMember.count({ where: { organizationId: m.organizationId, role: "OWNER" } });
    if (owners <= 1) throw new DomainError("INVALID_STATE", `Transférez d'abord la propriété de « ${m.organization.name} » à un autre membre.`);
  }
  if (user.expertProfile && (await db.contract.count({ where: { expertId: user.expertProfile.id, status: { in: ["SENT", "SIGNED", "ACTIVE"] } } }))) {
    throw new DomainError("INVALID_STATE", "Vous avez un contrat en cours : la suppression sera possible à sa clôture.");
  }
  const anon = `supprime-${randomToken(8).toLowerCase()}@anonyme.invalid`;
  await inTransaction(db, async (tx) => {
    if (user.expertProfile) {
      const id = user.expertProfile.id;
      await tx.expertReference.deleteMany({ where: { expertId: id } });
      await tx.portfolioItem.deleteMany({ where: { expertId: id } });
      await tx.availabilitySlot.deleteMany({ where: { expertId: id } });
      await tx.expertProfile.update({ where: { id }, data: { headline: null, bio: null, city: null, visibility: "PRIVATE", photoFileId: null, cvFileId: null, missionPreferences: null, dailyRateMinor: null } });
    }
    await tx.organizationMember.deleteMany({ where: { userId: user.id } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.notification.deleteMany({ where: { userId: user.id } });
    await tx.tenderAlert.deleteMany({ where: { userId: user.id } });
    await tx.user.update({ where: { id: user.id }, data: { email: anon, firstName: "Utilisateur", lastName: "supprimé", phone: null, passwordHash: await hashPassword(randomToken(24)), status: "DELETED", deletionRequestedAt: new Date() } });
    await audit({ actorId: user.id, action: "user.delete", entityType: "User", entityId: user.id }, tx);
  });
}
