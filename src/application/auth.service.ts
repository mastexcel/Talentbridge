/**
 * Authentification email + mot de passe, sessions opaques stockées en base
 * (seul le SHA-256 du jeton est conservé). Compte utilisateur ≠ compte organisation :
 * l'inscription d'une organisation crée l'utilisateur ET l'organisation dont il devient propriétaire.
 */
import { Prisma } from "@prisma/client";
import { prisma, inTransaction, type Db } from "@/infrastructure/db";
import { hashPassword, verifyPassword } from "@/infrastructure/auth/password";
import { randomToken, sha256 } from "@/infrastructure/crypto";
import { env } from "@/infrastructure/env";
import { DomainError } from "@/domain/errors";
import { slugify } from "@/domain/text";
import type { SignupInput } from "./schemas";
import { audit } from "./audit.service";
import { notify, queueEmail } from "./notification.service";

export const SESSION_COOKIE = "tb_session";
export const SESSION_TTL_MS = 14 * 24 * 3600 * 1000;
const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60 * 1000;
export const CONSENT_VERSION = "2026-10";

export const sessionUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  locale: true,
  status: true,
  platformRole: true,
  adminPermissions: true,
  emailVerifiedAt: true,
  isDemo: true,
  expertProfile: { select: { id: true, slug: true, completeness: true } },
  memberships: {
    select: { role: true, organizationId: true, organization: { select: { id: true, name: true, slug: true, type: true, status: true } } },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof sessionUserSelect }>;
export type SessionUser = UserRow & { sessionId: string; activeOrgId: string | null };

export async function uniqueSlug(base: string, exists: (slug: string) => Promise<boolean>): Promise<string> {
  const root = slugify(base);
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${root}-${randomToken(4).toLowerCase()}`;
}

async function issueEmailToken(userId: string, db: Db) {
  const token = randomToken(32);
  await db.userToken.create({ data: { userId, type: "EMAIL_VERIFY", tokenHash: sha256(token), expiresAt: new Date(Date.now() + 48 * 3600_000) } });
  return token;
}

export async function signup(input: SignupInput, meta: { ip?: string | null } = {}, db: Db = prisma) {
  if (await db.user.findUnique({ where: { email: input.email }, select: { id: true } })) {
    throw new DomainError("CONFLICT", "Un compte existe déjà avec cette adresse. Connectez-vous ou réinitialisez votre mot de passe.");
  }
  const passwordHash = await hashPassword(input.password);

  const result = await inTransaction(db, async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        consents: {
          create: [
            { type: "TERMS", granted: true, version: CONSENT_VERSION, ip: meta.ip ?? null },
            { type: "PRIVACY", granted: true, version: CONSENT_VERSION, ip: meta.ip ?? null },
            { type: "MARKETING_EMAIL", granted: input.marketingEmail, version: CONSENT_VERSION, ip: meta.ip ?? null },
          ],
        },
      },
    });

    let organizationId: string | null = null;
    if (input.accountType === "EXPERT") {
      const slug = await uniqueSlug(`${input.firstName}-${input.lastName}`, async (s) => !!(await tx.expertProfile.findUnique({ where: { slug: s }, select: { id: true } })));
      await tx.expertProfile.create({ data: { userId: user.id, slug, countryCode: input.countryCode, languages: ["fr"], visibility: "PRIVATE" } });
    } else if (input.accountType !== "LEARNER") {
      // Apprenant : compte personnel sans profil d'expert ni organisation (Academy uniquement).
      const slug = await uniqueSlug(input.organizationName!, async (s) => !!(await tx.organization.findUnique({ where: { slug: s }, select: { id: true } })));
      const org = await tx.organization.create({
        data: {
          name: input.organizationName!,
          slug,
          type: input.accountType,
          countryCode: input.countryCode,
          contactName: `${input.firstName} ${input.lastName}`,
          contactEmail: input.email,
          contactPhone: input.phone,
          members: { create: { userId: user.id, role: "OWNER" } },
        },
      });
      organizationId = org.id;
    }

    // Invitation éventuelle : rattache le nouvel utilisateur à l'organisation invitante.
    if (input.invitationToken) {
      await acceptInvitationTx(input.invitationToken, user.id, input.email, tx);
    }

    const verifyToken = await issueEmailToken(user.id, tx);
    await audit({ actorId: user.id, organizationId, action: "user.signup", entityType: "User", entityId: user.id, metadata: { accountType: input.accountType }, ip: meta.ip }, tx);
    return { user, organizationId, verifyToken };
  });

  await queueEmail(
    input.email,
    "Confirmez votre adresse email — Talent Bridge",
    `Bonjour ${input.firstName},\n\nBienvenue sur Talent Bridge. Confirmez votre adresse en ouvrant ce lien (valable 48 h) :\n${env().APP_URL}/verifier-email?jeton=${result.verifyToken}\n\nL'équipe Talent Bridge`,
    db,
  );
  const welcome = {
    EXPERT: { body: "Complétez votre profil pour être visible des organisations.", link: "/espace/profil" },
    LEARNER: { body: "Choisissez une formation ou un séminaire dans le catalogue de la Talent Bridge Academy.", link: "/academy" },
  }[input.accountType as "EXPERT" | "LEARNER"] ?? { body: "Complétez la fiche de votre organisation pour la soumettre à validation.", link: "/organisation/parametres" };
  await notify({ userId: result.user.id, type: "REGISTRATION", title: "Bienvenue sur Talent Bridge", ...welcome, channels: [] }, db);
  return { userId: result.user.id, organizationId: result.organizationId, verifyToken: result.verifyToken };
}

