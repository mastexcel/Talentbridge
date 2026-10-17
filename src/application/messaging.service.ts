/** Messagerie interne : conversations entre participants (aucune coordonnée personnelle échangée par la plateforme). */
import { prisma, inTransaction, type Db } from "@/infrastructure/db";
import { DomainError } from "@/domain/errors";
import type { SessionUser } from "./auth.service";
import { notify } from "./notification.service";

export async function listConversations(userId: string, db: Db = prisma) {
  const items = await db.conversation.findMany({
    where: { participants: { some: { userId } } },
    orderBy: { lastMessageAt: "desc" },
    take: 50,
    include: {
      participants: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, createdAt: true, senderId: true } },
    },
  });
  return items.map((c) => {
    const me = c.participants.find((p) => p.userId === userId);
    const last = c.messages[0];
    return { ...c, unread: !!last && last.senderId !== userId && (!me?.lastReadAt || me.lastReadAt < last.createdAt) };
  });
}

export async function getConversation(userId: string, conversationId: string, db: Db = prisma) {
  const conv = await db.conversation.findFirst({
    where: { id: conversationId, participants: { some: { userId } } },
    include: {
      participants: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      messages: { orderBy: { createdAt: "asc" }, take: 500, include: { sender: { select: { id: true, firstName: true, lastName: true } } } },
    },
  });
  if (!conv) throw new DomainError("NOT_FOUND", "Conversation introuvable.");
  await db.conversationParticipant.update({ where: { conversationId_userId: { conversationId, userId } }, data: { lastReadAt: new Date() } });
  return conv;
}

export async function startConversation(user: SessionUser, input: { recipientUserId?: string; expertId?: string; subject: string; body: string }, db: Db = prisma) {
  let recipientId = input.recipientUserId;
  if (input.expertId) recipientId = (await db.expertProfile.findUniqueOrThrow({ where: { id: input.expertId }, select: { userId: true } })).userId;
  if (!recipientId || recipientId === user.id) throw new DomainError("VALIDATION", "Destinataire invalide.");
  const recipient = await db.user.findUnique({ where: { id: recipientId }, select: { status: true } });
  if (!recipient || recipient.status !== "ACTIVE") throw new DomainError("NOT_FOUND", "Destinataire introuvable.");
  const conv = await inTransaction(db, async (tx) => {
    const c = await tx.conversation.create({
      data: { subject: input.subject, organizationId: user.activeOrgId, participants: { create: [{ userId: user.id, lastReadAt: new Date() }, { userId: recipientId! }] } },
    });
    await tx.message.create({ data: { conversationId: c.id, senderId: user.id, body: input.body } });
    return c;
  });
  await notify({ userId: recipientId, type: "MESSAGE", title: `Nouveau message de ${user.firstName} ${user.lastName}`, body: input.subject, link: `/messages/${conv.id}` }, db);
  return conv;
}

export async function sendMessage(user: SessionUser, conversationId: string, body: string, db: Db = prisma) {
  const conv = await db.conversation.findFirst({ where: { id: conversationId, participants: { some: { userId: user.id } } }, include: { participants: true } });
  if (!conv) throw new DomainError("NOT_FOUND", "Conversation introuvable.");
  const msg = await inTransaction(db, async (tx) => {
    const m = await tx.message.create({ data: { conversationId, senderId: user.id, body } });
    await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: m.createdAt } });
    await tx.conversationParticipant.update({ where: { conversationId_userId: { conversationId, userId: user.id } }, data: { lastReadAt: m.createdAt } });
    return m;
  });
  for (const p of conv.participants.filter((p) => p.userId !== user.id)) {
    await notify({ userId: p.userId, type: "MESSAGE", title: `Message de ${user.firstName} ${user.lastName}`, body: conv.subject, link: `/messages/${conversationId}`, channels: [] }, db);
  }
  return msg;
}
