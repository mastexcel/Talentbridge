/**
 * Appels d'offres et AMI : veille, alertes, dossiers de candidature (privés à l'organisation),
 * checklist / matrice de conformité, experts associés, consortiums.
 * L'extraction automatique produit des BROUILLONS signalés comme tels (isDraft).
 */
import type { Prisma } from "@prisma/client";
import { prisma, inTransaction, type Db } from "@/infrastructure/db";
import { DomainError } from "@/domain/errors";
import { extractRequirements } from "@/domain/tenders";
import { toMinor } from "@/domain/money";
import { formatReference } from "@/domain/text";
import type { SessionUser } from "./auth.service";
import { requireAdmin, requireOrgPermission } from "./access";
import { audit } from "./audit.service";
import { notify } from "./notification.service";
import { normalizeText } from "@/domain/matching";

export async function searchTenders(f: { q?: string; country?: string; type?: string; domain?: string; page: number }, db: Db = prisma) {
  const where: Prisma.TenderWhereInput = {
    status: "OPEN",
    deadline: { gte: new Date() },
    ...(f.q ? { OR: [{ title: { contains: f.q, mode: "insensitive" } }, { description: { contains: f.q, mode: "insensitive" } }, { buyerName: { contains: f.q, mode: "insensitive" } }] } : {}),
    ...(f.country ? { countryCode: f.country } : {}),
    ...(f.type ? { type: f.type as "TENDER" } : {}),
    ...(f.domain ? { domain: { slug: f.domain } } : {}),
  };
  const [items, total] = await Promise.all([
    db.tender.findMany({ where, orderBy: { deadline: "asc" }, take: 15, skip: (f.page - 1) * 15, include: { domain: { select: { nameFr: true } } } }),
    db.tender.count({ where }),
  ]);
  return { items, total, pages: Math.max(1, Math.ceil(total / 15)) };
}

export async function getTender(id: string, db: Db = prisma) {
  return db.tender.findUnique({ where: { id }, include: { domain: true, documents: true, publisher: { select: { name: true } } } });
}

/** Publication par une organisation (acheteur) ou par l'équipe Talent Bridge (veille). */
export async function publishTender(user: SessionUser, input: { type: "TENDER" | "EOI" | "RFP"; title: string; buyerName: string; countryCode: string; domainId: string | null; description: string; eligibility: string | null; budget?: number | null; currency?: string | null; deadline: Date; sourceUrl: string | null }, asPlatform: boolean, db: Db = prisma) {
  let publisherOrgId: string | null = null;
  if (asPlatform) requireAdmin(user, "MARKETPLACE_MODERATE");
  else publisherOrgId = requireOrgPermission(user, user.activeOrgId, "tenders.manage").organizationId;
  if (input.deadline < new Date()) throw new DomainError("VALIDATION", "La date limite doit être future.");
  const year = new Date().getUTCFullYear();
  const count = await db.tender.count({ where: { reference: { startsWith: `TB-AO-${year}-` } } });
  const { budget, ...rest } = input;
  const tender = await db.tender.create({ data: { ...rest, reference: formatReference("AO", year, count + 1), publisherOrgId, budgetMinor: budget != null && input.currency ? toMinor(budget, input.currency) : null } });
  await audit({ actorId: user.id, organizationId: publisherOrgId, action: "tender.publish", entityType: "Tender", entityId: tender.id }, db);
  await dispatchAlerts(tender.id, db);
  return tender;
}

/** Alertes personnalisées : notifie les utilisateurs dont les critères correspondent. */
export async function dispatchAlerts(tenderId: string, db: Db = prisma) {
  const t = await db.tender.findUniqueOrThrow({ where: { id: tenderId } });
  const hay = normalizeText(`${t.title} ${t.description}`);
  const alerts = await db.tenderAlert.findMany({ where: { isActive: true } });
  let sent = 0;
  for (const a of alerts) {
    const okCountry = a.countryCodes.length === 0 || a.countryCodes.includes(t.countryCode);
    const okDomain = a.domainIds.length === 0 || (t.domainId && a.domainIds.includes(t.domainId));
    const okKw = a.keywords.length === 0 || a.keywords.some((k) => hay.includes(normalizeText(k)));
    if (okCountry && okDomain && okKw) {
      await notify({ userId: a.userId, type: "NEW_MISSION", title: `Alerte « ${a.name} »`, body: `Nouvel appel : ${t.title} (${t.buyerName}).`, link: `/appels-offres/${t.id}` }, db);
      sent++;
    }
  }
  return sent;
}

