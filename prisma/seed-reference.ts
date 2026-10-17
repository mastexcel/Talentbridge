/** Chargement idempotent des référentiels (utilisé par le seed et les tests d'intégration). */
import type { PrismaClient } from "@prisma/client";
import * as R from "./reference-data";

export async function seedReference(prisma: PrismaClient, log = true) {
  for (const c of R.CURRENCIES) await prisma.currency.upsert({ where: { code: c.code }, create: c, update: { name: c.name, symbol: c.symbol, minorUnits: c.minorUnits } });
  for (const { vatBps, ...c } of R.COUNTRIES) {
    await prisma.country.upsert({ where: { code: c.code }, create: c, update: c });
    if (vatBps && !(await prisma.taxRate.findFirst({ where: { countryCode: c.code, isDefault: true } }))) {
      await prisma.taxRate.create({ data: { countryCode: c.code, name: `TVA ${vatBps / 100} %`, rateBps: vatBps, isDefault: true } });
    }
  }
  const domainIds: Record<string, string> = {};
  for (const [i, d] of R.DOMAINS.entries()) domainIds[d.slug] = (await prisma.expertiseDomain.upsert({ where: { slug: d.slug }, create: { ...d, sortOrder: i }, update: { nameFr: d.nameFr, nameEn: d.nameEn } })).id;
  for (const s of R.SKILLS) {
    const data = { nameFr: s.nameFr, nameEn: s.nameEn, domainId: domainIds[s.domain], synonyms: s.synonyms ?? [] };
    await prisma.skill.upsert({ where: { slug: s.slug }, create: { slug: s.slug, ...data }, update: data });
  }
  for (const b of R.BADGES) await prisma.badge.upsert({ where: { code: b.code }, create: b, update: b });
  for (const f of R.FEATURES) await prisma.feature.upsert({ where: { code: f.code }, create: f, update: { name: f.name } });
  // Offres : créées une seule fois (l'administrateur les fait ensuite évoluer sans être écrasé).
  for (const p of R.PLANS) {
    if (await prisma.subscriptionPlan.findUnique({ where: { code: p.code } })) continue;
    const plan = await prisma.subscriptionPlan.create({ data: { code: p.code, name: p.name, audience: p.audience, description: p.description, isRecurring: p.isRecurring, highlight: p.highlight ?? false, sortOrder: p.sortOrder, prices: { create: p.prices } } });
    for (const [code, limit] of Object.entries(p.features)) {
      const feature = await prisma.feature.findUniqueOrThrow({ where: { code } });
      await prisma.planFeature.create({ data: { planId: plan.id, featureId: feature.id, limit } });
    }
  }
  for (const t of R.NOTIFICATION_TEMPLATES) await prisma.notificationTemplate.upsert({ where: { type_channel_locale: { type: t.type, channel: t.channel, locale: "fr" } }, create: { ...t, locale: "fr" }, update: {} });
  for (const b of R.CONTENT_BLOCKS) await prisma.contentBlock.upsert({ where: { key_locale: { key: b.key, locale: "fr" } }, create: { ...b, locale: "fr" }, update: {} });
  if ((await prisma.faqItem.count()) === 0) await prisma.faqItem.createMany({ data: R.FAQ.map((f, i) => ({ ...f, sortOrder: i })) });
  for (const s of R.PUBLIC_STATS) await prisma.publicStat.upsert({ where: { key: s.key }, create: { ...s, source: "LIVE" }, update: {} });
  if ((await prisma.communityGroup.count()) === 0) {
    await prisma.communityGroup.createMany({
      data: [
        { slug: "suivi-evaluation", name: "Suivi-évaluation", description: "Méthodes, outils et retours d'expérience en S&E." },
        { slug: "climat-energie", name: "Climat & énergie", description: "Transition énergétique et adaptation au changement climatique." },
        { slug: "digital-afrique", name: "Digital Afrique", description: "Transformation digitale, data et innovation." },
        { slug: "appels-offres", name: "Appels d'offres & consortiums", description: "Partage d'opportunités et constitution de groupements." },
      ],
    });
  }
  if (log) console.log("✔ Référentiels chargés");
}

