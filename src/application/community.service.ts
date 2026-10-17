/** Communauté professionnelle : publications, commentaires, réactions, groupes, abonnements, signalements, mentorat. */
import { prisma, inTransaction, type Db } from "@/infrastructure/db";
import { DomainError } from "@/domain/errors";
import type { SessionUser } from "./auth.service";
import { requireAdmin } from "./access";
import { audit } from "./audit.service";
import { notify } from "./notification.service";

/** Seuil de signalements distincts au-delà duquel une publication est masquée en attente de modération. */
export const AUTO_HIDE_REPORTS = 3;

export async function feed(userId: string | null, filter: { groupSlug?: string; following?: boolean; page?: number }, db: Db = prisma) {
  const take = 20;
  const following = filter.following && userId ? (await db.follow.findMany({ where: { followerId: userId }, select: { followeeId: true } })).map((f) => f.followeeId) : null;
  return db.communityPost.findMany({
    where: { status: "PUBLISHED", ...(filter.groupSlug ? { group: { slug: filter.groupSlug } } : {}), ...(following ? { authorId: { in: following } } : {}) },
    orderBy: { createdAt: "desc" },
    take,
    skip: ((filter.page ?? 1) - 1) * take,
    include: {
      author: { select: { id: true, firstName: true, lastName: true, expertProfile: { select: { slug: true, headline: true } } } },
      group: { select: { name: true, slug: true } },
      comments: { where: { status: "PUBLISHED" }, orderBy: { createdAt: "asc" }, take: 20, include: { author: { select: { firstName: true, lastName: true } } } },
      reactions: { select: { userId: true } },
    },
  });
}

export async function createPost(user: SessionUser, body: string, groupId: string | null, db: Db = prisma) {
  if (!user.emailVerifiedAt && !user.isDemo) throw new DomainError("FORBIDDEN", "Vérifiez votre adresse email pour publier.");
  if (groupId && !(await db.groupMembership.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } }))) throw new DomainError("FORBIDDEN", "Rejoignez le groupe pour y publier.");
  return db.communityPost.create({ data: { authorId: user.id, body, groupId } });
}

export async function comment(user: SessionUser, postId: string, body: string, db: Db = prisma) {
  const post = await db.communityPost.findUnique({ where: { id: postId } });
  if (!post || post.status !== "PUBLISHED") throw new DomainError("NOT_FOUND", "Publication introuvable.");
  const c = await db.postComment.create({ data: { postId, authorId: user.id, body } });
  if (post.authorId !== user.id) await notify({ userId: post.authorId, type: "MESSAGE", title: "Nouveau commentaire", body: `${user.firstName} a commenté votre publication.`, link: "/communaute", channels: [] }, db);
  return c;
}

export async function toggleReaction(userId: string, postId: string, db: Db = prisma) {
  const key = { postId_userId: { postId, userId } };
  if (await db.postReaction.findUnique({ where: key })) {
    await db.postReaction.delete({ where: key });
    return { reacted: false };
  }
  await db.postReaction.create({ data: { postId, userId } });
  return { reacted: true };
}

export async function toggleFollow(followerId: string, followeeId: string, db: Db = prisma) {
  if (followerId === followeeId) throw new DomainError("VALIDATION", "Vous ne pouvez pas vous suivre vous-même.");
  const key = { followerId_followeeId: { followerId, followeeId } };
  if (await db.follow.findUnique({ where: key })) {
    await db.follow.delete({ where: key });
    return { following: false };
  }
  await db.follow.create({ data: { followerId, followeeId } });
  return { following: true };
}

export async function groups(userId: string | null, db: Db = prisma) {
  const rows = await db.communityGroup.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { members: true, posts: true } }, members: userId ? { where: { userId }, select: { userId: true } } : false } });
  return rows.map((g) => ({ ...g, isMember: Array.isArray(g.members) && g.members.length > 0 }));
}

export async function toggleGroup(userId: string, groupId: string, db: Db = prisma) {
  const key = { groupId_userId: { groupId, userId } };
  if (await db.groupMembership.findUnique({ where: key })) {
    await db.groupMembership.delete({ where: key });
    return { member: false };
  }
  await db.groupMembership.create({ data: { groupId, userId } });
  return { member: true };
}

