/**
 * Centre de notifications : notification interne + email/SMS mis en file (outbox),
 * selon les modèles administrables et les préférences de l'utilisateur.
 */
import { prisma, type Db } from "@/infrastructure/db";
import { emailChannel, smsChannel } from "@/infrastructure/notifications/channels";
import { logger } from "@/infrastructure/logger";
import { renderTemplate } from "@/domain/text";
import { env } from "@/infrastructure/env";

export const NOTIFICATION_TYPES = {
  REGISTRATION: "Inscription",
  VERIFICATION: "Vérification",
  NEW_MISSION: "Nouvelle mission",
  INVITATION: "Invitation",
  APPLICATION: "Candidature",
  MESSAGE: "Message",
  DEADLINE: "Échéance",
  PAYMENT: "Paiement",
  INVOICE: "Facture",
  TRAINING: "Formation",
  CERTIFICATION: "Certification",
  RENEWAL: "Renouvellement",
} as const;
export type NotificationType = keyof typeof NOTIFICATION_TYPES;

/** Événements dont l'email ne peut pas être désactivé (sécurité, obligations). */
const MANDATORY_EMAIL: NotificationType[] = ["REGISTRATION", "PAYMENT", "INVOICE"];

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  vars?: Record<string, string | number | null | undefined>;
  /** Envoie aussi l'email/SMS (selon préférences) */
  channels?: ("EMAIL" | "SMS")[];
}

export async function notify(input: NotifyInput, db: Db = prisma): Promise<void> {
  const user = await db.user.findUnique({ where: { id: input.userId }, select: { email: true, phone: true, firstName: true, locale: true, status: true } });
  if (!user || user.status === "DELETED") return;
  const prefs = await db.notificationPreference.findMany({ where: { userId: input.userId, type: input.type } });
  const enabled = (ch: "IN_APP" | "EMAIL" | "SMS") => prefs.find((p) => p.channel === ch)?.enabled ?? ch !== "SMS";

  if (enabled("IN_APP")) {
    await db.notification.create({ data: { userId: input.userId, type: input.type, title: input.title, body: input.body, link: input.link ?? null } });
  }
  const vars = { prenom: user.firstName, lien: input.link ? `${env().APP_URL}${input.link}` : env().APP_URL, titre: input.title, message: input.body, ...input.vars };
  for (const channel of input.channels ?? ["EMAIL"]) {
    const allowed = channel === "EMAIL" ? MANDATORY_EMAIL.includes(input.type) || enabled("EMAIL") : enabled("SMS");
    if (!allowed) continue;
    const to = channel === "EMAIL" ? user.email : user.phone;
    if (!to) continue;
    const tpl = await db.notificationTemplate.findUnique({ where: { type_channel_locale: { type: input.type, channel, locale: user.locale } } });
    if (tpl && !tpl.isActive) continue;
    const subject = tpl ? renderTemplate(tpl.subject, vars) : input.title;
    const body = tpl ? renderTemplate(tpl.body, vars) : `Bonjour ${user.firstName},\n\n${input.body}\n\n${vars.lien}\n\nL'équipe Talent Bridge`;
    await db.outboundMessage.create({ data: { channel, to, subject, body } });
  }
}

/** Email direct (hors utilisateur connu : vérification, invitation, contact). */
export async function queueEmail(to: string, subject: string, body: string, db: Db = prisma) {
  await db.outboundMessage.create({ data: { channel: "EMAIL", to, subject, body } });
}

/** Traitement de la file d'envoi (appelé par `npm run jobs` ou /api/v1/jobs). */
export async function processOutbox(limit = 50, db: Db = prisma): Promise<{ sent: number; failed: number }> {
  const batch = await db.outboundMessage.findMany({ where: { status: "QUEUED", sendAfter: { lte: new Date() } }, orderBy: { createdAt: "asc" }, take: limit });
  let sent = 0;
  let failed = 0;
  for (const m of batch) {
    try {
      const ch = m.channel === "SMS" ? smsChannel() : emailChannel();
      const r = await ch.send({ to: m.to, subject: m.subject, body: m.body });
      await db.outboundMessage.update({ where: { id: m.id }, data: { status: "SENT", sentAt: new Date(), providerRef: r.providerRef, attempts: { increment: 1 } } });
      sent++;
    } catch (e) {
      const attempts = m.attempts + 1;
      await db.outboundMessage.update({
        where: { id: m.id },
        data: { attempts, lastError: (e as Error).message.slice(0, 500), status: attempts >= 5 ? "FAILED" : "QUEUED", sendAfter: new Date(Date.now() + 2 ** attempts * 60_000) },
      });
      logger.warn("outbox.failed", { id: m.id, attempts });
      failed++;
    }
  }
  return { sent, failed };
}

export async function listNotifications(userId: string, page = 1, db: Db = prisma) {
  const take = 30;
  const [items, unread] = await Promise.all([
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take, skip: (page - 1) * take }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { items, unread };
}

export async function markRead(userId: string, ids: string[] | "all", db: Db = prisma) {
  await db.notification.updateMany({ where: { userId, readAt: null, ...(ids === "all" ? {} : { id: { in: ids } }) }, data: { readAt: new Date() } });
}

export async function unreadCount(userId: string, db: Db = prisma) {
  return db.notification.count({ where: { userId, readAt: null } });
}

export async function setPreference(userId: string, type: NotificationType, channel: "IN_APP" | "EMAIL" | "SMS", enabled: boolean, db: Db = prisma) {
  await db.notificationPreference.upsert({
    where: { userId_type_channel: { userId, type, channel } },
    create: { userId, type, channel, enabled },
    update: { enabled },
  });
}
