/**
 * Référentiels chargés dans TOUS les environnements (idempotent : upsert).
 * Tarifs des offres : valeurs INITIALES de configuration, modifiables par l'administrateur
 * (Configuration > Offres). Elles ne constituent pas une grille commerciale validée.
 */
export const CURRENCIES = [
  { code: "XOF", name: "Franc CFA (UEMOA)", symbol: "FCFA", minorUnits: 0 },
  { code: "XAF", name: "Franc CFA (CEMAC)", symbol: "FCFA", minorUnits: 0 },
  { code: "EUR", name: "Euro", symbol: "€", minorUnits: 2 },
  { code: "USD", name: "Dollar américain", symbol: "$", minorUnits: 2 },
  { code: "GHS", name: "Cedi ghanéen", symbol: "GH₵", minorUnits: 2 },
  { code: "NGN", name: "Naira nigérian", symbol: "₦", minorUnits: 2 },
  { code: "KES", name: "Shilling kényan", symbol: "KSh", minorUnits: 2 },
  { code: "MAD", name: "Dirham marocain", symbol: "DH", minorUnits: 2 },
  { code: "RWF", name: "Franc rwandais", symbol: "FRw", minorUnits: 0 },
  { code: "GNF", name: "Franc guinéen", symbol: "FG", minorUnits: 0 },
];

export const COUNTRIES: { code: string; nameFr: string; nameEn: string; region: string; currencyCode: string; phonePrefix: string; vatBps?: number }[] = [
  { code: "CI", nameFr: "Côte d'Ivoire", nameEn: "Côte d'Ivoire", region: "Afrique de l'Ouest", currencyCode: "XOF", phonePrefix: "+225", vatBps: 1800 },
  { code: "SN", nameFr: "Sénégal", nameEn: "Senegal", region: "Afrique de l'Ouest", currencyCode: "XOF", phonePrefix: "+221", vatBps: 1800 },
  { code: "BF", nameFr: "Burkina Faso", nameEn: "Burkina Faso", region: "Afrique de l'Ouest", currencyCode: "XOF", phonePrefix: "+226", vatBps: 1800 },
  { code: "ML", nameFr: "Mali", nameEn: "Mali", region: "Afrique de l'Ouest", currencyCode: "XOF", phonePrefix: "+223", vatBps: 1800 },
  { code: "BJ", nameFr: "Bénin", nameEn: "Benin", region: "Afrique de l'Ouest", currencyCode: "XOF", phonePrefix: "+229", vatBps: 1800 },
  { code: "TG", nameFr: "Togo", nameEn: "Togo", region: "Afrique de l'Ouest", currencyCode: "XOF", phonePrefix: "+228", vatBps: 1800 },
  { code: "NE", nameFr: "Niger", nameEn: "Niger", region: "Afrique de l'Ouest", currencyCode: "XOF", phonePrefix: "+227", vatBps: 1900 },
  { code: "GN", nameFr: "Guinée", nameEn: "Guinea", region: "Afrique de l'Ouest", currencyCode: "GNF", phonePrefix: "+224", vatBps: 1800 },
  { code: "GH", nameFr: "Ghana", nameEn: "Ghana", region: "Afrique de l'Ouest", currencyCode: "GHS", phonePrefix: "+233", vatBps: 1500 },
  { code: "NG", nameFr: "Nigeria", nameEn: "Nigeria", region: "Afrique de l'Ouest", currencyCode: "NGN", phonePrefix: "+234", vatBps: 750 },
  { code: "CM", nameFr: "Cameroun", nameEn: "Cameroon", region: "Afrique centrale", currencyCode: "XAF", phonePrefix: "+237", vatBps: 1925 },
  { code: "GA", nameFr: "Gabon", nameEn: "Gabon", region: "Afrique centrale", currencyCode: "XAF", phonePrefix: "+241", vatBps: 1800 },
  { code: "CD", nameFr: "RD Congo", nameEn: "DR Congo", region: "Afrique centrale", currencyCode: "USD", phonePrefix: "+243", vatBps: 1600 },
  { code: "RW", nameFr: "Rwanda", nameEn: "Rwanda", region: "Afrique de l'Est", currencyCode: "RWF", phonePrefix: "+250", vatBps: 1800 },
  { code: "KE", nameFr: "Kenya", nameEn: "Kenya", region: "Afrique de l'Est", currencyCode: "KES", phonePrefix: "+254", vatBps: 1600 },
  { code: "MA", nameFr: "Maroc", nameEn: "Morocco", region: "Afrique du Nord", currencyCode: "MAD", phonePrefix: "+212", vatBps: 2000 },
];