export async function report(user: SessionUser, input: { targetType: string; targetId: string; reason: string }, db: Db = prisma) {
  const dup = await db.contentReport.findFirst({ where: { reporterId: user.id, targetType: input.targetType, targetId: input.targetId, status: "OPEN" } });
  if (dup) return dup;
  const r = await db.contentReport.create({ data: { reporterId: user.id, ...input } });
  if (input.targetType === "POST") {
    const distinct = await db.contentReport.groupBy({ by: ["reporterId"], where: { targetType: "POST", targetId: input.targetId, status: "OPEN" } });
    if (distinct.length >= AUTO_HIDE_REPORTS) await db.communityPost.updateMany({ where: { id: input.targetId, status: "PUBLISHED" }, data: { status: "HIDDEN" } });
  }
  return r;
}

export async function moderationQueue(user: SessionUser, db: Db = prisma) {
  requireAdmin(user, "COMMUNITY_MODERATE");
  return db.contentReport.findMany({ where: { status: "OPEN" }, orderBy: { createdAt: "asc" }, include: { reporter: { select: { firstName: true, lastName: true } } } });
}

export async function resolveReport(user: SessionUser, reportId: string, action: "REMOVE" | "RESTORE" | "DISMISS", note: string | null, db: Db = prisma) {
  requireAdmin(user, "COMMUNITY_MODERATE");
  const r = await db.contentReport.findUniqueOrThrow({ where: { id: reportId } });
  await inTransaction(db, async (tx) => {
    if (r.targetType === "POST") await tx.communityPost.updateMany({ where: { id: r.targetId }, data: { status: action === "REMOVE" ? "REMOVED" : "PUBLISHED" } });
    if (r.targetType === "COMMENT") await tx.postComment.updateMany({ where: { id: r.targetId }, data: { status: action === "REMOVE" ? "REMOVED" : "PUBLISHED" } });
    await tx.contentReport.updateMany({ where: { targetType: r.targetType, targetId: r.targetId, status: "OPEN" }, data: { status: action === "DISMISS" ? "DISMISSED" : "RESOLVED", resolvedById: user.id, resolution: note, resolvedAt: new Date() } });
    await audit({ actorId: user.id, action: `moderation.${action.toLowerCase()}`, entityType: r.targetType, entityId: r.targetId, metadata: { reportId, note } }, tx);
  });
}

export async function upcomingEvents(db: Db = prisma) {
  return db.communityEvent.findMany({ where: { startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, take: 10 });
}

// ── Mentorat ─────────────────────────────────────────────────

export async function requestMentorship(user: SessionUser, mentorUserId: string, topic: string, message: string | null, db: Db = prisma) {
  if (mentorUserId === user.id) throw new DomainError("VALIDATION", "Choisissez un autre mentor.");
  const mentor = await db.user.findUnique({ where: { id: mentorUserId }, select: { status: true, expertProfile: { select: { id: true } } } });
  if (!mentor || mentor.status !== "ACTIVE" || !mentor.expertProfile) throw new DomainError("NOT_FOUND", "Mentor introuvable.");
  if (await db.mentorship.findFirst({ where: { mentorId: mentorUserId, menteeId: user.id, status: { in: ["REQUESTED", "ACCEPTED"] } } })) throw new DomainError("CONFLICT", "Une demande est déjà en cours avec ce mentor.");
  const m = await db.mentorship.create({ data: { mentorId: mentorUserId, menteeId: user.id, topic, message } });
  await notify({ userId: mentorUserId, type: "INVITATION", title: "Demande de mentorat", body: `${user.firstName} ${user.lastName} : « ${topic} »`, link: "/communaute/mentorat" }, db);
  return m;
}

export async function respondMentorship(user: SessionUser, id: string, status: "ACCEPTED" | "DECLINED" | "COMPLETED", db: Db = prisma) {
  const m = await db.mentorship.findUnique({ where: { id } });
  if (!m || m.mentorId !== user.id) throw new DomainError("NOT_FOUND", "Demande introuvable.");
  await db.mentorship.update({ where: { id }, data: { status, respondedAt: new Date() } });
  await notify({ userId: m.menteeId, type: "INVITATION", title: "Mentorat", body: `Votre demande « ${m.topic} » : ${status === "ACCEPTED" ? "acceptée" : status === "DECLINED" ? "déclinée" : "terminée"}.`, link: "/communaute/mentorat" }, db);
}

export async function myMentorships(userId: string, db: Db = prisma) {
  const include = { mentor: { select: { firstName: true, lastName: true } }, mentee: { select: { firstName: true, lastName: true } } };
  const [asMentor, asMentee] = await Promise.all([db.mentorship.findMany({ where: { mentorId: userId }, orderBy: { createdAt: "desc" }, include }), db.mentorship.findMany({ where: { menteeId: userId }, orderBy: { createdAt: "desc" }, include })]);
  return { asMentor, asMentee };
}