export async function createSession(userId: string, meta: { ip?: string | null; userAgent?: string | null } = {}, db: Db = prisma) {
  const token = randomToken(32);
  const membership = await db.organizationMember.findFirst({ where: { userId }, orderBy: { createdAt: "asc" }, select: { organizationId: true } });
  await db.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      activeOrgId: membership?.organizationId ?? null,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  return token;
}

export async function login(email: string, password: string, meta: { ip?: string | null; userAgent?: string | null } = {}, db: Db = prisma) {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  // Message identique que le compte existe ou non (pas d'énumération).
  const invalid = new DomainError("UNAUTHENTICATED", "Email ou mot de passe incorrect.");
  if (!user || user.status === "DELETED") {
    await verifyPassword(password, "$2a$04$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv").catch(() => false);
    throw invalid;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new DomainError("RATE_LIMITED", "Compte temporairement verrouillé après plusieurs échecs. Réessayez dans 15 minutes.");
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    const failed = user.failedLogins + 1;
    await db.user.update({ where: { id: user.id }, data: { failedLogins: failed >= MAX_FAILED_LOGINS ? 0 : failed, lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MS) : null } });
    if (failed >= MAX_FAILED_LOGINS) await audit({ actorId: user.id, action: "user.locked", entityType: "User", entityId: user.id, ip: meta.ip }, db);
    throw invalid;
  }
  if (user.status === "SUSPENDED") throw new DomainError("FORBIDDEN", "Ce compte est suspendu. Contactez le support.");
  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  const token = await createSession(user.id, meta, db);
  await audit({ actorId: user.id, action: "user.login", entityType: "User", entityId: user.id, ip: meta.ip }, db);
  return { token, userId: user.id };
}

export async function logout(token: string | null | undefined, db: Db = prisma) {
  if (!token) return;
  await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
}

export async function getUserBySessionToken(token: string | null | undefined, db: Db = prisma): Promise<SessionUser | null> {
  if (!token || token.length < 20) return null;
  const session = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: { select: sessionUserSelect } } });
  if (!session || session.expiresAt < new Date() || session.user.status !== "ACTIVE") return null;
  // L'organisation active doit toujours être une organisation dont l'utilisateur est membre.
  const activeOrgId = session.user.memberships.some((m) => m.organizationId === session.activeOrgId) ? session.activeOrgId : (session.user.memberships[0]?.organizationId ?? null);
  return { ...session.user, sessionId: session.id, activeOrgId };
}

export async function switchOrganization(user: SessionUser, organizationId: string, db: Db = prisma) {
  if (!user.memberships.some((m) => m.organizationId === organizationId)) throw new DomainError("FORBIDDEN", "Vous n'êtes pas membre de cette organisation.");
  await db.session.update({ where: { id: user.sessionId }, data: { activeOrgId: organizationId } });
}