export const DOMAINS = [
  { slug: "agriculture", nameFr: "Agriculture", nameEn: "Agriculture" },
  { slug: "btp", nameFr: "BTP & Infrastructures", nameEn: "Construction & Infrastructure" },
  { slug: "finance", nameFr: "Finance", nameEn: "Finance" },
  { slug: "environnement", nameFr: "Environnement & Climat", nameEn: "Environment & Climate" },
  { slug: "digital", nameFr: "Digital & Data", nameEn: "Digital & Data" },
  { slug: "sante", nameFr: "Santé", nameEn: "Health" },
  { slug: "education", nameFr: "Éducation", nameEn: "Education" },
  { slug: "gouvernance", nameFr: "Gouvernance & Institutions", nameEn: "Governance" },
  { slug: "energie", nameFr: "Énergie", nameEn: "Energy" },
  { slug: "suivi-evaluation", nameFr: "Suivi-évaluation", nameEn: "Monitoring & Evaluation" },
];

export const SKILLS: { slug: string; nameFr: string; nameEn: string; domain: string; synonyms?: string[] }[] = [
  { slug: "agronomie", nameFr: "Agronomie", nameEn: "Agronomy", domain: "agriculture", synonyms: ["agronome"] },
  { slug: "chaines-de-valeur", nameFr: "Chaînes de valeur agricoles", nameEn: "Agricultural value chains", domain: "agriculture", synonyms: ["chaine de valeur", "value chain"] },
  { slug: "irrigation", nameFr: "Irrigation", nameEn: "Irrigation", domain: "agriculture" },
  { slug: "genie-civil", nameFr: "Génie civil", nameEn: "Civil engineering", domain: "btp", synonyms: ["ingenieur genie civil"] },
  { slug: "controle-travaux", nameFr: "Contrôle des travaux", nameEn: "Works supervision", domain: "btp", synonyms: ["supervision des travaux", "maitrise d oeuvre"] },
  { slug: "etudes-faisabilite", nameFr: "Études de faisabilité", nameEn: "Feasibility studies", domain: "btp", synonyms: ["faisabilite", "feasibility"] },
  { slug: "audit-financier", nameFr: "Audit financier", nameEn: "Financial audit", domain: "finance", synonyms: ["audit", "commissariat aux comptes"] },
  { slug: "gestion-financiere", nameFr: "Gestion financière de projets", nameEn: "Project financial management", domain: "finance", synonyms: ["gestion financiere"] },
  { slug: "microfinance", nameFr: "Microfinance", nameEn: "Microfinance", domain: "finance", synonyms: ["inclusion financiere"] },
  { slug: "passation-marches", nameFr: "Passation des marchés", nameEn: "Procurement", domain: "gouvernance", synonyms: ["marches publics", "procurement", "passation de marches"] },
  { slug: "eies", nameFr: "Études d'impact environnemental et social", nameEn: "ESIA", domain: "environnement", synonyms: ["eies", "esia", "impact environnemental", "sauvegardes"] },
  { slug: "changement-climatique", nameFr: "Changement climatique", nameEn: "Climate change", domain: "environnement", synonyms: ["climat", "adaptation", "attenuation"] },
  { slug: "developpement-web", nameFr: "Développement web", nameEn: "Web development", domain: "digital", synonyms: ["developpeur web", "react", "next.js"] },
  { slug: "data-science", nameFr: "Data science", nameEn: "Data science", domain: "digital", synonyms: ["science des donnees", "machine learning", "python"] },
  { slug: "transformation-digitale", nameFr: "Transformation digitale", nameEn: "Digital transformation", domain: "digital", synonyms: ["transformation numerique", "digitalisation"] },
  { slug: "cybersecurite", nameFr: "Cybersécurité", nameEn: "Cybersecurity", domain: "digital", synonyms: ["securite informatique"] },
  { slug: "sante-publique", nameFr: "Santé publique", nameEn: "Public health", domain: "sante", synonyms: ["epidemiologie"] },
  { slug: "systemes-information-sanitaire", nameFr: "Systèmes d'information sanitaire", nameEn: "Health information systems", domain: "sante", synonyms: ["dhis2", "sis"] },
  { slug: "ingenierie-pedagogique", nameFr: "Ingénierie pédagogique", nameEn: "Instructional design", domain: "education", synonyms: ["formation de formateurs"] },
  { slug: "renforcement-capacites", nameFr: "Renforcement des capacités", nameEn: "Capacity building", domain: "education", synonyms: ["capacity building"] },
  { slug: "politiques-publiques", nameFr: "Politiques publiques", nameEn: "Public policy", domain: "gouvernance", synonyms: ["reforme de l etat"] },
  { slug: "decentralisation", nameFr: "Décentralisation", nameEn: "Decentralisation", domain: "gouvernance" },
  { slug: "energies-renouvelables", nameFr: "Énergies renouvelables", nameEn: "Renewable energy", domain: "energie", synonyms: ["solaire", "photovoltaique", "mini-reseaux"] },
  { slug: "efficacite-energetique", nameFr: "Efficacité énergétique", nameEn: "Energy efficiency", domain: "energie" },
  { slug: "suivi-evaluation", nameFr: "Suivi-évaluation", nameEn: "Monitoring and evaluation", domain: "suivi-evaluation", synonyms: ["s e", "m e", "suivi evaluation", "evaluation de projet"] },
  { slug: "cadre-logique", nameFr: "Cadre logique / théorie du changement", nameEn: "Logframe / theory of change", domain: "suivi-evaluation", synonyms: ["cadre logique", "theorie du changement", "logframe"] },
  { slug: "enquetes", nameFr: "Enquêtes et collecte de données", nameEn: "Surveys & data collection", domain: "suivi-evaluation", synonyms: ["enquete", "collecte de donnees", "kobo"] },
  { slug: "gestion-projet", nameFr: "Gestion de projet", nameEn: "Project management", domain: "gouvernance", synonyms: ["chef de projet", "pmp", "gestion de projets"] },
  { slug: "genre-inclusion", nameFr: "Genre et inclusion", nameEn: "Gender & inclusion", domain: "gouvernance", synonyms: ["genre", "inclusion sociale"] },
  { slug: "communication", nameFr: "Communication institutionnelle", nameEn: "Institutional communication", domain: "gouvernance", synonyms: ["communication"] },
];

