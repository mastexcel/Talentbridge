/**
 * Catalogue des visuels officiels (public/visuels, fichiers fournis non modifiés) et des zones
 * qui les rendent interactifs. Coordonnées en pixels de l'image d'origine : [x, y, largeur, hauteur].
 * Les chiffres proviennent de publicFigures() (base de données), jamais du visuel.
 */
import type { PublicFigures } from "@/application/figures.service";
import type { Overlay, StatItem, VisualDef } from "./Visual";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/ | /g, " ");

const W = 1774;
const H = 887;

function networkStats(f: PublicFigures): StatItem[] {
  return [
    { icon: "users", color: "bordeaux", value: fmt(f.expertsVerified), label: "Experts vérifiés" },
    { icon: "building", color: "orange", value: fmt(f.organizations), label: "Organisations validées" },
    { icon: "missions", color: "olive", value: fmt(f.missionsCompleted), label: "Missions réalisées" },
    { icon: "globe", color: "bordeaux", value: fmt(f.countries), label: "Pays couverts" },
  ];
}

const DOMAIN_CHIPS: [string, string][] = [
  ["Agriculture", "agriculture"], ["BTP", "btp"], ["Finance", "finance"], ["Environnement", "environnement"], ["Digital", "digital"],
  ["Santé", "sante"], ["Éducation", "education"], ["Gouvernance", "gouvernance"], ["Énergie", "energie"],
];

