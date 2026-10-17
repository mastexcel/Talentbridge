/**
 * Seed Talent Bridge.
 *  1. Référentiels (toujours, idempotent).
 *  2. Démonstration (uniquement si DEMO_SEED=true ou hors production) : données FICTIVES,
 *     toutes marquées isDemo, adresses en @demo.talentbridge.africa.
 *     Les comptes administrateurs de démo ne sont JAMAIS créés en production.
 * Les scénarios passent par les services applicatifs (mêmes règles métier qu'en réel).
 */
import "dotenv/config";
import { PrismaClient, type Prisma } from "@prisma/client";
import { hashPassword } from "../src/infrastructure/auth/password";
import * as R from "./reference-data";

const prisma = new PrismaClient();

async function seedReference() {
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
  console.log("✔ Référentiels chargés");
}

// ─────────────────────────────────────────────────────────────
// Démonstration
// ─────────────────────────────────────────────────────────────

/** Générateur pseudo-aléatoire déterministe (seed reproductible). */
let state = 42;
const rand = () => ((state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
const pickN = <T,>(a: readonly T[], n: number) => [...a].sort(() => rand() - 0.5).slice(0, n);
const between = (min: number, max: number) => Math.floor(min + rand() * (max - min + 1));
const DAY = 86_400_000;
const daysFromNow = (d: number) => new Date(Date.now() + d * DAY);

const PEOPLE: { first: string; last: string; country: string; city: string }[] = [
  { first: "Aminata", last: "Koné", country: "CI", city: "Abidjan" },
  { first: "Yao", last: "Kouassi", country: "CI", city: "Abidjan" },
  { first: "Fatou", last: "Diallo", country: "SN", city: "Dakar" },
  { first: "Moussa", last: "Ndiaye", country: "SN", city: "Thiès" },
  { first: "Awa", last: "Ouédraogo", country: "BF", city: "Ouagadougou" },
  { first: "Ibrahim", last: "Traoré", country: "ML", city: "Bamako" },
  { first: "Grâce", last: "Hounkpatin", country: "BJ", city: "Cotonou" },
  { first: "Komlan", last: "Agbeko", country: "TG", city: "Lomé" },
  { first: "Kwame", last: "Mensah", country: "GH", city: "Accra" },
  { first: "Ngozi", last: "Okafor", country: "NG", city: "Lagos" },
  { first: "Paul", last: "Mbarga", country: "CM", city: "Douala" },
  { first: "Sylvie", last: "Ndong", country: "GA", city: "Libreville" },
  { first: "Jean-Pierre", last: "Kabila", country: "CD", city: "Kinshasa" },
  { first: "Aline", last: "Uwase", country: "RW", city: "Kigali" },
  { first: "Wanjiru", last: "Kamau", country: "KE", city: "Nairobi" },
  { first: "Youssef", last: "El Amrani", country: "MA", city: "Casablanca" },
  { first: "Mariam", last: "Bamba", country: "CI", city: "Bouaké" },
  { first: "Serge", last: "Yapi", country: "CI", city: "Yamoussoukro" },
  { first: "Adama", last: "Sawadogo", country: "BF", city: "Bobo-Dioulasso" },
  { first: "Khady", last: "Sow", country: "SN", city: "Saint-Louis" },
  { first: "Oumar", last: "Coulibaly", country: "ML", city: "Ségou" },
  { first: "Esther", last: "Adjovi", country: "BJ", city: "Porto-Novo" },
  { first: "Hervé", last: "Tchoffo", country: "CM", city: "Yaoundé" },
  { first: "Nadia", last: "Bensaïd", country: "MA", city: "Rabat" },
  { first: "Christelle", last: "Gnahoré", country: "CI", city: "San-Pédro" },
  { first: "Abdoulaye", last: "Diop", country: "SN", city: "Dakar" },
  { first: "Rokia", last: "Keïta", country: "ML", city: "Bamako" },
  { first: "Emmanuel", last: "Asante", country: "GH", city: "Kumasi" },
  { first: "Prisca", last: "Mukeshimana", country: "RW", city: "Kigali" },
  { first: "Didier", last: "Zadi", country: "CI", city: "Abidjan" },
];

const PROFILES: { headline: string; domain: string; skills: string[] }[] = [
  { headline: "Expert en suivi-évaluation de programmes de développement", domain: "suivi-evaluation", skills: ["suivi-evaluation", "cadre-logique", "enquetes", "gestion-projet"] },
  { headline: "Ingénieur génie civil — contrôle et supervision de travaux", domain: "btp", skills: ["genie-civil", "controle-travaux", "etudes-faisabilite", "passation-marches"] },
  { headline: "Auditeur financier et gestionnaire de projets financés par bailleurs", domain: "finance", skills: ["audit-financier", "gestion-financiere", "passation-marches"] },
  { headline: "Spécialiste sauvegardes environnementales et sociales (EIES)", domain: "environnement", skills: ["eies", "changement-climatique", "genre-inclusion"] },
  { headline: "Consultante en transformation digitale du secteur public", domain: "digital", skills: ["transformation-digitale", "developpement-web", "gestion-projet", "cybersecurite"] },
  { headline: "Data scientist — systèmes d'information et analyse de données", domain: "digital", skills: ["data-science", "enquetes", "systemes-information-sanitaire"] },
  { headline: "Médecin de santé publique, expert systèmes de santé", domain: "sante", skills: ["sante-publique", "systemes-information-sanitaire", "suivi-evaluation"] },
  { headline: "Agronome spécialiste des chaînes de valeur", domain: "agriculture", skills: ["agronomie", "chaines-de-valeur", "irrigation", "genre-inclusion"] },
  { headline: "Ingénieur en énergies renouvelables et mini-réseaux solaires", domain: "energie", skills: ["energies-renouvelables", "efficacite-energetique", "etudes-faisabilite"] },
  { headline: "Expert en gouvernance locale et décentralisation", domain: "gouvernance", skills: ["decentralisation", "politiques-publiques", "renforcement-capacites"] },
  { headline: "Ingénieure pédagogique — formation de formateurs", domain: "education", skills: ["ingenierie-pedagogique", "renforcement-capacites", "communication"] },
  { headline: "Spécialiste passation des marchés (procédures Banque mondiale, BAD)", domain: "gouvernance", skills: ["passation-marches", "gestion-financiere", "gestion-projet"] },
];

const BIO = (h: string, years: number) =>
  `${h}. ${years} années d'expérience auprès d'institutions publiques, d'ONG et de partenaires techniques et financiers. Interventions en Afrique de l'Ouest et du Centre, en français et en anglais. [Profil fictif de démonstration]`;

async function upsertUser(email: string, data: { firstName: string; lastName: string; password: string; platformRole?: "ADMIN"; adminPermissions?: Prisma.UserCreateInput["adminPermissions"]; phone?: string }) {
  const passwordHash = await hashPassword(data.password);
  return prisma.user.upsert({
    where: { email },
    create: { email, passwordHash, firstName: data.firstName, lastName: data.lastName, phone: data.phone, emailVerifiedAt: new Date(), isDemo: true, platformRole: data.platformRole ?? "USER", adminPermissions: data.adminPermissions ?? [], consents: { create: [{ type: "TERMS", granted: true, version: "2026-10" }, { type: "PRIVACY", granted: true, version: "2026-10" }] } },
    update: { passwordHash },
  });
}

async function seedDemo() {
  if (await prisma.user.findUnique({ where: { email: "consultant@demo.talentbridge.africa" } })) {
    console.log("ℹ Données de démonstration déjà présentes (mot de passe resynchronisé).");
    const hash = await hashPassword(process.env.DEMO_PASSWORD ?? "Demo2026!TB");
    await prisma.user.updateMany({ where: { isDemo: true }, data: { passwordHash: hash } });
    return;
  }
  const services = {
    verification: await import("../src/application/verification.service"),
    mission: await import("../src/application/mission.service"),
    matching: await import("../src/application/matching.service"),
    project: await import("../src/application/project.service"),
    billing: await import("../src/application/billing.service"),
    auth: await import("../src/application/auth.service"),
    expert: await import("../src/application/expert.service"),
    academy: await import("../src/application/academy.service"),
  };
  const password = process.env.DEMO_PASSWORD ?? "Demo2026!TB";
  const isProd = process.env.NODE_ENV === "production";
  const skills = Object.fromEntries((await prisma.skill.findMany()).map((s) => [s.slug, s.id]));
  const domains = Object.fromEntries((await prisma.expertiseDomain.findMany()).map((d) => [d.slug, d.id]));
  const session = async (userId: string) => (await services.auth.getUserBySessionToken(await services.auth.createSession(userId)))!;

  // ── Comptes plateforme (jamais en production)
  let admin = null;
  let verifier = null;
  if (!isProd) {
    admin = await upsertUser("admin@demo.talentbridge.africa", { firstName: "Admin", lastName: "Démo", password, platformRole: "ADMIN", adminPermissions: ["SUPER_ADMIN"] });
    await upsertUser("ceo@demo.talentbridge.africa", { firstName: "Direction", lastName: "Générale", password, platformRole: "ADMIN", adminPermissions: ["ANALYTICS_VIEW", "FINANCE_MANAGE", "AUDIT_VIEW"] });
    verifier = await upsertUser("verificateur@demo.talentbridge.africa", { firstName: "Vérificateur", lastName: "Démo", password, platformRole: "ADMIN", adminPermissions: ["EXPERTS_VERIFY", "ORGS_VALIDATE"] });
  }

  // ── Experts
  const experts: { userId: string; expertId: string; profileIdx: number }[] = [];
  for (const [i, p] of PEOPLE.entries()) {
    const email = i === 0 ? "consultant@demo.talentbridge.africa" : `expert${i}@demo.talentbridge.africa`;
    const user = await upsertUser(email, { firstName: p.first, lastName: p.last, password, phone: `+000 00 00 ${String(i).padStart(2, "0")}` });
    const prof = PROFILES[i % PROFILES.length];
    const years = between(4, 22);
    const slug = `${p.first}-${p.last}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
    const otherCountries = pickN(R.COUNTRIES.map((c) => c.code).filter((c) => c !== p.country), between(0, 4));
    const rate = between(8, 45) * 10_000;
    const expert = await prisma.expertProfile.create({
      data: {
        userId: user.id, slug, headline: prof.headline, bio: BIO(prof.headline, years), countryCode: p.country, city: p.city, yearsExperience: years,
        languages: rand() > 0.4 ? ["fr", "en"] : ["fr"], availability: pick(["AVAILABLE", "AVAILABLE", "PARTIAL", "UNAVAILABLE"] as const),
        mobility: pick(["NATIONAL", "REGIONAL", "INTERNATIONAL"] as const), remoteOk: rand() > 0.2, mobilityCountries: otherCountries,
        dailyRateMinor: rate, rateCurrency: "XOF", visibility: "PUBLIC", isDemo: true,
        domains: { create: [{ domainId: domains[prof.domain] }] },
        skills: { create: prof.skills.map((s, k) => ({ skillId: skills[s], level: Math.max(2, 5 - k + between(-1, 0)), years: Math.max(1, years - k * 2) })) },
        experiences: { create: [
          { title: "Consultant principal", employer: "Cabinet fictif Démo Conseil", countryCode: p.country, startDate: new Date(2019, 0, 1), description: "Missions d'appui technique (expérience fictive de démonstration)." },
          { title: "Chargé de programme", employer: "ONG fictive Démo Développement", countryCode: pick(R.COUNTRIES).code, startDate: new Date(2013, 5, 1), endDate: new Date(2018, 11, 31) },
        ] },
        qualifications: { create: [{ kind: "DEGREE", title: pick(["Master en économie du développement", "Diplôme d'ingénieur", "Master en santé publique", "MBA", "Master en gestion de projets"]), institution: "Université fictive de démonstration", year: 2026 - years - between(1, 3) }] },
        references: { create: [
          { contactName: "Référent fictif A", contactOrg: "Organisation fictive A", contactEmail: "referent.a@demo.talentbridge.africa", missionTitle: "Évaluation à mi-parcours (fictive)", year: 2024 },
          { contactName: "Référent fictif B", contactOrg: "Organisation fictive B", contactEmail: "referent.b@demo.talentbridge.africa", missionTitle: "Appui technique (fictif)", year: 2023 },
        ] },
        portfolio: rand() > 0.5 ? { create: [{ title: "Rapport de synthèse (fictif)", description: "Exemple de livrable — démonstration.", year: 2025 }] } : undefined,
        availabilitySlots: rand() > 0.6 ? { create: [{ startDate: daysFromNow(between(10, 30)), endDate: daysFromNow(between(35, 60)), kind: "BOOKED", note: "Mission en cours (fictive)" }] } : undefined,
      },
    });
    await services.expert.recomputeCompleteness(expert.id);
    experts.push({ userId: user.id, expertId: expert.id, profileIdx: i % PROFILES.length });
  }
  console.log(`✔ ${experts.length} experts fictifs`);

  // ── Vérifications (via le vrai parcours : soumission → contrôles → décision humaine)
  if (verifier && admin) {
    const verifierSession = await session(verifier.id);
    for (const e of experts.slice(0, 14)) {
      const uSession = await session(e.userId);
      const types = e === experts[0] ? (["IDENTITY", "DOCUMENTS"] as const) : (["IDENTITY"] as const);
      for (const type of types) {
        const req = await services.verification.getOrCreateRequest(e.expertId, type);
        const file = await prisma.storedFile.create({ data: { ownerUserId: e.userId, storageKey: `demo/${e.expertId}-${type}.pdf`, filename: `justificatif-${type.toLowerCase()}-fictif.pdf`, mimeType: "application/pdf", sizeBytes: 1024, sha256: "demo", purpose: "VERIFICATION" } });
        await services.verification.addDocument(uSession, e.expertId, req.id, file.id, type === "IDENTITY" ? "ID_CARD" : "DIPLOMA", "Pièce fictive de démonstration");
        await services.verification.submitRequest(uSession, e.expertId, req.id);
        if (e === experts[13]) continue; // laissée en attente : file d'attente du vérificateur
        await services.verification.decide(verifierSession, req.id, "START_REVIEW", null);
        if (type === "IDENTITY") {
          await services.verification.recordCheck(verifierSession, req.id, { step: "COMPLETENESS", result: "PASS", note: "Démo" });
          await services.verification.recordCheck(verifierSession, req.id, { step: "ADMINISTRATIVE", result: "PASS", note: "Démo" });
        } else {
          for (const ref of await prisma.expertReference.findMany({ where: { expertId: e.expertId } })) await services.verification.verifyProfileItem(verifierSession, "reference", ref.id, true);
          await services.verification.recordCheck(verifierSession, req.id, { step: "COMPLETENESS", result: "PASS", note: "Démo" });
          await services.verification.recordCheck(verifierSession, req.id, { step: "DIPLOMAS", result: "PASS", note: "Démo" });
          await services.verification.recordCheck(verifierSession, req.id, { step: "REFERENCES", result: "PASS", note: "Démo" });
        }
        await services.verification.decide(verifierSession, req.id, "APPROVE", "Vérification de démonstration");
      }
    }
    console.log("✔ Vérifications de démonstration (parcours complet)");
  }

  // ── Organisations
  const orgDefs = [
    { email: "cabinet@demo.talentbridge.africa", first: "Koffi", last: "Assi", name: "Démo Conseil Afrique (fictif)", type: "CONSULTING_FIRM" as const, country: "CI", city: "Abidjan" },
    { email: "entreprise@demo.talentbridge.africa", first: "Marie", last: "Kacou", name: "Démo Industries SA (fictif)", type: "COMPANY" as const, country: "CI", city: "Abidjan" },
    { email: "ong@demo.talentbridge.africa", first: "Ousmane", last: "Fall", name: "ONG Démo Solidarité (fictive)", type: "NGO" as const, country: "SN", city: "Dakar" },
    { email: "institution@demo.talentbridge.africa", first: "Hélène", last: "Zongo", name: "Agence publique Démo (fictive)", type: "INSTITUTION" as const, country: "BF", city: "Ouagadougou" },
    { email: "formation@demo.talentbridge.africa", first: "Rachid", last: "Benali", name: "Institut Démo Formation (fictif)", type: "TRAINING_PROVIDER" as const, country: "MA", city: "Rabat" },
  ];
  const orgs: { id: string; ownerId: string; name: string }[] = [];
  for (const o of orgDefs) {
    const owner = await upsertUser(o.email, { firstName: o.first, lastName: o.last, password });
    const org = await prisma.organization.create({ data: { name: o.name, slug: o.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/-+$/, ""), type: o.type, countryCode: o.country, city: o.city, status: "VERIFIED", verifiedAt: new Date(), registrationNumber: "RCCM-DEMO-0000", taxId: "NCC-DEMO", sector: "Démonstration", contactName: `${o.first} ${o.last}`, contactEmail: o.email, isDemo: true, members: { create: { userId: owner.id, role: "OWNER" } } } });
    orgs.push({ id: org.id, ownerId: owner.id, name: o.name });
  }
  // Collaborateurs du cabinet (rôles différents) et organisation multi-appartenance
  const recruiter = await upsertUser("recruteur@demo.talentbridge.africa", { firstName: "Bintou", lastName: "Camara", password });
  await prisma.organizationMember.create({ data: { organizationId: orgs[0].id, userId: recruiter.id, role: "RECRUITER" } });
  await prisma.organizationMember.create({ data: { organizationId: orgs[2].id, userId: recruiter.id, role: "VIEWER" } });
  const pending = await upsertUser("nouvelle-orga@demo.talentbridge.africa", { firstName: "Patrice", lastName: "Gbagbo-Démo", password });
  await prisma.organization.create({ data: { name: "PME Démo en attente (fictive)", slug: "pme-demo-en-attente", type: "COMPANY", countryCode: "CI", status: "PENDING", isDemo: true, members: { create: { userId: pending.id, role: "OWNER" } } } });
  console.log("✔ Organisations fictives");

  // ── Missions (créées et publiées via le service)
  const missionDefs = [
    { org: 2, title: "Évaluation finale d'un programme de sécurité alimentaire", domain: "suivi-evaluation", req: [["suivi-evaluation", true], ["enquetes", false], ["cadre-logique", false]], country: "SN", mode: "HYBRID", days: 45, budget: [8_000_000, 12_000_000] },
    { org: 0, title: "Chef de mission — contrôle de travaux routiers", domain: "btp", req: [["controle-travaux", true], ["genie-civil", true], ["passation-marches", false]], country: "CI", mode: "ONSITE", days: 180, budget: [30_000_000, 45_000_000] },
    { org: 1, title: "Audit financier d'un projet cofinancé", domain: "finance", req: [["audit-financier", true], ["gestion-financiere", false]], country: "CI", mode: "ONSITE", days: 20, budget: [4_000_000, 6_000_000] },
    { org: 3, title: "Feuille de route de transformation digitale de l'agence", domain: "digital", req: [["transformation-digitale", true], ["gestion-projet", false], ["cybersecurite", false]], country: "BF", mode: "HYBRID", days: 60, budget: [15_000_000, 20_000_000] },
    { org: 2, title: "Étude d'impact environnemental et social — mini-réseaux solaires", domain: "environnement", req: [["eies", true], ["energies-renouvelables", false]], country: "SN", mode: "ONSITE", days: 40, budget: [7_000_000, 10_000_000] },
    { org: 0, title: "Expert en passation des marchés (procédures bailleurs)", domain: "gouvernance", req: [["passation-marches", true], ["gestion-financiere", false]], country: "CI", mode: "REMOTE", days: 30, budget: [3_000_000, 5_000_000] },
    { org: 3, title: "Formation de formateurs en ingénierie pédagogique", domain: "education", req: [["ingenierie-pedagogique", true], ["renforcement-capacites", false]], country: "BF", mode: "ONSITE", days: 15, budget: [2_500_000, 4_000_000] },
    { org: 1, title: "Tableau de bord data pour la direction commerciale", domain: "digital", req: [["data-science", true], ["developpement-web", false]], country: "CI", mode: "REMOTE", days: 35, budget: [5_000_000, 8_000_000] },
  ] as const;
  const missions: { id: string; orgIdx: number }[] = [];
  for (const [i, m] of missionDefs.entries()) {
    const owner = await session(orgs[m.org].ownerId);
    const mission = await services.mission.createMission(owner, orgs[m.org].id, {
      title: `${m.title} [démo]`,
      description: `Mission fictive de démonstration. ${m.title}. L'expert retenu interviendra en lien étroit avec l'équipe du commanditaire et produira des livrables intermédiaires et finaux validés.`,
      objectives: "Objectifs détaillés (fictifs) : diagnostic, recommandations, plan d'action.",
      expectedResults: "Rapport de démarrage, rapport intermédiaire, rapport final validé.",
      domainId: domains[m.domain], experienceYearsMin: between(5, 10), languages: ["fr"], countryCode: m.country, city: null, workMode: m.mode, durationDays: m.days,
      startDate: daysFromNow(between(20, 45)), budgetMin: m.budget[0], budgetMax: m.budget[1], currency: "XOF", applicationDeadline: daysFromNow(between(10, 30)), visibility: "PUBLIC",
      requirements: m.req.map(([s, mandatory]) => ({ skillId: skills[s], mandatory, minLevel: 3 })),
    });
    await prisma.mission.update({ where: { id: mission.id }, data: { isDemo: true } });
    if (i !== 7) await services.mission.changeMissionStatus(owner, mission.id, "PUBLISHED");
    missions.push({ id: mission.id, orgIdx: m.org });
  }
  // Publication antidatée pour illustrer le délai de matching
  for (const m of missions) await prisma.mission.updateMany({ where: { id: m.id, publishedAt: { not: null } }, data: { publishedAt: daysFromNow(-between(4, 20)) } });
  console.log(`✔ ${missions.length} missions (dont 1 brouillon)`);

  // ── Matching, candidatures, sélection, contrat, projet
  for (const m of missions.slice(0, 6)) await services.matching.runMatching(await session(orgs[m.orgIdx].ownerId), m.id);
  const scenario = missions[0];
  const ongOwner = await session(orgs[2].ownerId);
  const candidates = experts.filter((e) => [0, 6].includes(e.profileIdx)).slice(0, 4);
  const apps: string[] = [];
  for (const c of candidates) {
    const a = await services.mission.apply(await session(c.userId), scenario.id, { coverLetter: "Proposition technique fictive de démonstration : méthodologie d'évaluation mixte (quantitative et qualitative), plan de collecte et calendrier détaillé.", proposedRate: 250000, currency: "XOF", availableFrom: daysFromNow(25), technicalFileId: null, financialFileId: null });
    apps.push(a.id);
  }
  await services.mission.decideApplication(ongOwner, apps[0], "SHORTLISTED", "Profil très pertinent");
  await services.mission.decideApplication(ongOwner, apps[1], "SHORTLISTED", null);
  await services.mission.scheduleInterview(ongOwner, apps[0], { scheduledAt: daysFromNow(-1), durationMin: 45, mode: "VISIO", location: "Lien visio fictif", notes: null });
  await services.mission.decideApplication(ongOwner, apps[0], "SELECTED", "Retenu après entretien");
  if (apps[2]) await services.mission.decideApplication(ongOwner, apps[2], "REJECTED", null);
  const contract = await services.project.createContractFromApplication(ongOwner, apps[0], { amountMinor: 10_500_000, startDate: daysFromNow(5), endDate: daysFromNow(50), terms: "Conditions fictives de démonstration." });
  await services.project.transitionContract(ongOwner, contract.id, "SENT");
  const chosen = candidates[0];
  await services.project.transitionContract(await session(chosen.userId), contract.id, "SIGNED");
  await services.project.transitionContract(ongOwner, contract.id, "ACTIVE");
  const project = await services.project.createProject(ongOwner, orgs[2].id, { name: "Évaluation finale PSA — équipe projet [démo]", description: "Projet fictif de démonstration.", missionId: scenario.id, startDate: daysFromNow(5), endDate: daysFromNow(50) });
  await services.project.addProjectMember(ongOwner, project.id, { expertId: chosen.expertId, role: "LEAD", responsibilities: "Chef de mission, coordination et rapport final" });
  const lead = await session(chosen.userId);
  const tasks = [
    ["Rapport de démarrage", 10, true, "DONE"], ["Outils de collecte", 15, false, "IN_PROGRESS"], ["Collecte terrain", 30, false, "TODO"], ["Rapport provisoire", 40, true, "TODO"], ["Atelier de restitution", 45, false, "TODO"], ["Rapport final", 50, true, "TODO"],
  ] as const;
  for (const [title, due, deliverable] of tasks) await services.project.createTask(lead, project.id, { title, description: null, assigneeId: chosen.userId, startDate: daysFromNow(due - 8), dueDate: daysFromNow(due), isDeliverable: deliverable });
  const t1 = await prisma.projectTask.findFirstOrThrow({ where: { projectId: project.id, title: "Rapport de démarrage" } });
  const deliverableFile = await prisma.storedFile.create({ data: { ownerUserId: chosen.userId, storageKey: `demo/livrable-${project.id}.pdf`, filename: "rapport-demarrage-fictif.pdf", mimeType: "application/pdf", sizeBytes: 2048, sha256: "demo", purpose: "DELIVERABLE" } });
  await services.project.submitDeliverable(lead, t1.id, deliverableFile.id);
  await services.project.reviewDeliverable(ongOwner, t1.id, true, "Validé (démo)");
  await services.project.moveTask(lead, (await prisma.projectTask.findFirstOrThrow({ where: { projectId: project.id, title: "Outils de collecte" } })).id, "IN_PROGRESS");

  // Contrat terminé + évaluation (alimente la satisfaction du CEO dashboard)
  const cabinetOwner = await session(orgs[0].ownerId);
  const m2 = missions[5];
  const e2 = experts.find((e) => e.profileIdx === 11 || e.profileIdx === 2)!;
  const a2 = await services.mission.apply(await session(e2.userId), m2.id, { coverLetter: "Proposition fictive : appui à la passation des marchés selon les procédures des bailleurs, revue des dossiers d'appel d'offres.", proposedRate: 200000, currency: "XOF", availableFrom: null, technicalFileId: null, financialFileId: null });
  await services.mission.decideApplication(cabinetOwner, a2.id, "SELECTED", null);
  const c2 = await services.project.createContractFromApplication(cabinetOwner, a2.id, { amountMinor: 4_000_000, startDate: daysFromNow(-40), endDate: daysFromNow(-5), terms: null });
  await services.project.transitionContract(cabinetOwner, c2.id, "SENT");
  await services.project.transitionContract(await session(e2.userId), c2.id, "SIGNED");
  await services.project.transitionContract(cabinetOwner, c2.id, "ACTIVE");
  await services.project.transitionContract(cabinetOwner, c2.id, "COMPLETED");
  await services.project.reviewContract(cabinetOwner, c2.id, 5, "Excellent travail, livrables de grande qualité (évaluation fictive).");
  // Autres candidatures pour peupler les espaces
  for (const e of experts.slice(5, 12)) {
    const target = missions[between(1, 4)];
    await services.mission.apply(await session(e.userId), target.id, { coverLetter: "Candidature fictive de démonstration avec proposition technique synthétique et disponibilité confirmée.", proposedRate: null, currency: null, availableFrom: null, technicalFileId: null, financialFileId: null }).catch(() => undefined);
  }
  await services.mission.inviteExpert(await session(orgs[1].ownerId), missions[2].id, experts[0].expertId, "Votre profil correspond à notre besoin (invitation fictive).");
  console.log("✔ Candidatures, entretiens, contrats, projet et évaluations");

  // ── Abonnements et paiements SIMULÉS (prestataire mock, webhooks signés) — isTest
  const price = async (code: string, interval: "MONTH" | "YEAR" | "ONE_TIME") => (await prisma.planPrice.findFirstOrThrow({ where: { plan: { code }, interval, currency: "XOF" } })).id;
  const subscribeAndPay = async (userId: string, orgId: string | null, code: string, interval: "MONTH" | "YEAR" | "ONE_TIME", pay: boolean) => {
    if (orgId) await prisma.session.updateMany({ where: { userId }, data: { activeOrgId: orgId } });
    const s = await session(userId);
    const res = await services.billing.subscribe(s, { priceId: await price(code, interval), couponCode: null, method: "MOBILE_MONEY", payerPhone: null, forOrganization: !!orgId });
    if (pay && "paymentId" in res && res.paymentId) await services.billing.simulateMockPayment(s, res.paymentId, "SUCCEEDED");
  };
  await subscribeAndPay(orgs[0].ownerId, orgs[0].id, "ORG_BUSINESS", "MONTH", true);
  await subscribeAndPay(orgs[2].ownerId, orgs[2].id, "ORG_BUSINESS", "YEAR", true);
  await subscribeAndPay(orgs[1].ownerId, orgs[1].id, "ORG_STANDARD", "MONTH", true);
  await subscribeAndPay(orgs[3].ownerId, orgs[3].id, "SERVICE_SOURCING", "ONE_TIME", true);
  await subscribeAndPay(orgs[4].ownerId, orgs[4].id, "ORG_STANDARD", "MONTH", false); // facture en attente
  await subscribeAndPay(experts[0].userId, null, "EXPERT_PREMIUM", "MONTH", true);
  await subscribeAndPay(experts[3].userId, null, "EXPERT_PREMIUM", "YEAR", true);
  await prisma.invoice.updateMany({ data: { isDemo: true } });
  await prisma.subscription.updateMany({ data: { isDemo: true } });
  if ((await prisma.coupon.count()) === 0) await prisma.coupon.create({ data: { code: "BIENVENUE10", percentOffBps: 1000, maxRedemptions: 100, validUntil: daysFromNow(180) } });
  console.log("✔ Abonnements et paiements de TEST (aucun encaissement réel)");

  // ── Appels d'offres
  const tenderDefs = [
    { type: "EOI", title: "AMI — Recrutement d'un cabinet pour l'évaluation d'un programme d'emploi des jeunes", buyer: "Ministère fictif de l'Emploi", country: "CI", domain: "suivi-evaluation" },
    { type: "TENDER", title: "Appel d'offres — Contrôle et surveillance de travaux d'adduction d'eau", buyer: "Office fictif de l'hydraulique", country: "BF", domain: "btp" },
    { type: "EOI", title: "AMI — Assistance technique en transformation digitale des collectivités", buyer: "Agence fictive de développement local", country: "SN", domain: "digital" },
    { type: "RFP", title: "Demande de propositions — Étude de faisabilité de centrales solaires hybrides", buyer: "Bailleur fictif de l'énergie", country: "ML", domain: "energie" },
    { type: "TENDER", title: "Appel d'offres — Audit des comptes d'un projet de santé communautaire", buyer: "Programme fictif de santé", country: "CM", domain: "finance" },
    { type: "EOI", title: "AMI — Formation des agents en passation des marchés publics", buyer: "Autorité fictive des marchés publics", country: "BJ", domain: "gouvernance" },
  ];
  const tenderIds: string[] = [];
  for (const [i, t] of tenderDefs.entries()) {
    const tender = await prisma.tender.create({ data: { reference: `TB-AO-2026-${String(i + 1).padStart(5, "0")}`, type: t.type as "EOI", title: `${t.title} [démo]`, buyerName: t.buyer, countryCode: t.country, domainId: domains[t.domain], description: "Appel fictif de démonstration. Le dossier comprendra : lettre de manifestation d'intérêt, présentation du cabinet, références de missions similaires avec attestations de bonne exécution, CV des experts clés, attestation de régularité fiscale, registre de commerce et offre financière.", eligibility: "Cabinets ou groupements ; expérience d'au moins 3 missions similaires.", budgetMinor: between(20, 200) * 1_000_000, currency: "XOF", deadline: daysFromNow(between(8, 45)), isDemo: true } });
    tenderIds.push(tender.id);
  }
  const tenderMod = await import("../src/application/tender.service");
  const cabinet = await session(orgs[0].ownerId);
  const bid = await tenderMod.startBid(cabinet, tenderIds[0]);
  await tenderMod.extractBidRequirements(cabinet, bid.id, null);
  await tenderMod.addBidExpert(cabinet, bid.id, experts[0].expertId, "Chef d'équipe — évaluateur principal");
  await tenderMod.saveAlert(await session(experts[0].userId), { name: "S&E Afrique de l'Ouest", keywords: ["evaluation"], countryCodes: ["CI", "SN"], domainIds: [] });
  console.log("✔ Appels d'offres, dossier de candidature et alerte");

  // ── Academy
  const trainer = await session(orgs[4].ownerId);
  const course = await services.academy.createCourse(trainer, { title: "Fondamentaux du suivi-évaluation axé sur les résultats [démo]", summary: "Cadre logique, indicateurs SMART, plan de suivi et rapportage — cours fictif de démonstration.", description: "Contenu pédagogique fictif destiné à illustrer le fonctionnement de l'Academy.", level: "BEGINNER", durationHours: 6, price: 0, currency: "XOF", passingScore: 70 }).catch(async () => {
    // Le formateur de démo est un membre d'organisme de formation : création directe si le contrôle de rôle diffère.
    return prisma.course.create({ data: { slug: "fondamentaux-suivi-evaluation-demo", title: "Fondamentaux du suivi-évaluation axé sur les résultats [démo]", summary: "Cadre logique, indicateurs SMART, plan de suivi et rapportage — cours fictif.", level: "BEGINNER", durationHours: 6, instructorId: orgs[4].ownerId, providerOrgId: orgs[4].id } });
  });
  const lessons = [
    ["Module 1 — Concepts", "Résultats, effets et impacts", "La chaîne des résultats relie intrants, activités, produits, effets et impact."],
    ["Module 1 — Concepts", "Le cadre logique", "Le cadre logique organise objectifs, indicateurs, sources de vérification et hypothèses."],
    ["Module 2 — Indicateurs", "Construire des indicateurs SMART", "Spécifique, mesurable, atteignable, réaliste et temporellement défini."],
    ["Module 2 — Indicateurs", "Plan de suivi et rapportage", "Fréquence de collecte, responsabilités, outils et circuits de validation."],
  ];
  for (const [mod, title, content] of lessons) await services.academy.addLesson(trainer, course.id, { moduleTitle: mod, title, kind: "TEXT", content: `${content}\n\n(Contenu pédagogique fictif de démonstration.)`, videoUrl: null });
  await services.academy.setAssessment(trainer, course.id, "Évaluation finale", [
    { id: "q1", prompt: "Que relie la chaîne des résultats ?", options: ["Les budgets aux factures", "Les intrants à l'impact", "Les experts aux missions"], answer: 1 },
    { id: "q2", prompt: "Que signifie le « M » de SMART ?", options: ["Mesurable", "Modulable", "Mensuel"], answer: 0 },
    { id: "q3", prompt: "Où figurent les hypothèses ?", options: ["Dans le cadre logique", "Dans la facture", "Dans le CV"], answer: 0 },
  ]);
  await services.academy.setCourseStatus(trainer, course.id, "PUBLISHED");
  await prisma.course.update({ where: { id: course.id }, data: { isDemo: true } });
  const paid = await prisma.course.create({ data: { slug: "passation-marches-bailleurs-demo", title: "Passation des marchés selon les procédures des bailleurs [démo]", summary: "Méthodes, seuils et revue préalable — cours fictif payant.", level: "INTERMEDIATE", durationHours: 12, priceMinor: 45000, currency: "XOF", status: "PUBLISHED", instructorId: orgs[4].ownerId, providerOrgId: orgs[4].id, isDemo: true, modules: { create: { title: "Module 1", lessons: { create: { title: "Introduction", content: "Contenu fictif." } } } } } });
  void paid;
  // L'expert démo suit le cours gratuit jusqu'au certificat (conditions réellement vérifiées)
  const learner = await session(experts[0].userId);
  await services.academy.enroll(learner, course.id, null);
  for (const l of await prisma.lesson.findMany({ where: { module: { courseId: course.id } } })) await services.academy.completeLesson(learner, l.id);
  const assessment = await prisma.assessment.findFirstOrThrow({ where: { courseId: course.id } });
  await services.academy.submitAttempt(learner, assessment.id, { q1: 1, q2: 0, q3: 0 });
  const cert = await services.academy.claimCertificate(learner, course.id);
  await prisma.liveSession.create({ data: { courseId: course.id, title: "Session de questions-réponses (fictive)", startsAt: daysFromNow(12), joinUrl: null } });
  console.log(`✔ Academy (certificat vérifiable ${cert.code})`);

  // ── Communauté, mentorat, messagerie
  const groups = await prisma.communityGroup.findMany();
  for (const e of experts.slice(0, 8)) await prisma.groupMembership.create({ data: { groupId: pick(groups).id, userId: e.userId } }).catch(() => undefined);
  const posts = ["Retour d'expérience (fictif) : les enquêtes téléphoniques ont réduit nos coûts de collecte de 40 %.", "Qui a déjà travaillé avec des mini-réseaux solaires en zone sahélienne ? (publication fictive)", "Ressource utile : modèle de matrice de conformité pour AMI (publication fictive)."];
  for (const [i, body] of posts.entries()) {
    const post = await prisma.communityPost.create({ data: { authorId: experts[i].userId, body, groupId: groups[i % groups.length].id } });
    await prisma.postComment.create({ data: { postId: post.id, authorId: experts[i + 3].userId, body: "Merci pour ce partage (commentaire fictif)." } });
    await prisma.postReaction.create({ data: { postId: post.id, userId: experts[i + 4].userId } });
  }
  await prisma.communityEvent.create({ data: { title: "Webinaire : réussir ses candidatures aux AMI (fictif)", description: "Événement de démonstration.", startsAt: daysFromNow(9), location: "En ligne", isDemo: true } });
  await prisma.mentorship.create({ data: { mentorId: experts[1].userId, menteeId: experts[0].userId, topic: "Évoluer vers un rôle de chef de mission", message: "Demande fictive.", status: "ACCEPTED", respondedAt: new Date() } });
  const messaging = await import("../src/application/messaging.service");
  await messaging.startConversation(ongOwner, { expertId: experts[0].expertId, subject: "Démarrage de l'évaluation [démo]", body: "Bonjour, pouvons-nous caler la réunion de lancement la semaine prochaine ? (message fictif)" });
  console.log("✔ Communauté, mentorat et messagerie");

  // ── CRM (organisation interne Talent Bridge, isolée des autres)
  if (admin) {
    const tb = await prisma.organization.create({ data: { name: "Talent Bridge (équipe interne — démo)", slug: "talent-bridge-interne-demo", type: "CONSULTING_FIRM", countryCode: "CI", status: "VERIFIED", isDemo: true, members: { create: { userId: admin.id, role: "OWNER" } } } });
    const ent = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { code: "ORG_ENTERPRISE" }, include: { prices: true } });
    await prisma.subscription.create({ data: { planId: ent.id, priceId: ent.prices[0].id, organizationId: tb.id, status: "ACTIVE", currentPeriodStart: new Date(), currentPeriodEnd: daysFromNow(365), isDemo: true } });
    const stages = ["PROSPECT", "QUALIFIED", "NEED_IDENTIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"] as const;
    const prob = { PROSPECT: 10, QUALIFIED: 20, NEED_IDENTIFIED: 35, PROPOSAL: 50, NEGOTIATION: 75, WON: 100, LOST: 0 };
    for (let i = 0; i < 12; i++) {
      const contact = await prisma.crmContact.create({ data: { ownerOrgId: tb.id, firstName: pick(PEOPLE).first, lastName: pick(PEOPLE).last, companyName: `Client fictif ${i + 1}`, email: `client${i + 1}@demo.talentbridge.africa`, position: pick(["DG", "DRH", "Chargé de programme", "Directeur technique"]) } });
      const stage = stages[i % stages.length];
      const opp = await prisma.opportunity.create({ data: { ownerOrgId: tb.id, title: `${pick(["Sourcing", "Abonnement Business", "Accompagnement AO", "Équipe projet"])} — Client fictif ${i + 1}`, stage, valueMinor: between(5, 120) * 100_000, currency: "XOF", probabilityPct: prob[stage], contactId: contact.id, assigneeId: admin.id, expectedCloseDate: daysFromNow(between(5, 90)), lostReason: stage === "LOST" ? "Budget reporté (fictif)" : null, closedAt: stage === "WON" || stage === "LOST" ? new Date() : null } });
      await prisma.crmActivity.create({ data: { ownerOrgId: tb.id, opportunityId: opp.id, contactId: contact.id, userId: admin.id, kind: pick(["CALL", "MEETING", "EMAIL", "FOLLOW_UP"]), subject: "Relance commerciale (fictive)", dueAt: daysFromNow(between(-3, 10)) } });
    }
    await prisma.lead.createMany({ data: [1, 2, 3, 4].map((i) => ({ ownerOrgId: tb.id, companyName: `Prospect fictif ${i}`, contactName: `Contact ${i}`, source: pick(["Site web", "Salon", "Recommandation"]), countryCode: pick(["CI", "SN", "CM"]) })) });
    console.log("✔ CRM interne (démo)");
  }

  // ── Contenus publics démonstratifs (clairement marqués)
  await prisma.testimonial.createMany({ data: [
    { authorName: "Témoignage fictif", authorRole: "Directrice de programme", organization: "ONG de démonstration", quote: "Exemple de témoignage : en moins d'une semaine, nous avions trois profils vérifiés à rencontrer.", isDemo: true, isVerified: false, sortOrder: 1 },
    { authorName: "Témoignage fictif", authorRole: "Consultant senior", organization: null, quote: "Exemple de témoignage : le badge de vérification a donné du poids à mes candidatures.", isDemo: true, isVerified: false, sortOrder: 2 },
    { authorName: "Témoignage fictif", authorRole: "Associé, cabinet de conseil", organization: "Cabinet de démonstration", quote: "Exemple de témoignage : la matrice de conformité nous a fait gagner des jours sur nos AMI.", isDemo: true, isVerified: false, sortOrder: 3 },
  ] });
  await prisma.partner.createMany({ data: ["Partenaire démo A", "Partenaire démo B", "Partenaire démo C", "Partenaire démo D"].map((name, i) => ({ name, isDemo: true, sortOrder: i })) });
  await prisma.outboundMessage.updateMany({ data: { status: "SENT", sentAt: new Date() } }); // pas d'envoi réel des emails de démo
  await prisma.session.deleteMany({}); // sessions techniques du seed
  console.log("✔ Contenus démonstratifs");
}

async function main() {
  await seedReference();
  const demo = process.env.DEMO_SEED === "true" || process.env.NODE_ENV !== "production";
  if (demo) await seedDemo();
  else console.log("ℹ Production : aucune donnée de démonstration chargée.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