export const BADGES = [
  { code: "IDENTITY_VERIFIED", kind: "IDENTITY_VERIFIED" as const, nameFr: "Identité vérifiée", nameEn: "Identity verified", description: "Pièce d'identité contrôlée par l'équipe Talent Bridge.", validityDays: 1095 },
  { code: "DOCUMENTS_VERIFIED", kind: "DOCUMENTS_VERIFIED" as const, nameFr: "Diplômes et références vérifiés", nameEn: "Documents verified", description: "Diplômes et références professionnelles contrôlés auprès des émetteurs.", validityDays: 730 },
  { code: "SKILLS_ASSESSED", kind: "SKILLS_ASSESSED" as const, nameFr: "Compétences évaluées", nameEn: "Skills assessed", description: "Compétences évaluées par un entretien technique ou un test.", validityDays: 730 },
];

export const FEATURES = [
  { code: "profile.premium", name: "Mise en avant du profil" },
  { code: "applications.monthly", name: "Candidatures par mois" },
  { code: "missions.active", name: "Missions publiées simultanément" },
  { code: "experts.contact", name: "Contacts d'experts par mois" },
  { code: "matching.run", name: "Matching intelligent" },
  { code: "teams.build", name: "Constitution d'équipes" },
  { code: "tenders.bids", name: "Dossiers d'appels d'offres" },
  { code: "crm.use", name: "CRM commercial" },
  { code: "seats", name: "Collaborateurs" },
];

