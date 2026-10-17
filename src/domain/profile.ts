/**
 * Indicateur de complétude du profil expert (0-100), recalculé côté serveur à chaque modification.
 * Chaque rubrique a un poids ; la liste des rubriques manquantes guide l'expert.
 */
export interface ProfileFacts {
  hasPhoto: boolean;
  headline?: string | null;
  bio?: string | null;
  countryCode?: string | null;
  city?: string | null;
  languages: string[];
  domains: number;
  skills: number;
  experiences: number;
  qualifications: number;
  references: number;
  portfolio: number;
  hasCv: boolean;
  hasRate: boolean;
  yearsExperience: number;
}

export const COMPLETENESS_ITEMS: { key: string; label: string; weight: number; test: (f: ProfileFacts) => boolean }[] = [
  { key: "identity", label: "Titre professionnel", weight: 8, test: (f) => !!f.headline && f.headline.trim().length >= 5 },
  { key: "bio", label: "Présentation (80 caractères min.)", weight: 10, test: (f) => !!f.bio && f.bio.trim().length >= 80 },
  { key: "location", label: "Pays et ville", weight: 6, test: (f) => !!f.countryCode && !!f.city },
  { key: "languages", label: "Langues", weight: 6, test: (f) => f.languages.length > 0 },
  { key: "domains", label: "Domaine d'expertise", weight: 8, test: (f) => f.domains > 0 },
  { key: "skills", label: "Au moins 3 compétences", weight: 14, test: (f) => f.skills >= 3 },
  { key: "experience", label: "Expériences professionnelles", weight: 14, test: (f) => f.experiences > 0 && f.yearsExperience > 0 },
  { key: "qualifications", label: "Diplômes ou certifications", weight: 10, test: (f) => f.qualifications > 0 },
  { key: "references", label: "Au moins 2 références", weight: 8, test: (f) => f.references >= 2 },
  { key: "cv", label: "CV", weight: 8, test: (f) => f.hasCv },
  { key: "rate", label: "Tarif indicatif", weight: 4, test: (f) => f.hasRate },
  { key: "photo", label: "Photo", weight: 2, test: (f) => f.hasPhoto },
  { key: "portfolio", label: "Portfolio", weight: 2, test: (f) => f.portfolio > 0 },
];

export function computeCompleteness(f: ProfileFacts): { score: number; missing: { key: string; label: string }[] } {
  const total = COMPLETENESS_ITEMS.reduce((s, i) => s + i.weight, 0);
  let got = 0;
  const missing: { key: string; label: string }[] = [];
  for (const item of COMPLETENESS_ITEMS) {
    if (item.test(f)) got += item.weight;
    else missing.push({ key: item.key, label: item.label });
  }
  return { score: Math.round((got * 100) / total), missing };
}

/** Seuil de complétude exigé pour soumettre un profil à vérification. */
export const MIN_COMPLETENESS_FOR_VERIFICATION = 60;
