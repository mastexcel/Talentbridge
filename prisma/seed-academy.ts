/**
 * Catalogue de démonstration de la Talent Bridge Academy : formations et séminaires fictifs,
 * tous marqués « [démo] » et `isDemo`, de chaque format (en ligne, classe virtuelle, présentiel,
 * hybride), avec des sessions datées. Idempotent (clé : slug), donc rejouable sur une base existante.
 * Jamais exécuté en production (appelé uniquement par le seed de démonstration).
 */
import type { PrismaClient } from "@prisma/client";
import { ensureDemoCertificateParties } from "./seed-certificates";

const at = (days: number, hour = 8) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
};

type Session = { title: string; days: number; hour?: number; durationMin: number; mode: "VIRTUAL" | "IN_PERSON"; venue?: string; city?: string; countryCode?: string; capacity?: number; taken?: number };
type Def = {
  slug: string;
  title: string;
  summary: string;
  description: string;
  audience: string;
  kind: "TRAINING" | "SEMINAR";
  format: "ONLINE" | "VIRTUAL_CLASS" | "IN_PERSON" | "BLENDED";
  domain: string;
  level: string;
  durationHours: number;
  priceMinor: number;
  lessons?: [string, string][];
  sessions?: Session[];
};

const DEFS: Def[] = [
  {
    slug: "seminaire-financement-climat-demo",
    title: "Séminaire régional : financement climatique et montage de projets [démo]",
    summary: "Deux jours pour comprendre les guichets de la finance climat et structurer une note conceptuelle solide — séminaire fictif.",
    description: "Programme fictif de démonstration.\n\n- Panorama des fonds climat et de leurs critères\n- Atelier : de l'idée de projet à la note conceptuelle\n- Études de cas et échanges entre pairs",
    audience: "Experts environnement et énergie, chargés de projets d'ONG et d'institutions publiques.",
    kind: "SEMINAR",
    format: "IN_PERSON",
    domain: "environnement",
    level: "INTERMEDIATE",
    durationHours: 14,
    priceMinor: 150_000,
    sessions: [
      { title: "Session d'Abidjan", days: 21, durationMin: 840, mode: "IN_PERSON", venue: "Centre de conférences (fictif)", city: "Abidjan", countryCode: "CI", capacity: 40, taken: 6 },
      { title: "Session de Dakar", days: 49, durationMin: 840, mode: "IN_PERSON", venue: "Hôtel partenaire (fictif)", city: "Dakar", countryCode: "SN", capacity: 30, taken: 2 },
    ],
  },
  {
    slug: "seminaire-genre-inclusion-demo",
    title: "Séminaire en ligne : genre et inclusion dans les projets de développement [démo]",
    summary: "Une demi-journée d'échanges sur l'intégration du genre de la conception au suivi des projets — séminaire fictif gratuit.",
    description: "Programme fictif de démonstration : cadres de référence, indicateurs sensibles au genre, retours d'expérience.",
    audience: "Ouvert à tous : experts, étudiants, agents de projets et de collectivités.",
    kind: "SEMINAR",
    format: "VIRTUAL_CLASS",
    domain: "gouvernance",
    level: "BEGINNER",
    durationHours: 4,
    priceMinor: 0,
    sessions: [{ title: "Séminaire en direct", days: 10, hour: 10, durationMin: 240, mode: "VIRTUAL", capacity: 200, taken: 4 }],
  },
  {
    slug: "gestion-projet-agile-demo",
    title: "Gestion de projet agile pour les équipes de développement [démo]",
    summary: "Planifier par itérations, piloter avec des tableaux visuels et rendre compte aux bailleurs — formation fictive en classe virtuelle.",
    description: "Formation fictive de démonstration : trois demi-journées en direct, complétées de leçons en ligne.",
    audience: "Chefs de projet, coordonnateurs et consultants qui pilotent des équipes.",
    kind: "TRAINING",
    format: "BLENDED",
    domain: "gouvernance",
    level: "INTERMEDIATE",
    durationHours: 12,
    priceMinor: 60_000,
    lessons: [["Les principes de l'agilité", "Itérations courtes, priorisation et amélioration continue (contenu fictif)."], ["Le tableau Kanban", "Visualiser le flux de travail et limiter les tâches en cours (contenu fictif)."]],
    sessions: [
      { title: "Classe virtuelle — cohorte 1", days: 15, hour: 9, durationMin: 600, mode: "VIRTUAL", capacity: 25, taken: 3 },
      { title: "Présentiel — cohorte de Douala", days: 35, durationMin: 720, mode: "IN_PERSON", venue: "Salle de formation (fictive)", city: "Douala", countryCode: "CM", capacity: 20 },
    ],
  },
  {
    slug: "initiation-analyse-donnees-demo",
    title: "Initiation à l'analyse de données avec un tableur [démo]",
    summary: "Nettoyer, analyser et présenter des données pas à pas — formation fictive en ligne, gratuite, pour débuter.",
    description: "Formation fictive de démonstration, à suivre à votre rythme.",
    audience: "Débutants : étudiants, jeunes diplômés, personnes en reconversion.",
    kind: "TRAINING",
    format: "ONLINE",
    domain: "digital",
    level: "BEGINNER",
    durationHours: 5,
    priceMinor: 0,
    lessons: [["Organiser ses données", "Une ligne par observation, une colonne par variable (contenu fictif)."], ["Tableaux croisés", "Résumer et comparer des données en quelques clics (contenu fictif)."], ["Présenter ses résultats", "Choisir le bon graphique pour son message (contenu fictif)."]],
  },
];