export async function saveAlert(user: SessionUser, input: { name: string; keywords: string[]; countryCodes: string[]; domainIds: string[] }, db: Db = prisma) {
  if ((await db.tenderAlert.count({ where: { userId: user.id } })) >= 20) throw new DomainError("VALIDATION", "20 alertes maximum.");
  return db.tenderAlert.create({ data: { userId: user.id, ...input } });
}

export async function listAlerts(userId: string, db: Db = prisma) {
  return db.tenderAlert.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

export async function deleteAlert(userId: string, id: string, db: Db = prisma) {
  await db.tenderAlert.deleteMany({ where: { id, userId } });
}

// ── Dossiers de candidature ──────────────────────────────────

async function ownBid(user: SessionUser, bidId: string, db: Db) {
  const bid = await db.tenderBid.findUnique({ where: { id: bidId } });
  if (!bid) throw new DomainError("NOT_FOUND", "Dossier introuvable.");
  requireOrgPermission(user, bid.organizationId, "tenders.manage");
  return bid;
}

export async function startBid(user: SessionUser, tenderId: string, db: Db = prisma) {
  const { organizationId } = requireOrgPermission(user, user.activeOrgId, "tenders.manage");
  const tender = await db.tender.findUnique({ where: { id: tenderId } });
  if (!tender) throw new DomainError("NOT_FOUND", "Appel d'offres introuvable.");
  const existing = await db.tenderBid.findUnique({ where: { organizationId_tenderId: { organizationId, tenderId } } });
  if (existing) return existing;
  const bid = await db.tenderBid.create({ data: { organizationId, tenderId, status: "PREPARING", internalDeadline: new Date(tender.deadline.getTime() - 3 * 86_400_000) } });
  await audit({ actorId: user.id, organizationId, action: "tender.bid_start", entityType: "TenderBid", entityId: bid.id }, db);
  return bid;
}

export async function listBids(user: SessionUser, organizationId: string, db: Db = prisma) {
  requireOrgPermission(user, organizationId, "org.view");
  return db.tenderBid.findMany({ where: { organizationId }, orderBy: { updatedAt: "desc" }, include: { tender: { select: { title: true, deadline: true, buyerName: true, reference: true } }, requirements: { select: { status: true } } } });
}

export async function getBid(user: SessionUser, bidId: string, db: Db = prisma) {
  await ownBid(user, bidId, db);
  return db.tenderBid.findUniqueOrThrow({
    where: { id: bidId },
    include: {
      tender: { include: { documents: true } },
      requirements: { orderBy: [{ category: "asc" }, { position: "asc" }] },
      experts: { include: { expert: { select: { id: true, slug: true, headline: true, cvFileId: true, user: { select: { firstName: true, lastName: true } } } } } },
      consortium: { include: { members: { include: { organization: { select: { name: true } } } } } },
    },
  });
}

/** Analyse des TDR (texte collé ou description de l'appel) → lignes de checklist en BROUILLON. */
export async function extractBidRequirements(user: SessionUser, bidId: string, tdrText: string | null, db: Db = prisma) {
  const bid = await ownBid(user, bidId, db);
  const tender = await db.tender.findUniqueOrThrow({ where: { id: bid.tenderId } });
  const found = extractRequirements(`${tender.description}\n${tender.eligibility ?? ""}\n${tdrText ?? ""}`);
  const existing = new Set((await db.bidRequirement.findMany({ where: { bidId } })).map((r) => r.label));
  const toCreate = found.filter((f) => !existing.has(f.label));
  await db.bidRequirement.createMany({ data: toCreate.map((f, i) => ({ bidId, category: f.category, label: f.label, isDraft: true, note: `Repéré automatiquement (« ${f.matched} ») — à vérifier dans les TDR.`, position: existing.size + i })) });
  await audit({ actorId: user.id, organizationId: bid.organizationId, action: "tender.extract", entityType: "TenderBid", entityId: bidId, metadata: { created: toCreate.length } }, db);
  return { created: toCreate.length };
}

export async function addRequirement(user: SessionUser, bidId: string, input: { category: string; label: string }, db: Db = prisma) {
  await ownBid(user, bidId, db);
  const position = await db.bidRequirement.count({ where: { bidId } });
  return db.bidRequirement.create({ data: { bidId, ...input, position } });
}

export async function updateRequirement(user: SessionUser, reqId: string, input: { status?: "MISSING" | "IN_PROGRESS" | "READY"; fileId?: string | null; confirm?: boolean }, db: Db = prisma) {
  const r = await db.bidRequirement.findUnique({ where: { id: reqId } });
  if (!r) throw new DomainError("NOT_FOUND", "Exigence introuvable.");
  await ownBid(user, r.bidId, db);
  return db.bidRequirement.update({ where: { id: reqId }, data: { ...(input.status ? { status: input.status } : {}), ...(input.fileId !== undefined ? { fileId: input.fileId } : {}), ...(input.confirm ? { isDraft: false } : {}) } });
}

export async function deleteRequirement(user: SessionUser, reqId: string, db: Db = prisma) {
  const r = await db.bidRequirement.findUnique({ where: { id: reqId } });
  if (!r) throw new DomainError("NOT_FOUND", "Exigence introuvable.");
  await ownBid(user, r.bidId, db);
  await db.bidRequirement.delete({ where: { id: reqId } });
}

/** Associe un expert (et son CV) au dossier : uniquement des experts réels de l'annuaire. */
export async function addBidExpert(user: SessionUser, bidId: string, expertId: string, role: string, db: Db = prisma) {
  await ownBid(user, bidId, db);
  await db.expertProfile.findUniqueOrThrow({ where: { id: expertId }, select: { id: true } });
  await db.tenderBidExpert.upsert({ where: { bidId_expertId: { bidId, expertId } }, create: { bidId, expertId, role }, update: { role } });
}

export async function setConsortium(user: SessionUser, bidId: string, name: string, partnerOrgIds: string[], db: Db = prisma) {
  const bid = await ownBid(user, bidId, db);
  await inTransaction(db, async (tx) => {
    const c = await tx.consortium.upsert({ where: { bidId }, create: { bidId, name }, update: { name } });
    await tx.consortiumMember.deleteMany({ where: { consortiumId: c.id } });
    await tx.consortiumMember.createMany({ data: [{ consortiumId: c.id, organizationId: bid.organizationId, role: "LEAD" }, ...partnerOrgIds.filter((id) => id !== bid.organizationId).map((organizationId) => ({ consortiumId: c.id, organizationId, role: "MEMBER" }))] });
  });
}

export async function setBidStatus(user: SessionUser, bidId: string, status: "WATCHING" | "PREPARING" | "SUBMITTED" | "WON" | "LOST" | "WITHDRAWN", db: Db = prisma) {
  const bid = await ownBid(user, bidId, db);
  if (status === "SUBMITTED") {
    const missing = await db.bidRequirement.count({ where: { bidId, OR: [{ status: { not: "READY" } }, { isDraft: true }] } });
    if (missing > 0) throw new DomainError("INVALID_STATE", `${missing} pièce(s) non prête(s) ou non confirmée(s) dans la checklist.`);
  }
  await db.tenderBid.update({ where: { id: bidId }, data: { status, ...(status === "SUBMITTED" ? { submittedAt: new Date() } : {}) } });
  await audit({ actorId: user.id, organizationId: bid.organizationId, action: "tender.bid_status", entityType: "TenderBid", entityId: bidId, metadata: { status } }, db);
}
