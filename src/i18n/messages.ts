/**
 * Internationalisation : français par défaut, anglais préparé.
 * Les libellés de navigation et de structure passent par `t()` ; les contenus éditoriaux
 * sont gérés par langue dans le CMS (content_blocks.locale).
 */
export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = "tb_locale";

const fr = {
  "nav.experts": "Experts",
  "nav.missions": "Missions",
  "nav.tenders": "Appels d'offres",
  "nav.academy": "Academy",
  "nav.services": "Services",
  "nav.pricing": "Tarifs",
  "nav.about": "À propos",
  "nav.contact": "Contact",
  "nav.login": "Connexion",
  "nav.signup": "Rejoindre",
  "nav.myspace": "Mon espace",
  "cta.findExpert": "Trouver un expert",
  "cta.publishMission": "Publier une mission",
  "footer.tagline": "Connecter les experts. Transformer les compétences en résultats.",
  "footer.platform": "Plateforme",
  "footer.solutions": "Solutions",
  "footer.company": "Talent Bridge",
  "footer.legal": "Informations légales",
  "footer.rights": "Tous droits réservés.",
  "app.dashboard": "Tableau de bord",
  "app.messages": "Messages",
  "app.notifications": "Notifications",
  "app.settings": "Paramètres",
  "app.logout": "Déconnexion",
} as const;

export type MessageKey = keyof typeof fr;

const en: Partial<Record<MessageKey, string>> = {
  "nav.experts": "Experts",
  "nav.missions": "Assignments",
  "nav.tenders": "Tenders",
  "nav.academy": "Academy",
  "nav.services": "Services",
  "nav.pricing": "Pricing",
  "nav.about": "About",
  "nav.contact": "Contact",
  "nav.login": "Sign in",
  "nav.signup": "Join",
  "nav.myspace": "My space",
  "cta.findExpert": "Find an expert",
  "cta.publishMission": "Post an assignment",
  "footer.tagline": "Connecting experts. Turning skills into results.",
  "footer.platform": "Platform",
  "footer.solutions": "Solutions",
  "footer.company": "Talent Bridge",
  "footer.legal": "Legal",
  "footer.rights": "All rights reserved.",
  "app.dashboard": "Dashboard",
  "app.messages": "Messages",
  "app.notifications": "Notifications",
  "app.settings": "Settings",
  "app.logout": "Sign out",
};

const dictionaries: Record<Locale, Partial<Record<MessageKey, string>>> = { fr, en };

export function translator(locale: Locale) {
  return (key: MessageKey): string => dictionaries[locale][key] ?? fr[key];
}
