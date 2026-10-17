/** Organisations (tenants) : fiche, collaborateurs, invitations, validation administrative. */
import { prisma, type Db } from "@/infrastructure/db";
import { randomToken, sha256 } from "@/infrastructure/crypto";
import { env } from "@/infrastructure/env";
import { DomainError } from "@/domain/errors";
import { canAssignRole, canChangeOwnerRole, ORG_ROLE_LABELS, type OrgRole } from "@/domain/permissions";
import { organizationFlow } from "@/domain/workflows";
import type { OrganizationInput } from "./schemas";
import type { SessionUser } from "./auth.service";
import { requireAdmin, requireOrgPermission } from "./access";
import { audit } from "./audit.service";
import { notify, queueEmail } from "./notification.service";

export async function getOrganization(user: SessionUser, organizationId: string, db: Db = prisma) {
  requireOrgPermission(user, organizationId, "org.view");
  return db.organization.findUniqueOrThrow({
    where: { id: organizationId },
    include: { documents: { include: { file: { select: { id: true, filename: true, createdAt: true } } } } },
  });
}

export async function updateOrganization(user: SessionUser, organizationId: string, input: OrganizationInput, db: Db = prisma) {
  requireOrgPermission(user, organizationId, "org.manage");
  const org = await db.organization.update({ where: { id: organizationId }, data: { ...input } });
  await audit({ actorId: user.id, organizationId, action: "org.update", entityType: "Organization", entityId: organizationId }, db);
  return org;
}

export async function createOrganization(user: SessionUser, input: OrganizationInput, db: Db = prisma) {
  const { uniqueSlug } = await import("./auth.service");
  const slug = await uniqueSlug(input.name, async (s) => !!(await db.organization.findUnique({ where: { slug: s }, select: { id: true } })));
  const org = await db.organization.create({ data: { ...input, slug, members: { create: { userId: user.id, role: "OWNER" } } } });
  await db.session.update({ where: { id: user.sessionId }, data: { activeOrgId: org.id } });
  await audit({ actorId: user.id, organizationId: org.id, action: "org.create", entityType: "Organization", entityId: org.id }, db);
  return org;
}

export async function attachOrgDocument(user: SessionUser, organizationId: string, fileId: string, kind: string, db: Db = prisma) {
  requireOrgPermission(user, organizationId, "org.manage");
  const file = await db.storedFile.findUnique({ where: { id: fileId } });
  if (!file || file.ownerUserId !== user.id || file.purpose !== "ORG_DOCUMENT") throw new DomainError("VALIDATION", "Document invalide.");
  await db.storedFile.update({ where: { id: fileId }, data: { organizationId } });
  return db.organizationDocument.create({ data: { organizationId, fileId, kind } });
}

export async function listMembers(user: SessionUser, organizationId: string, db: Db = prisma) {
  requireOrgPermission(user, organizationId, "org.view");
  const [members, invitations] = await Promise.all([
    db.organizationMember.findMany({ where: { organizationId }, include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } }, orderBy: { createdAt: "asc" } }),
    db.invitation.findMany({ where: { organizationId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
  ]);
  return { members, invitations };
}

export async function inviteMember(user: SessionUser, organizationId: string, email: string, role: OrgRole, db: Db = prisma) {
  const { role: actorRole } = requireOrgPermission(user, organizationId, "members.manage");
  if (!canAssignRole(actorRole, role)) throw new DomainError("FORBIDDEN", "Seul un propriétaire peut inviter un autre propriétaire.");
  const existing = await db.organizationMember.findFirst({ where: { organizationId, user: { email } } });
  if (existing) throw new DomainError("CONFLICT", "Cette personne est déjà membre de l'organisation.");
  const token = randomToken(32);
  const org = await db.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { name: true } });
  const inv = await db.invitation.create({ data: { organizationId, email, role, tokenHash: sha256(token), invitedById: user.id, expiresAt: new Date(Date.now() + 7 * 86_400_000) } });
  await queueEmail(
    email,
    `Invitation à rejoindre ${org.name} sur Talent Bridge`,
    `Bonjour,\n\n${user.firstName} ${user.lastName} vous invite à rejoindre ${org.name} sur Talent Bridge en tant que « ${ORG_ROLE_LABELS[role]} ».\n\nAccepter l'invitation (valable 7 jours) :\n${env().APP_URL}/invitation?jeton=${token}\n\nL'équipe Talent Bridge`,
    db,
  );
  const invitee = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (invitee) await notify({ userId: invitee.id, type: "INVITATION", title: `Invitation de ${org.name}`, body: `Vous êtes invité(e) à rejoindre ${org.name}.`, link: `/invitation?jeton=${token}`, channels: [] }, db);
  await audit({ actorId: user.id, organizationId, action: "org.invite", entityType: "Invitation", entityId: inv.id, metadata: { email, role } }, db);
  return { id: inv.id, token };
}

