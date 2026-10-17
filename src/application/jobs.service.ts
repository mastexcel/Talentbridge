/** Tâches planifiées (cron) : `npm run jobs` ou POST /api/v1/jobs (en-tête x-cron-secret). */
import { prisma, type Db } from "@/infrastructure/db";
import { logger } from "@/infrastructure/logger";
import { processOutbox, notify } from "./notification.service";
import { processRenewals, sendInvoiceReminders } from "./billing.service";
import { expireVerifications } from "./verification.service";
import { activatePaidEnrollments } from "./academy.service";

/** Rappels d'échéance : candidatures (J-2) et livrables (J-2). */
async function deadlineReminders(now: Date, db: Db) {
  const soon = new Date(now.getTime() + 2 * 86_400_000);
  const tasks = await db.projectTask.findMany({ where: { dueDate: { gte: now, lte: soon }, status: { not: "DONE" }, assigneeId: { not: null } }, select: { id: true, title: true, projectId: true, assigneeId: true } });
  let n = 0;
  for (const t of tasks) {
    const already = await db.notification.findFirst({ where: { userId: t.assigneeId!, type: "DEADLINE", link: `/projets/${t.projectId}`, title: { contains: t.title.slice(0, 40) }, createdAt: { gte: new Date(now.getTime() - 86_400_000) } } });
    if (already) continue;
    await notify({ userId: t.assigneeId!, type: "DEADLINE", title: `Échéance proche : ${t.title.slice(0, 60)}`, body: "Cette tâche arrive à échéance dans moins de 48 heures.", link: `/projets/${t.projectId}`, channels: [] }, db);
    n++;
  }
  return n;
}

export async function runJobs(now = new Date(), db: Db = prisma) {
  const result = {
    renewals: await processRenewals(now, db),
    reminders: await sendInvoiceReminders(now, db),
    verificationsExpired: await expireVerifications(now, db),
    enrollmentsActivated: await activatePaidEnrollments(db),
    deadlines: await deadlineReminders(now, db),
    sessionsPurged: (await db.session.deleteMany({ where: { expiresAt: { lt: now } } })).count,
    outbox: await processOutbox(100, db),
  };
  logger.info("jobs.run", result);
  return result;
}