export const PLANS: { code: string; name: string; audience: "EXPERT" | "ORGANIZATION"; description: string; isRecurring: boolean; highlight?: boolean; sortOrder: number; prices: { currency: string; interval: "MONTH" | "YEAR" | "ONE_TIME"; amountMinor: number }[]; features: Record<string, number | null> }[] = [
  { code: "EXPERT_FREE", name: "Expert gratuit", audience: "EXPERT", description: "Profil, annuaire, candidatures et formations gratuites.", isRecurring: true, sortOrder: 1, prices: [{ currency: "XOF", interval: "MONTH", amountMinor: 0 }], features: { "applications.monthly": 5 } },
  { code: "EXPERT_PREMIUM", name: "Expert Premium", audience: "EXPERT", description: "Profil mis en avant, candidatures illimitées, alertes avancées.", isRecurring: true, highlight: true, sortOrder: 2, prices: [{ currency: "XOF", interval: "MONTH", amountMinor: 5000 }, { currency: "XOF", interval: "YEAR", amountMinor: 50000 }, { currency: "EUR", interval: "MONTH", amountMinor: 900 }], features: { "applications.monthly": null, "profile.premium": null } },
  { code: "ORG_STANDARD", name: "Organisation Standard", audience: "ORGANIZATION", description: "Publication de missions et recherche d'experts pour les PME.", isRecurring: true, sortOrder: 10, prices: [{ currency: "XOF", interval: "MONTH", amountMinor: 50000 }, { currency: "XOF", interval: "YEAR", amountMinor: 500000 }], features: { "missions.active": 3, "experts.contact": 20, "matching.run": null, seats: 3 } },
  { code: "ORG_BUSINESS", name: "Organisation Business", audience: "ORGANIZATION", description: "Matching, équipes projet, appels d'offres et CRM.", isRecurring: true, highlight: true, sortOrder: 11, prices: [{ currency: "XOF", interval: "MONTH", amountMinor: 150000 }, { currency: "XOF", interval: "YEAR", amountMinor: 1500000 }, { currency: "EUR", interval: "MONTH", amountMinor: 24900 }], features: { "missions.active": 15, "experts.contact": null, "matching.run": null, "teams.build": null, "tenders.bids": 10, "crm.use": null, seats: 15 } },
  { code: "ORG_ENTERPRISE", name: "Organisation Enterprise", audience: "ORGANIZATION", description: "Volumes illimités, accompagnement dédié, intégrations.", isRecurring: true, sortOrder: 12, prices: [{ currency: "XOF", interval: "YEAR", amountMinor: 6000000 }], features: { "missions.active": null, "experts.contact": null, "matching.run": null, "teams.build": null, "tenders.bids": null, "crm.use": null, seats: null } },
  { code: "SERVICE_CERTIFICATION", name: "Certification expert (évaluation des compétences)", audience: "EXPERT", description: "Évaluation technique par un jury et badge « Compétences évaluées » si réussite.", isRecurring: false, sortOrder: 20, prices: [{ currency: "XOF", interval: "ONE_TIME", amountMinor: 25000 }], features: {} },
  { code: "SERVICE_SOURCING", name: "Sourcing ponctuel", audience: "ORGANIZATION", description: "Identification et qualification d'experts par notre équipe (objectif 72 h).", isRecurring: false, sortOrder: 30, prices: [{ currency: "XOF", interval: "ONE_TIME", amountMinor: 300000 }], features: {} },
  { code: "SERVICE_TENDER_SUPPORT", name: "Accompagnement aux appels d'offres", audience: "ORGANIZATION", description: "Analyse des TDR, matrice de conformité, mobilisation des experts clés.", isRecurring: false, sortOrder: 31, prices: [{ currency: "XOF", interval: "ONE_TIME", amountMinor: 750000 }], features: {} },
  { code: "SERVICE_TEAM_BUILDING", name: "Constitution d'équipe projet", audience: "ORGANIZATION", description: "Montage d'une équipe pluridisciplinaire prête à intervenir.", isRecurring: false, sortOrder: 32, prices: [{ currency: "XOF", interval: "ONE_TIME", amountMinor: 1000000 }], features: {} },
];

