/** Administration centrale : utilisateurs, experts, marketplace, configuration. Toute action est journalisée. */
import type { Prisma } from "@prisma/client";
import { prisma, type Db } from "@/infrastructure/db";
import { DomainError } from "@/domain/errors";
import type { AdminPermission } from "@/domain/permissions";
import type { SessionUser } from "./auth.service";
import { requireAdmin } from "./access";
import { audit } from "./audit.service";

export async function listUsers(user: SessionUser, f: { q?: string; status?: string; page?: number }, db: Db = prisma) {
  requireAdmin(user, "USERS_MANAGE");
  const take = 30;
  const where: Prisma.UserWhereInput = {
    ...(f.status ? { status: f.status as "ACTIVE" } : { status: { not: "DELETED" } }),
    ...(f.q ? { OR: [{ email: { contains: f.q, mode: "insensitive" } }, { lastName: { contains: f.q, mode: "insensitive" } }, { firstName: { contains: f.q, mode: "insensitive" } }] } : {}),
  };
  const [items, total] = await Promise.all([
    db.user.findMany({ where, orderBy: { createdAt: "desc" }, take, skip: ((f.page ?? 1) - 1) * take, select: { id: true, email: true, firstName: true, lastName: true, status: true, platformRole: true, adminPermissions: true, emailVerifiedAt: true, lastLoginAt: true, createdAt: true, isDemo: true, expertProfile: { select: { slug: true } }, memberships: { select: { role: true, organization: { select: { name: true } } } } } }),
    db.user.count({ where }),
  ]);
  return { items, total, pageSize: take };
}

export async function setUserStatus(admin: SessionUser, userId: string, status: "ACTIVE" | "SUSPENDED", reason: string, db: Db = prisma) {
  requireAdmin(admin, "USERS_MANAGE");
  if (userId === admin.id) throw new DomainError("VALIDATION", "Vous ne pouvez pas modifier votre propre statut.");
  const target = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (target.adminPermissions.includes("SUPER_ADMIN") && !admin.adminPermissions.includes("SUPER_ADMIN")) throw new DomainError("FORBIDDEN", "Seul un super-administrateur peut agir sur ce compte.");
  await db.user.update({ where: { id: userId }, data: { status } });
  if (status === "SUSPENDED") await db.session.deleteMany({ where: { userId } });
  await audit({ actorId: admin.id, action: `user.${status === "SUSPENDED" ? "suspend" : "activate"}`, entityType: "User", entityId: userId, metadata: { reason } }, db);
}

export async function setAdminRole(admin: SessionUser, userId: string, permissions: AdminPermission[], db: Db = prisma) {
  requireAdmin(admin, "SUPER_ADMIN");
  if (userId === admin.id && !permissions.includes("SUPER_ADMIN")) throw new DomainError("VALIDATION", "Vous ne pouvez pas retirer vos propres droits de super-administrateur.");
  await db.user.update({ where: { id: userId }, data: { platformRole: permissions.length ? "ADMIN" : "USER", adminPermissions: permissions } });
  await audit({ actorId: admin.id, action: "user.admin_role", entityType: "User", entityId: userId, metadata: { permissions } }, db);
}

export async function userHistory(admin: SessionUser, userId: string, db: Db = prisma) {
  requireAdmin(admin, "USERS_MANAGE");
  return db.auditLog.findMany({ where: { OR: [{ actorId: userId }, { entityId: userId }] }, orderBy: { createdAt: "desc" }, take: 100 });
}

export async function adminMissions(admin: SessionUser, f: { status?: string; page?: number }, db: Db = prisma) {
  requireAdmin(admin, "MARKETPLACE_MODERATE");
  const take = 30;
  const where: Prisma.MissionWhereInput = f.status ? { status: f.status as "PUBLISHED" } : {};
  const [items, total] = await Promise.all([
    db.mission.findMany({ where, orderBy: { createdAt: "desc" }, take, skip: ((f.page ?? 1) - 1) * take, include: { organization: { select: { name: true } }, _count: { select: { applications: true } } } }),
    db.mission.count({ where }),
  ]);
  return { items, total, pageSize: take };
}

/** Modération : retrait d'une mission non conforme (annulation tracée). */
export async function moderateMission(admin: SessionUser, missionId: string, reason: string, db: Db = prisma) {
  requireAdmin(admin, "MARKETPLACE_MODERATE");
  const m = await db.mission.findUniqueOrThrow({ where: { id: missionId } });
  if (m.status === "CLOSED" || m.status === "CANCELLED") throw new DomainError("INVALID_STATE", "Mission déjà terminée.");
  await db.mission.update({ where: { id: missionId }, data: { status: "CANCELLED", closedAt: new Date() } });
  await db.missionEvent.create({ data: { missionId, actorId: admin.id, fromStatus: m.status, toStatus: "CANCELLED", note: `Modération : ${reason}` } });
  await audit({ actorId: admin.id, organizationId: m.organizationId, action: "moderation.mission", entityType: "Mission", entityId: missionId, metadata: { reason } }, db);
}

export async function adminExperts(admin: SessionUser, f: { q?: string; page?: number }, db: Db = prisma) {
  requireAdmin(admin, "EXPERTS_VERIFY");
  const take = 30;
  const where: Prisma.ExpertProfileWhereInput = f.q ? { OR: [{ headline: { contains: f.q, mode: "insensitive" } }, { user: { lastName: { contains: f.q, mode: "insensitive" } } }] } : {};
  const [items, total] = await Promise.all([
    db.expertProfile.findMany({ where, orderBy: { createdAt: "desc" }, take, skip: ((f.page ?? 1) - 1) * take, select: { id: true, slug: true, headline: true, completeness: true, countryCode: true, isDemo: true, visibility: true, user: { select: { firstName: true, lastName: true, email: true, status: true } }, badges: { where: { revokedAt: null }, select: { id: true, badge: { select: { nameFr: true } } } } } }),
    db.expertProfile.count({ where }),
  ]);
  return { items, total, pageSize: take };
}

/** Référentiels : domaines, compétences (création/désactivation, jamais suppression destructive). */
export async function upsertSkill(admin: SessionUser, input: { id?: string; slug: string; nameFr: string; nameEn: string; domainId: string | null; synonyms: string[]; isActive: boolean }, db: Db = prisma) {
  requireAdmin(admin, "CONFIG_MANAGE");
  const { id, ...data } = input;
  const s = id ? await db.skill.update({ where: { id }, data }) : await db.skill.create({ data });
  await audit({ actorId: admin.id, action: "config.skill", entityType: "Skill", entityId: s.id }, db);
  return s;
}

export async function upsertDomain(admin: SessionUser, input: { id?: string; slug: string; nameFr: string; nameEn: string; isActive: boolean }, db: Db = prisma) {
  requireAdmin(admin, "CONFIG_MANAGE");
  const { id, ...data } = input;
  const d = id ? await db.expertiseDomain.update({ where: { id }, data }) : await db.expertiseDomain.create({ data });
  await audit({ actorId: admin.id, action: "config.domain", entityType: "ExpertiseDomain", entityId: d.id }, db);
  return d;
}

export async function contactRequests(admin: SessionUser, db: Db = prisma) {
  requireAdmin(admin, "CONTENT_MANAGE");
  return db.contactRequest.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
}
