/** Journal d'audit (ajout seul). Toute action sensible y est enregistrée. */
import type { Prisma } from "@prisma/client";
import { prisma, type Db } from "@/infrastructure/db";

export interface AuditEntry {
  actorId?: string | null;
  organizationId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

export async function audit(entry: AuditEntry, db: Db = prisma): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      organizationId: entry.organizationId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      ip: entry.ip ?? null,
    },
  });
}

export async function listAudit(filter: { action?: string; entityType?: string; actorId?: string; page?: number }, db: Db = prisma) {
  const take = 50;
  const where: Prisma.AuditLogWhereInput = {
    ...(filter.action ? { action: { contains: filter.action } } : {}),
    ...(filter.entityType ? { entityType: filter.entityType } : {}),
    ...(filter.actorId ? { actorId: filter.actorId } : {}),
  };
  const [items, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip: ((filter.page ?? 1) - 1) * take,
      include: { actor: { select: { email: true, firstName: true, lastName: true } } },
    }),
    db.auditLog.count({ where }),
  ]);
  return { items, total, pageSize: take };
}