export const NOTIFICATION_TEMPLATES = [
  { type: "REGISTRATION", channel: "EMAIL" as const, subject: "Bienvenue sur Talent Bridge", body: "Bonjour {{prenom}},\n\n{{message}}\n\nAccéder à votre espace : {{lien}}\n\nL'équipe Talent Bridge" },
  { type: "APPLICATION", channel: "EMAIL" as const, subject: "{{titre}}", body: "Bonjour {{prenom}},\n\n{{message}}\n\nVoir le détail : {{lien}}\n\nL'équipe Talent Bridge" },
  { type: "VERIFICATION", channel: "EMAIL" as const, subject: "Vérification : {{titre}}", body: "Bonjour {{prenom}},\n\n{{message}}\n\n{{lien}}\n\nL'équipe Talent Bridge" },
  { type: "PAYMENT", channel: "EMAIL" as const, subject: "{{titre}}", body: "Bonjour {{prenom}},\n\n{{message}}\n\nVotre facture : {{lien}}\n\nL'équipe Talent Bridge" },
  { type: "INVOICE", channel: "EMAIL" as const, subject: "{{titre}}", body: "Bonjour {{prenom}},\n\n{{message}}\n\nRégler la facture : {{lien}}\n\nL'équipe Talent Bridge" },
  { type: "DEADLINE", channel: "SMS" as const, subject: "Échéance", body: "Talent Bridge : {{titre}}. {{lien}}" },
];

