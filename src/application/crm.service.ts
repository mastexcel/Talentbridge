/**
 * CRM commercial, strictement isolé par organisation propriétaire (ownerOrgId).
 * Pipeline : Prospect → Qualifié → Besoin identifié → Proposition → Négociation → Gagné / Perdu.
 * Le CRM de Talent Bridge elle-même est celui de son organisation interne.
 */
import { prisma, inTransaction, type Db } from "@/infrastructure/db";
import { DomainError } from "@/domain/errors";
import { toMinor } from "@/domain/money";
import { OPPORTUNITY_STAGES, STAGE_DEFAULT_PROBABILITY, type OpportunityStage } from "@/domain/workflows";
import type { SessionUser } from "./auth.service";
import { requireOrgPermission } from "./access";
import { audit } from "./audit.service";
import { assertFeature } from "./billing.service";

async function crmOrg(user: SessionUser, db: Db) {
  const { organizationId } = requireOrgPermission(user, user.activeOrgId, "crm.use");
  await assertFeature({ userId: null, organizationId }, "crm.use", 0, "CRM", db);
  return organizationId;
}

export async function pipeline(user: SessionUser, db: Db = prisma) {
  const ownerOrgId = await crmOrg(user, db);
  const opportunities = await db.opportunity.findMany({ where: { ownerOrgId }, orderBy: { updatedAt: "desc" }, include: { contact: { select: { firstName: true, lastName: true, companyName: true } }, _count: { select: { activities: true } } } });
  const open = opportunities.filter((o) => o.stage !== "WON" && o.stage !== "LOST");
  const won = opportunities.filter((o) => o.stage === "WON").length;
  const closed = won + opportunities.filter((o) => o.stage === "LOST").length;
  return {
    ownerOrgId,
    stages: OPPORTUNITY_STAGES.map((stage) => ({ stage, items: opportunities.filter((o) => o.stage === stage) })),
    // Agrégats par devise (pas de conversion implicite entre devises).
    pipelineValue: sumByCurrency(open.map((o) => [o.currency, o.valueMinor])),
    weightedForecast: sumByCurrency(open.map((o) => [o.currency, Math.round((o.valueMinor * o.probabilityPct) / 100)])),
    conversionPct: closed ? Math.round((won * 1000) / closed) / 10 : null,
  };
}

function sumByCurrency(rows: [string, number][]) {
  const m = new Map<string, number>();
  for (const [c, v] of rows) m.set(c, (m.get(c) ?? 0) + v);
  return [...m].map(([currency, amountMinor]) => ({ currency, amountMinor }));
}

async function assertSameOrg(ownerOrgId: string, ids: { contactId?: string | null; leadId?: string | null; assigneeId?: string | null }, db: Db) {
  if (ids.contactId && !(await db.crmContact.findFirst({ where: { id: ids.contactId, ownerOrgId } }))) throw new DomainError("NOT_FOUND", "Contact introuvable.");
  if (ids.leadId && !(await db.lead.findFirst({ where: { id: ids.leadId, ownerOrgId } }))) throw new DomainError("NOT_FOUND", "Prospect introuvable.");
  if (ids.assigneeId && !(await db.organizationMember.findFirst({ where: { organizationId: ownerOrgId, userId: ids.assigneeId } }))) throw new DomainError("VALIDATION", "Le commercial doit être membre de l'organisation.");
}

export async function createOpportunity(user: SessionUser, input: { title: string; value: number; currency: string; stage: OpportunityStage; expectedCloseDate: Date | null; contactId: string | null; leadId: string | null; assigneeId: string | null }, db: Db = prisma) {
  const ownerOrgId = await crmOrg(user, db);
  await assertSameOrg(ownerOrgId, input, db);
  const { value, ...rest } = input;
  const o = await db.opportunity.create({ data: { ...rest, ownerOrgId, valueMinor: toMinor(value, input.currency), probabilityPct: STAGE_DEFAULT_PROBABILITY[input.stage], assigneeId: input.assigneeId ?? user.id } });
  await audit({ actorId: user.id, organizationId: ownerOrgId, action: "crm.opportunity_create", entityType: "Opportunity", entityId: o.id }, db);
  return o;
}

export async function moveOpportunity(user: SessionUser, id: string, stage: OpportunityStage, lostReason: string | null, db: Db = prisma) {
  const ownerOrgId = await crmOrg(user, db);
  const o = await db.opportunity.findFirst({ where: { id, ownerOrgId } });
  if (!o) throw new DomainError("NOT_FOUND", "Opportunité introuvable.");
  if (stage === "LOST" && !lostReason) throw new DomainError("VALIDATION", "Indiquez le motif de perte.");
  await db.opportunity.update({ where: { id }, data: { stage, probabilityPct: STAGE_DEFAULT_PROBABILITY[stage], lostReason: stage === "LOST" ? lostReason : null, closedAt: stage === "WON" || stage === "LOST" ? new Date() : null } });
  await audit({ actorId: user.id, organizationId: ownerOrgId, action: "crm.opportunity_stage", entityType: "Opportunity", entityId: id, metadata: { from: o.stage, to: stage } }, db);
}

export async function getOpportunity(user: SessionUser, id: string, db: Db = prisma) {
  const ownerOrgId = await crmOrg(user, db);
  const o = await db.opportunity.findFirst({ where: { id, ownerOrgId }, include: { contact: true, lead: true, activities: { orderBy: { createdAt: "desc" } }, quotes: { orderBy: { createdAt: "desc" } } } });
  if (!o) throw new DomainError("NOT_FOUND", "Opportunité introuvable.");
  return o;
}

