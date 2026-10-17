/**
 * Assistant de préparation des appels d'offres — version déterministe.
 * Repère dans le texte des TDR les pièces usuellement exigées (liste de motifs),
 * et produit une checklist de BROUILLON à vérifier par l'utilisateur.
 * Ne génère jamais de référence, d'expérience ni d'attestation.
 */
import { normalizeText } from "./matching";

const PATTERNS: { category: "ADMINISTRATIVE" | "TECHNICAL" | "FINANCIAL" | "EXPERTS"; label: string; terms: string[] }[] = [
  { category: "ADMINISTRATIVE", label: "Registre de commerce (RCCM) ou équivalent", terms: ["rccm", "registre de commerce", "registre du commerce", "certificate of incorporation"] },
  { category: "ADMINISTRATIVE", label: "Attestation de régularité fiscale", terms: ["regularite fiscale", "attestation fiscale", "tax clearance"] },
  { category: "ADMINISTRATIVE", label: "Attestation de sécurité sociale (CNPS ou équivalent)", terms: ["cnps", "securite sociale", "social security"] },
  { category: "ADMINISTRATIVE", label: "Lettre de soumission / de manifestation d'intérêt signée", terms: ["lettre de soumission", "lettre de manifestation", "lettre d interet", "cover letter"] },
  { category: "ADMINISTRATIVE", label: "Pouvoir du signataire", terms: ["pouvoir", "procuration", "power of attorney"] },
  { category: "ADMINISTRATIVE", label: "Accord de groupement / consortium", terms: ["groupement", "consortium", "joint venture"] },
  { category: "TECHNICAL", label: "Références de missions similaires (avec attestations de bonne exécution)", terms: ["references", "missions similaires", "bonne execution", "similar assignments"] },
  { category: "TECHNICAL", label: "Note méthodologique", terms: ["methodologie", "note methodologique", "approche", "methodology"] },
  { category: "TECHNICAL", label: "Plan de travail et chronogramme", terms: ["plan de travail", "chronogramme", "calendrier", "work plan"] },
  { category: "TECHNICAL", label: "Présentation du soumissionnaire", terms: ["presentation du cabinet", "presentation de l entreprise", "profil du cabinet", "company profile"] },
  { category: "EXPERTS", label: "CV des experts clés signés", terms: ["cv", "curriculum", "experts cles", "key experts"] },
  { category: "EXPERTS", label: "Copies des diplômes des experts", terms: ["diplome", "diplomes", "degree"] },
  { category: "FINANCIAL", label: "Offre financière détaillée", terms: ["offre financiere", "proposition financiere", "financial proposal", "bordereau des prix"] },
  { category: "FINANCIAL", label: "Garantie / caution de soumission", terms: ["caution de soumission", "garantie de soumission", "bid security", "bid bond"] },
  { category: "FINANCIAL", label: "États financiers des derniers exercices", terms: ["etats financiers", "bilans", "chiffre d affaires", "financial statements"] },
];

export interface DraftRequirement {
  category: string;
  label: string;
  matched: string;
}

export function extractRequirements(text: string): DraftRequirement[] {
  const hay = ` ${normalizeText(text)} `;
  const out: DraftRequirement[] = [];
  for (const p of PATTERNS) {
    const hit = p.terms.find((t) => hay.includes(` ${normalizeText(t)}`));
    if (hit) out.push({ category: p.category, label: p.label, matched: hit });
  }
  return out;
}

/** Taux de conformité d'un dossier (pièces prêtes / total). */
export function complianceRate(reqs: { status: string }[]): number {
  if (reqs.length === 0) return 0;
  return Math.round((reqs.filter((r) => r.status === "READY").length * 100) / reqs.length);
}

export function daysUntil(deadline: Date, now = new Date()): number {
  return Math.ceil((deadline.getTime() - now.getTime()) / 86_400_000);
}
