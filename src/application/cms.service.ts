/** CMS simple : blocs de contenu, chiffres clés, témoignages, partenaires, FAQ, demandes de contact. */
import { prisma, type Db } from "@/infrastructure/db";
import type { SessionUser } from "./auth.service";
import { requireAdmin } from "./access";
import { audit } from "./audit.service";
import { queueEmail } from "./notification.service";

export async function getBlocks(keys: string[], locale = "fr", db: Db = prisma): Promise<Record<string, { title: string | null; body: string }>> {
  const rows = await db.contentBlock.findMany({ where: { key: { in: keys }, locale } });
  return Object.fromEntries(rows.map((r) => [r.key, { title: r.title, body: r.body }]));
}

export async function getBlock(key: string, locale = "fr", db: Db = prisma) {
  return db.contentBlock.findUnique({ where: { key_locale: { key, locale } } });
}

export async function saveBlock(user: SessionUser, key: string, locale: string, input: { title: string | null; body: string }, db: Db = prisma) {
  requireAdmin(user, "CONTENT_MANAGE");
  await db.contentBlock.upsert({ where: { key_locale: { key, locale } }, create: { key, locale, ...input, updatedById: user.id }, update: { ...input, updatedById: user.id } });
  await audit({ actorId: user.id, action: "cms.block", entityType: "ContentBlock", entityId: `${key}:${locale}` }, db);
}

/** Valeurs calculées (LIVE) des chiffres clés : jamais de données de démonstration en production. */
async function liveMetric(metric: string, db: Db): Promise<number> {
  const real = { isDemo: false };
  switch (metric) {
    case "experts_verified":
      return db.expertProfile.count({ where: { ...real, badges: { some: { revokedAt: null } } } });
    case "experts":
      return db.expertProfile.count({ where: { ...real, completeness: { gte: 30 } } });
    case "organizations":
      return db.organization.count({ where: { ...real, status: "VERIFIED" } });
    case "missions_completed":
      return db.contract.count({ where: { status: "COMPLETED", mission: real } });
    case "missions_published":
      return db.mission.count({ where: { ...real, publishedAt: { not: null } } });
    case "countries": {
      const rows = await db.expertProfile.groupBy({ by: ["countryCode"], where: { ...real, countryCode: { not: null } } });
      return rows.length;
    }
    default:
      return 0;
  }
}

export async function publicStats(db: Db = prisma) {
  const stats = await db.publicStat.findMany({ where: { isVisible: true }, orderBy: { sortOrder: "asc" } });
  return Promise.all(
    stats.map(async (s) => ({
      key: s.key,
      label: s.label,
      value: s.source === "LIVE" && s.metric ? new Intl.NumberFormat("fr-FR").format(await liveMetric(s.metric, db)).replace(/ /g, " ") : (s.manualValue ?? "—"),
      isDemo: s.source === "MANUAL" && s.isDemo,
      source: s.source,
    })),
  );
}

export async function publicTestimonials(db: Db = prisma) {
  return db.testimonial.findMany({ where: { isVisible: true }, orderBy: { sortOrder: "asc" } });
}

export async function publicPartners(db: Db = prisma) {
  return db.partner.findMany({ where: { isVisible: true }, orderBy: { sortOrder: "asc" } });
}

export async function publicFaq(category?: string, db: Db = prisma) {
  return db.faqItem.findMany({ where: { isVisible: true, ...(category ? { category } : {}) }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }] });
}

export async function submitContact(input: { name: string; email: string; company: string | null; subject: string; message: string }, db: Db = prisma) {
  const req = await db.contactRequest.create({ data: input });
  await queueEmail(process.env.CONTACT_INBOX ?? "contact@talentbridge.africa", `[Contact] ${input.subject}`, `De : ${input.name} <${input.email}> ${input.company ? `(${input.company})` : ""}\n\n${input.message}`, db);
  return req;
}