export async function listLeads(user: SessionUser, db: Db = prisma) {
  const ownerOrgId = await crmOrg(user, db);
  return db.lead.findMany({ where: { ownerOrgId }, orderBy: { createdAt: "desc" }, take: 200 });
}

export async function createLead(user: SessionUser, input: { companyName: string; contactName: string | null; email: string | null; phone: string | null; countryCode?: string | null; source: string | null; notes: string | null }, db: Db = prisma) {
  const ownerOrgId = await crmOrg(user, db);
  return db.lead.create({ data: { ...input, countryCode: input.countryCode ?? null, ownerOrgId, assigneeId: user.id } });
}

/** Conversion d'un prospect : contact + opportunité « Qualifié ». */
export async function convertLead(user: SessionUser, leadId: string, input: { title: string; value: number; currency: string }, db: Db = prisma) {
  const ownerOrgId = await crmOrg(user, db);
  const lead = await db.lead.findFirst({ where: { id: leadId, ownerOrgId } });
  if (!lead) throw new DomainError("NOT_FOUND", "Prospect introuvable.");
  return inTransaction(db, async (tx) => {
    const [first, ...last] = (lead.contactName ?? lead.companyName).split(" ");
    const contact = await tx.crmContact.create({ data: { ownerOrgId, firstName: first, lastName: last.join(" ") || "-", email: lead.email, phone: lead.phone, companyName: lead.companyName } });
    const opp = await tx.opportunity.create({ data: { ownerOrgId, title: input.title, valueMinor: toMinor(input.value, input.currency), currency: input.currency, stage: "QUALIFIED", probabilityPct: STAGE_DEFAULT_PROBABILITY.QUALIFIED, leadId, contactId: contact.id, assigneeId: user.id } });
    await tx.lead.update({ where: { id: leadId }, data: { status: "CONVERTED" } });
    return opp;
  });
}

export async function listContacts(user: SessionUser, q: string | undefined, db: Db = prisma) {
  const ownerOrgId = await crmOrg(user, db);
  return db.crmContact.findMany({ where: { ownerOrgId, ...(q ? { OR: [{ lastName: { contains: q, mode: "insensitive" } }, { companyName: { contains: q, mode: "insensitive" } }] } : {}) }, orderBy: { lastName: "asc" }, take: 200 });
}

export async function createContact(user: SessionUser, input: { firstName: string; lastName: string; email: string | null; phone: string | null; companyName: string | null; position: string | null }, db: Db = prisma) {
  const ownerOrgId = await crmOrg(user, db);
  return db.crmContact.create({ data: { ...input, ownerOrgId } });
}

export async function addActivity(user: SessionUser, input: { kind: string; subject: string; body: string | null; dueAt: Date | null; opportunityId: string | null; contactId: string | null }, db: Db = prisma) {
  const ownerOrgId = await crmOrg(user, db);
  if (input.opportunityId && !(await db.opportunity.findFirst({ where: { id: input.opportunityId, ownerOrgId } }))) throw new DomainError("NOT_FOUND", "Opportunité introuvable.");
  await assertSameOrg(ownerOrgId, { contactId: input.contactId }, db);
  return db.crmActivity.create({ data: { ...input, ownerOrgId, userId: user.id } });
}

export async function completeActivity(user: SessionUser, id: string, db: Db = prisma) {
  const ownerOrgId = await crmOrg(user, db);
  const res = await db.crmActivity.updateMany({ where: { id, ownerOrgId }, data: { doneAt: new Date() } });
  if (res.count === 0) throw new DomainError("NOT_FOUND", "Activité introuvable.");
}

/** Rappels : activités à échéance non réalisées. */
export async function upcomingActivities(user: SessionUser, db: Db = prisma) {
  const ownerOrgId = await crmOrg(user, db);
  return db.crmActivity.findMany({ where: { ownerOrgId, doneAt: null, dueAt: { not: null } }, orderBy: { dueAt: "asc" }, take: 50, include: { opportunity: { select: { title: true } } } });
}

export async function createQuote(user: SessionUser, opportunityId: string, input: { title: string; amount: number; currency: string; validUntil: Date | null }, db: Db = prisma) {
  const ownerOrgId = await crmOrg(user, db);
  if (!(await db.opportunity.findFirst({ where: { id: opportunityId, ownerOrgId } }))) throw new DomainError("NOT_FOUND", "Opportunité introuvable.");
  const n = (await db.quote.count({ where: { ownerOrgId } })) + 1;
  return db.quote.create({ data: { ownerOrgId, opportunityId, number: `DEV-${new Date().getUTCFullYear()}-${String(n).padStart(4, "0")}`, title: input.title, amountMinor: toMinor(input.amount, input.currency), currency: input.currency, validUntil: input.validUntil } });
}

export async function crmExportRows(user: SessionUser, db: Db = prisma) {
  const ownerOrgId = await crmOrg(user, db);
  const rows = await db.opportunity.findMany({ where: { ownerOrgId }, include: { contact: true } });
  return { headers: ["Titre", "Étape", "Valeur (mineure)", "Devise", "Probabilité %", "Clôture prévue", "Contact", "Société"], rows: rows.map((o) => [o.title, o.stage, o.valueMinor, o.currency, o.probabilityPct, o.expectedCloseDate, o.contact ? `${o.contact.firstName} ${o.contact.lastName}` : "", o.contact?.companyName ?? ""]) };
}