export async function revokeInvitation(user: SessionUser, organizationId: string, invitationId: string, db: Db = prisma) {
  requireOrgPermission(user, organizationId, "members.manage");
  const res = await db.invitation.updateMany({ where: { id: invitationId, organizationId, acceptedAt: null }, data: { revokedAt: new Date() } });
  if (res.count === 0) throw new DomainError("NOT_FOUND", "Invitation introuvable.");
  await audit({ actorId: user.id, organizationId, action: "org.invitation_revoke", entityType: "Invitation", entityId: invitationId }, db);
}

export async function changeMemberRole(user: SessionUser, organizationId: string, memberUserId: string, role: OrgRole | null, db: Db = prisma) {
  const { role: actorRole } = requireOrgPermission(user, organizationId, "members.manage");
  const target = await db.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId: memberUserId } } });
  if (!target) throw new DomainError("NOT_FOUND", "Membre introuvable.");
  if (target.role === "OWNER" && actorRole !== "OWNER") throw new DomainError("FORBIDDEN", "Seul un propriétaire peut modifier un autre propriétaire.");
  if (role && !canAssignRole(actorRole, role)) throw new DomainError("FORBIDDEN", "Rôle non attribuable avec vos droits.");
  const owners = await db.organizationMember.count({ where: { organizationId, role: "OWNER" } });
  if (!canChangeOwnerRole(owners, target.role === "OWNER", role)) throw new DomainError("INVALID_STATE", "L'organisation doit conserver au moins un propriétaire.");
  if (role === null) await db.organizationMember.delete({ where: { id: target.id } });
  else await db.organizationMember.update({ where: { id: target.id }, data: { role } });
  await audit({ actorId: user.id, organizationId, action: role ? "org.member_role" : "org.member_remove", entityType: "OrganizationMember", entityId: target.id, metadata: { from: target.role, to: role } }, db);
}

// ── Administration centrale ───────────────────────────────────

export async function adminListOrganizations(user: SessionUser, filter: { status?: string; q?: string; page?: number }, db: Db = prisma) {
  requireAdmin(user, "ORGS_VALIDATE");
  const take = 25;
  const where = {
    ...(filter.status ? { status: filter.status as "PENDING" } : {}),
    ...(filter.q ? { name: { contains: filter.q, mode: "insensitive" as const } } : {}),
  };
  const [items, total] = await Promise.all([
    db.organization.findMany({ where, orderBy: { createdAt: "desc" }, take, skip: ((filter.page ?? 1) - 1) * take, include: { _count: { select: { members: true, missions: true, documents: true } } } }),
    db.organization.count({ where }),
  ]);
  return { items, total, pageSize: take };
}

export async function adminDecideOrganization(user: SessionUser, organizationId: string, status: "VERIFIED" | "REJECTED" | "SUSPENDED", note: string | null, db: Db = prisma) {
  requireAdmin(user, "ORGS_VALIDATE");
  const org = await db.organization.findUniqueOrThrow({ where: { id: organizationId }, include: { members: { where: { role: { in: ["OWNER", "ADMIN"] } } } } });
  organizationFlow.assert(org.status, status);
  await db.organization.update({ where: { id: organizationId }, data: { status, verificationNote: note, verifiedAt: status === "VERIFIED" ? new Date() : org.verifiedAt } });
  await audit({ actorId: user.id, organizationId, action: "org.decision", entityType: "Organization", entityId: organizationId, metadata: { from: org.status, to: status, note } }, db);
  const labels = { VERIFIED: "validée", REJECTED: "refusée", SUSPENDED: "suspendue" };
  for (const m of org.members) {
    await notify({ userId: m.userId, type: "VERIFICATION", title: `Organisation ${labels[status]}`, body: note ? `${org.name} : ${note}` : `La fiche de ${org.name} a été ${labels[status]} par l'équipe Talent Bridge.`, link: "/organisation/parametres" }, db);
  }
}
