/** Pages statiques par rôle, utilisées par le test d'affichage multi-écrans (ordinateur, tablette, téléphone). */
export const ROLE_ROUTES: { role: string; email: string | null; paths: string[] }[] = [
  {
    role: "public",
    email: null,
    paths: ["/", "/experts", "/comparer", "/missions", "/appels-offres", "/academy", "/application", "/academy?type=SEMINAR", "/academy/seminaire-financement-climat-demo", "/academy/gestion-projet-agile-demo", "/certificats", "/tarifs", "/a-propos", "/notre-mission", "/services", "/cabinets", "/entreprises", "/ong-institutions", "/contact", "/faq", "/conditions-generales", "/confidentialite", "/mentions-legales", "/connexion", "/inscription", "/inscription/consultant", "/inscription/apprenant", "/inscription/organisation", "/mot-de-passe-oublie"],
  },
  { role: "consultant", email: "consultant@demo.talentbridge.africa", paths: ["/espace", "/espace/profil", "/espace/verification", "/espace/missions", "/espace/candidatures", "/espace/contrats", "/espace/disponibilites", "/espace/formations", "/espace/alertes", "/projets", "/messages", "/notifications", "/parametres", "/facturation", "/communaute", "/communaute/mentorat"] },
  { role: "organisation", email: "cabinet@demo.talentbridge.africa", paths: ["/organisation", "/organisation/missions", "/organisation/missions/nouvelle", "/organisation/experts", "/organisation/shortlists", "/organisation/contrats", "/organisation/equipe", "/organisation/parametres", "/organisation/appels-offres", "/organisation/crm", "/organisation/rapports", "/projets", "/messages/nouveau", "/facturation"] },
  { role: "formateur", email: "formation@demo.talentbridge.africa", paths: ["/academy/formateur"] },
  { role: "admin", email: "admin@demo.talentbridge.africa", paths: ["/admin", "/admin/utilisateurs", "/admin/verifications", "/admin/experts", "/admin/organisations", "/admin/missions", "/admin/appels-offres", "/admin/moderation", "/admin/certificats", "/admin/finances", "/admin/factures", "/admin/offres", "/admin/configuration", "/admin/contenus", "/admin/contacts", "/admin/audit", "/admin/direction"] },
];

/** Formats d'écran couverts. */
export const VIEWPORTS = {
  telephone: { width: 390, height: 844 },
  "tablette-portrait": { width: 768, height: 1024 },
  "tablette-paysage": { width: 1024, height: 768 },
  ordinateur: { width: 1440, height: 900 },
} as const;