export async function ensureDemoAcademyCatalogue(prisma: PrismaClient, log = true) {
  const parties = await ensureDemoCertificateParties(prisma);
  const trainerOrg = await prisma.organization.findFirst({ where: { isDemo: true, type: "TRAINING_PROVIDER" }, include: { members: { where: { role: "OWNER" }, take: 1 } } });
  if (!parties || !trainerOrg?.members[0]) return;
  const instructorId = trainerOrg.members[0].userId;
  const domains = Object.fromEntries((await prisma.expertiseDomain.findMany({ select: { slug: true, id: true } })).map((d) => [d.slug, d.id]));
  const learners = await prisma.user.findMany({ where: { isDemo: true, expertProfile: { isNot: null } }, orderBy: { createdAt: "asc" }, skip: 1, take: 8, select: { id: true } });

  // Cours de démonstration déjà présents : thématique et public visé.
  await prisma.course.updateMany({ where: { isDemo: true, title: { startsWith: "Fondamentaux du suivi-évaluation" } }, data: { domainId: domains["suivi-evaluation"] ?? null, audience: "Experts et agents de projets qui débutent en suivi-évaluation." } });
  await prisma.course.updateMany({ where: { isDemo: true, slug: "passation-marches-bailleurs-demo" }, data: { domainId: domains["finance"] ?? null, audience: "Responsables des marchés, consultants et agents d'unités de gestion de projets." } });

  let created = 0;
  for (const d of DEFS) {
    if (await prisma.course.findUnique({ where: { slug: d.slug } })) continue;
    const course = await prisma.course.create({
      data: {
        slug: d.slug, title: d.title, summary: d.summary, description: d.description, audience: d.audience, kind: d.kind, format: d.format, level: d.level,
        durationHours: d.durationHours, priceMinor: d.priceMinor, currency: "XOF", status: "PUBLISHED", isDemo: true, domainId: domains[d.domain] ?? null,
        instructorId, providerOrgId: trainerOrg.id, issuerId: parties.issuerId, tbSignatoryId: parties.tbSignatoryId,
        ...(d.lessons ? { modules: { create: { title: "Module 1", lessons: { create: d.lessons.map(([title, content], position) => ({ title, content, position })) } } } } : {}),
      },
    });
    for (const s of d.sessions ?? []) {
      const { days, hour, taken = 0, ...rest } = s;
      const session = await prisma.liveSession.create({ data: { courseId: course.id, ...rest, startsAt: at(days, hour) } });
      // Quelques inscriptions fictives pour illustrer le décompte des places.
      for (const l of learners.slice(0, taken)) await prisma.enrollment.create({ data: { courseId: course.id, userId: l.id, sessionId: session.id, status: "ACTIVE" } }).catch(() => undefined);
    }
    created++;
  }
  if (log) console.log(`✔ Academy : ${created} formation(s) et séminaire(s) de démonstration ajoutés`);
}