export const CONTENT_BLOCKS: { key: string; title: string | null; body: string }[] = [
  { key: "home.hero", title: "Des experts d'aujourd'hui pour les défis de demain.", body: "La plateforme panafricaine qui connecte les experts, les organisations et les opportunités pour un impact concret en Afrique et au-delà." },
  { key: "home.promise", title: "Objectif : vos experts identifiés en 72 heures", body: "Nous visons à identifier, qualifier et mobiliser des experts ou des équipes projet en 72 heures, selon la disponibilité des profils et les conditions de mission. Ce délai est un objectif de service, pas une garantie." },
  { key: "home.about", title: "Talent Bridge, l'infrastructure de l'expertise africaine", body: "Talent Bridge mobilise, vérifie, valorise et met en relation des experts professionnels avec les cabinets, entreprises, ONG, institutions et bailleurs qui en ont besoin. Chaque profil peut être vérifié (identité, diplômes, références, compétences) et chaque mise en relation est tracée." },
  { key: "about.mission", title: "Notre mission", body: "Connecter les experts. Transformer les compétences en résultats.\n\nNous voulons rendre l'expertise africaine visible, vérifiable et mobilisable rapidement, pour des projets à fort impact." },
  { key: "about.vision", title: "Notre ambition", body: "Construire une infrastructure panafricaine de référence pour l'accès à l'expertise professionnelle : plusieurs pays, plusieurs langues, plusieurs devises, une exigence de qualité commune." },
  { key: "about.values", title: "Nos engagements", body: "- Vérification humaine : aucun badge n'est attribué sur simple dépôt de document.\n- Transparence : nos recommandations sont expliquées critère par critère.\n- Confidentialité : les coordonnées des experts ne sont jamais publiées sans leur accord.\n- Impact : priorité aux projets de développement inclusif et durable." },
  { key: "legal.terms", title: "Conditions générales d'utilisation", body: "**Projet de document — à faire valider par un conseil juridique avant mise en production.**\n\n1. Objet : les présentes conditions régissent l'utilisation de la plateforme Talent Bridge.\n2. Comptes : chaque utilisateur est responsable de l'exactitude des informations déclarées. Les informations non vérifiées sont signalées comme « déclarées ».\n3. Mise en relation : Talent Bridge facilite la mise en relation et n'est pas partie aux contrats conclus entre organisations et experts, sauf mention contraire.\n4. Paiements : les paiements sont traités par des prestataires agréés ; Talent Bridge ne conserve aucune donnée de carte.\n5. Résiliation : l'utilisateur peut supprimer son compte à tout moment depuis ses paramètres.\n6. Droit applicable : à préciser (droit ivoirien envisagé)." },
  { key: "legal.privacy", title: "Politique de confidentialité", body: "**Projet de document — conformité à valider (loi ivoirienne n° 2013-450 relative à la protection des données à caractère personnel, déclarations auprès de l'ARTCI, et lois des autres pays d'opération).**\n\n- Données collectées : identité, coordonnées, parcours professionnel, documents justificatifs, données de connexion.\n- Finalités : mise en relation, vérification des profils, facturation, sécurité.\n- Coordonnées : jamais affichées publiquement ; échanges via la messagerie interne.\n- Documents justificatifs : accessibles uniquement à l'expert et aux vérificateurs habilités, par liens temporaires.\n- Droits : accès, rectification, export (Paramètres > Mes données), suppression (Paramètres > Supprimer mon compte).\n- Conservation : voir docs/SECURITY.md (durées à valider)." },
  { key: "legal.notice", title: "Mentions légales", body: "**À compléter** : raison sociale, forme juridique, capital, siège social, RCCM, compte contribuable, directeur de la publication, hébergeur (nom, adresse)." },
];

export const FAQ = [
  { category: "GENERAL", question: "Qu'est-ce que Talent Bridge ?", answer: "Une plateforme panafricaine qui permet aux organisations de trouver, vérifier et mobiliser des experts et des équipes projet, et aux experts de valoriser leurs compétences." },
  { category: "GENERAL", question: "Le délai de 72 heures est-il garanti ?", answer: "Non. Il s'agit d'un objectif de service : il dépend de la disponibilité des profils, de la précision du besoin et des conditions de la mission." },
  { category: "EXPERTS", question: "Comment obtenir un badge vérifié ?", answer: "Complétez votre profil (60 % minimum), déposez vos justificatifs dans le centre de vérification et soumettez votre demande. Un vérificateur contrôle chaque pièce ; le badge n'est attribué qu'après décision humaine." },
  { category: "EXPERTS", question: "Mes coordonnées sont-elles visibles ?", answer: "Non. Les organisations vous contactent via la messagerie interne. Vous choisissez la visibilité de votre profil (public, membres connectés ou privé)." },
  { category: "ORGANISATIONS", question: "Comment fonctionne le matching ?", answer: "Le moteur compare votre besoin aux profils (compétences, expérience, références vérifiées, disponibilité, localisation, langues) et affiche un score expliqué critère par critère. Vous validez ou écartez chaque recommandation." },
  { category: "ORGANISATIONS", question: "Quels moyens de paiement sont acceptés ?", answer: "Mobile Money, carte bancaire et virement, via des prestataires agréés selon le pays. Les intégrations définitives sont en cours de contractualisation." },
];

export const PUBLIC_STATS = [
  { key: "experts", label: "Experts inscrits", metric: "experts", sortOrder: 1 },
  { key: "organizations", label: "Organisations validées", metric: "organizations", sortOrder: 2 },
  { key: "missions", label: "Missions publiées", metric: "missions_published", sortOrder: 3 },
  { key: "countries", label: "Pays représentés", metric: "countries", sortOrder: 4 },
];