export async function verifyEmail(token: string, db: Db = prisma) {
  const row = await db.userToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.type !== "EMAIL_VERIFY" || row.usedAt || row.expiresAt < new Date()) throw new DomainError("VALIDATION", "Lien de vérification invalide ou expiré.");
  await inTransaction(db, async (tx) => {
    await tx.userToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    await tx.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } });
  });
  return row.userId;
}

export async function resendVerification(userId: string, db: Db = prisma) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.emailVerifiedAt) return;
  const token = await issueEmailToken(userId, db);
  await queueEmail(user.email, "Confirmez votre adresse email — Talent Bridge", `Bonjour ${user.firstName},\n\nConfirmez votre adresse : ${env().APP_URL}/verifier-email?jeton=${token}\n\nL'équipe Talent Bridge`, db);
}

export async function requestPasswordReset(email: string, db: Db = prisma): Promise<string | null> {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || user.status !== "ACTIVE") return null; // réponse identique côté API
  const token = randomToken(32);
  await db.userToken.create({ data: { userId: user.id, type: "PASSWORD_RESET", tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600_000) } });
  await queueEmail(user.email, "Réinitialisation de votre mot de passe — Talent Bridge", `Bonjour ${user.firstName},\n\nPour choisir un nouveau mot de passe (lien valable 1 heure) :\n${env().APP_URL}/mot-de-passe/nouveau?jeton=${token}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`, db);
  return token;
}

export async function resetPassword(token: string, newPassword: string, db: Db = prisma) {
  const row = await db.userToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.type !== "PASSWORD_RESET" || row.usedAt || row.expiresAt < new Date()) throw new DomainError("VALIDATION", "Lien invalide ou expiré.");
  const passwordHash = await hashPassword(newPassword);
  await inTransaction(db, async (tx) => {
    await tx.userToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash, failedLogins: 0, lockedUntil: null } });
    await tx.session.deleteMany({ where: { userId: row.userId } }); // déconnexion de tous les appareils
  });
  await audit({ actorId: row.userId, action: "user.password_reset", entityType: "User", entityId: row.userId }, db);
}

export async function changePassword(userId: string, current: string, next: string, keepSessionId: string, db: Db = prisma) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(current, user.passwordHash))) throw new DomainError("VALIDATION", "Mot de passe actuel incorrect.");
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
  await db.session.deleteMany({ where: { userId, id: { not: keepSessionId } } });
  await audit({ actorId: userId, action: "user.password_change", entityType: "User", entityId: userId }, db);
}

// ── Invitations de collaborateurs ─────────────────────────────

export async function acceptInvitationTx(token: string, userId: string, email: string, tx: Prisma.TransactionClient) {
  const inv = await tx.invitation.findUnique({ where: { tokenHash: sha256(token) } });
  if (!inv || inv.acceptedAt || inv.revokedAt || inv.expiresAt < new Date()) throw new DomainError("VALIDATION", "Invitation invalide ou expirée.");
  if (inv.email.toLowerCase() !== email.toLowerCase()) throw new DomainError("FORBIDDEN", "Cette invitation a été envoyée à une autre adresse email.");
  await tx.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: inv.organizationId, userId } },
    create: { organizationId: inv.organizationId, userId, role: inv.role },
    update: {},
  });
  await tx.invitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } });
  await audit({ actorId: userId, organizationId: inv.organizationId, action: "org.invitation_accept", entityType: "Invitation", entityId: inv.id }, tx);
  return inv.organizationId;
}

export async function acceptInvitation(token: string, user: { id: string; email: string }, db: Db = prisma) {
  return inTransaction(db, (tx) => acceptInvitationTx(token, user.id, user.email, tx));
}

export async function invitationPreview(token: string, db: Db = prisma) {
  const inv = await db.invitation.findUnique({ where: { tokenHash: sha256(token) }, include: { organization: { select: { name: true } } } });
  if (!inv || inv.acceptedAt || inv.revokedAt || inv.expiresAt < new Date()) return null;
  return { email: inv.email, role: inv.role, organizationName: inv.organization.name };
}