export function visuals(f: PublicFigures) {
  const stats = networkStats(f);
  const demo = f.isDemo;
  const row = (box: Overlay["box"], font = 30, tone: "light" | "dark" | "band" = "light"): Overlay => ({ kind: "stats", box, items: stats, tone, font, demo });

  const defs = {
    accueilHero: {
      src: "/visuels/accueil-hero.png", width: W, height: H,
      alt: "Talent Bridge — Des experts d'aujourd'hui pour les défis de demain. La plateforme panafricaine qui connecte les experts, les organisations et les opportunités.",
      overlays: [
        { kind: "button", box: [43, 577, 270, 62], href: "/experts", label: "Trouver un expert", tone: "orange", font: 19 },
        { kind: "button", box: [327, 577, 274, 62], href: "/organisation/missions/nouvelle", label: "Publier une mission", tone: "outline", font: 19 },
        { kind: "stats", box: [22, 672, 572, 150], items: stats, tone: "dark", layout: "row", font: 26, demo },
      ],
    },
    plateforme: {
      src: "/visuels/plateforme.png", width: 1672, height: 941,
      alt: "Une plateforme panafricaine pour accéder aux meilleurs experts et talents.",
      overlays: [
        { kind: "search", box: [64, 544, 640, 74], action: "/experts", placeholder: "Trouvez votre expert, votre mission ou votre opportunité…", font: 18 },
        { kind: "link", box: [64, 636, 160, 64], href: "/experts?certified=identity", label: "Experts vérifiés" },
        { kind: "link", box: [230, 636, 200, 64], href: "/missions", label: "Missions et appels d'offres" },
        { kind: "link", box: [436, 636, 226, 64], href: "/academy", label: "Formation et certification" },
        { kind: "link", box: [668, 636, 188, 64], href: "/services#equipes", label: "Équipes projet" },
        { kind: "link", box: [860, 636, 234, 64], href: "/contact", label: "Accompagnement sur mesure" },
        row([54, 722, 1214, 158], 32),
        { kind: "button", box: [1324, 798, 246, 58], href: "/inscription", label: "Créer mon compte", tone: "orange", font: 19 },
      ],
    },
    appelsOffres: {
      src: "/visuels/appels-offres.png", width: W, height: H,
      alt: "Appels d'offres et opportunités : veille quotidienne, filtres personnalisés, alertes en temps réel et accompagnement à la préparation des offres.",
      overlays: [
        {
          kind: "stats", box: [428, 684, 998, 88], tone: "light", font: 27, demo,
          items: [
            { icon: "file", color: "bordeaux", value: fmt(f.tenders), label: "Appels d'offres référencés" },
            { icon: "landmark", color: "orange", value: fmt(f.tenderBuyers), label: "Bailleurs et institutions" },
            { icon: "globe", color: "olive", value: fmt(f.tenderCountries), label: "Pays couverts" },
          ],
        },
        { kind: "button", box: [1430, 661, 314, 66], href: "/appels-offres#liste", label: "Explorer les opportunités", tone: "orange", font: 19 },
      ],
    },
    reseauExperts: {
      src: "/visuels/reseau-experts.png", width: W, height: H,
      alt: "Un réseau d'experts africains au service d'un développement durable, en six étapes : inscription, recherche, mise en relation, collaboration, suivi, résultats.",
      overlays: [
        { kind: "stats", box: [1460, 203, 290, 378], items: stats, tone: "light", layout: "column", font: 30, demo },
        { kind: "button", box: [1467, 582, 276, 58], href: "/inscription", label: "Rejoindre Talent Bridge", tone: "orange", font: 18 },
      ],
    },
    formation: {
      src: "/visuels/formation.png", width: W, height: H,
      alt: "Pour la formation et le renforcement des compétences : experts formateurs, programmes sur mesure, formations en présentiel et en ligne, suivi des acquis.",
      overlays: [row([338, 652, 1070, 80], 27), { kind: "button", box: [1424, 660, 300, 62], href: "/academy#catalogue", label: "Découvrir l'Academy", tone: "orange", font: 18 }],
    },
    ong: {
      src: "/visuels/ong.png", width: W, height: H,
      alt: "Pour les ONG, associations et organisations internationales : experts qualifiés, équipes multidisciplinaires, réponses aux appels d'offres et mesure d'impact.",
      overlays: [row([480, 767, 1212, 98], 30), { kind: "button", box: [77, 786, 374, 68], href: "/inscription/organisation", label: "Découvrir Talent Bridge", tone: "orange", font: 21 }],
    },
    cabinets: {
      src: "/visuels/cabinets.png", width: W, height: H,
      alt: "Pour les cabinets de conseil : vivier d'experts vérifiés, équipes projet, réponses aux appels d'offres et partenariats.",
      overlays: [row([471, 749, 1230, 109], 30), { kind: "button", box: [76, 739, 362, 68], href: "/inscription/organisation", label: "Rejoindre Talent Bridge", tone: "orange", font: 21 }],
    },
    solutions: {
      src: "/visuels/solutions.png", width: W, height: H,
      alt: "Des solutions d'expertise pour une Afrique plus compétitive : experts vérifiés, mise en relation rapide, équipes projet, accompagnement, résultats mesurables.",
      overlays: [
        row([57, 625, 1344, 96], 29),
        { kind: "button", box: [75, 550, 386, 66], href: "/services", label: "Découvrir Talent Bridge", tone: "orange", font: 21 },
      ],
    },
    services: {
      src: "/visuels/services.png", width: W, height: H,
      alt: "Des services complets pour tous vos besoins : experts indépendants, entreprises et PME, institutions publiques, ONG, appels d'offres, formation, équipes projet, certification.",
      overlays: [
        { kind: "link", box: [60, 435, 258, 155], href: "/inscription/consultant", label: "Experts indépendants" },
        { kind: "link", box: [330, 435, 258, 155], href: "/entreprises", label: "Entreprises et PME" },
        { kind: "link", box: [600, 435, 258, 155], href: "/ong-institutions", label: "Institutions publiques" },
        { kind: "link", box: [868, 435, 258, 155], href: "/ong-institutions", label: "ONG et organisations internationales" },
        { kind: "link", box: [60, 600, 258, 155], href: "/appels-offres", label: "Appels d'offres et AMI" },
        { kind: "link", box: [330, 600, 258, 155], href: "/academy", label: "Formation et Academy" },
        { kind: "link", box: [600, 600, 258, 155], href: "#equipes", label: "Équipes projet" },
        { kind: "link", box: [868, 600, 258, 155], href: "#verification", label: "Certification des experts" },
        { kind: "stats", box: [52, 770, 1246, 100], items: stats, tone: "band", layout: "row", font: 30, demo },
        { kind: "button", box: [1310, 785, 410, 64], href: "#liste", label: "Découvrir tous nos services", tone: "orange", font: 21 },
      ],
    },
    entreprises: {
      src: "/visuels/entreprises.png", width: W, height: H,
      alt: "Pour les entreprises : trouvez les bons experts, réduisez vos délais de recrutement, constituez des équipes performantes, sécurisez vos projets.",
      overlays: [row([476, 745, 1203, 116], 30), { kind: "button", box: [79, 739, 367, 70], href: "/organisation/missions/nouvelle", label: "Publier une mission", tone: "orange", font: 21 }],
    },
    equipesProjet: {
      src: "/visuels/equipes-projet.png", width: W, height: H,
      alt: "Constituez des équipes projet : matching intelligent, experts vérifiés, gestion de projet intégrée, suivi des livrables.",
      overlays: [{ kind: "button", box: [72, 669, 398, 64], href: "/organisation/missions", label: "Constituer mon équipe", tone: "bordeaux", font: 21 }],
    },
    reseauTalents: {
      src: "/visuels/reseau-talents.png", width: W, height: H,
      alt: "Un réseau de talents à l'échelle de l'Afrique : trouvez, constituez, collaborez, obtenez des résultats, accélérez votre impact.",
      overlays: [row([60, 588, 1310, 122], 32), { kind: "button", box: [1399, 614, 300, 68], href: "/inscription", label: "Rejoindre maintenant", tone: "orange", font: 19 }],
    },
    trouverExperts: {
      src: "/visuels/trouver-experts.png", width: W, height: H,
      alt: "Trouvez les bons experts : accédez à un réseau qualifié d'experts dans tous les domaines d'expertise.",
      overlays: [
        { kind: "search", box: [72, 497, 792, 94], action: "/experts", placeholder: "Métier, compétence, secteur…", font: 24 },
        ...DOMAIN_CHIPS.map(([label, slug], i): Overlay => {
          const boxes: [number, number, number, number][] = [
            [76, 605, 164, 54], [250, 605, 94, 54], [354, 605, 124, 54], [487, 605, 206, 54], [703, 605, 112, 54],
            [73, 665, 112, 54], [196, 665, 154, 54], [361, 665, 188, 54], [560, 665, 132, 54],
          ];
          return { kind: "link", box: boxes[i], href: `/experts?domain=${slug}`, label };
        }),
        { kind: "link", box: [703, 665, 118, 54], href: "/experts", label: "Tous les domaines" },
        row([52, 745, 960, 104], 28),
      ],
    },
    publierMissions: {
      src: "/visuels/publier-missions.png", width: 1672, height: 941,
      alt: "Publiez vos missions : définissez vos besoins, recevez des candidatures, sélectionnez les meilleurs profils.",
      overlays: [{ kind: "button", box: [97, 544, 468, 80], href: "/organisation/missions/nouvelle", label: "Publier une mission", tone: "orange", font: 28 }],
    },
  } satisfies Record<string, VisualDef>;
  return defs;
}

/** Modèles de certificats fournis (exemples fictifs, affichés comme tels). */
export const CERTIFICATE_MODELS = [
  { src: "/visuels/modele-certification-consultant.png", width: 1536, height: 1024, alt: "Modèle de certificat « Consultant vérifié » Talent Bridge (exemple fictif)", title: "Certification « Consultant vérifié »" },
  { src: "/visuels/modele-certificat-academy.png", width: 1536, height: 1024, alt: "Modèle de certificat de formation en ligne Talent Bridge Academy (exemple fictif)", title: "Certificat de formation Academy" },
] as const;
