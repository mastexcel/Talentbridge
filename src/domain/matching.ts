/**
 * Moteur de matching v1 — DÉTERMINISTE, sans service d'IA externe.
 *
 * Principes :
 *  - n'utilise QUE les données déclarées ou vérifiées du profil (aucune compétence, référence
 *    ou disponibilité n'est inférée) ;
 *  - critères obligatoires appliqués d'abord (exclusion explicite avec motif) ;
 *  - score 0-100 = somme pondérée de sous-scores 0-1, chacun accompagné d'une explication ;
 *  - poids configurables (system_settings « matching.weights »), normalisés à 100 %.
 * Le résultat est une RECOMMANDATION soumise à validation humaine.
 */

export const MATCHING_ALGORITHM_VERSION = "det-1.0";

export interface MatchingWeights {
  skills: number;
  experience: number;
  references: number;
  availability: number;
  location: number;
  languages: number;
}

export const DEFAULT_WEIGHTS: MatchingWeights = {
  skills: 30,
  experience: 20,
  references: 15,
  availability: 15,
  location: 10,
  languages: 10,
};

export interface MissionNeed {
  requirements: { skillId: string; skillName: string; mandatory: boolean; minLevel: number }[];
  experienceYearsMin: number;
  domainId?: string | null;
  languages: string[];
  countryCode: string;
  workMode: "ONSITE" | "REMOTE" | "HYBRID";
  startDate?: Date | null;
  durationDays?: number | null;
  budgetMaxMinor?: number | null;
  currency?: string | null;
}

export interface CandidateProfile {
  expertId: string;
  skills: { skillId: string; level: number; years: number }[];
  yearsExperience: number;
  domainIds: string[];
  verifiedReferences: number;
  declaredReferences: number;
  availability: "AVAILABLE" | "PARTIAL" | "UNAVAILABLE";
  availableFrom?: Date | null;
  /** Périodes indisponibles ou déjà réservées */
  blockedSlots: { start: Date; end: Date }[];
  countryCode?: string | null;
  mobility: "LOCAL" | "NATIONAL" | "REGIONAL" | "INTERNATIONAL";
  mobilityCountries: string[];
  remoteOk: boolean;
  languages: string[];
  dailyRateMinor?: number | null;
  rateCurrency?: string | null;
}

export type Criterion = keyof MatchingWeights;

export interface CriterionResult {
  criterion: Criterion;
  weight: number; // % normalisé
  value: number; // 0-1
  points: number; // contribution au score
  explanation: string;
}

export interface MatchResult {
  expertId: string;
  eligible: boolean;
  exclusionReasons: string[];
  score: number; // 0-100, arrondi à 0,1
  breakdown: CriterionResult[];
  missingSkills: string[];
  /** Dépasse le budget indicatif (information, pas exclusion) */
  overBudget: boolean;
}

/** Poids normalisés à 100 (les valeurs négatives sont ramenées à 0). */
export function normalizeWeights(w: Partial<MatchingWeights> | null | undefined): MatchingWeights {
  const merged = { ...DEFAULT_WEIGHTS, ...(w ?? {}) };
  const keys = Object.keys(DEFAULT_WEIGHTS) as Criterion[];
  const clean = Object.fromEntries(keys.map((k) => [k, Math.max(0, Number(merged[k]) || 0)])) as unknown as MatchingWeights;
  const total = keys.reduce((s, k) => s + clean[k], 0);
  if (total === 0) return { ...DEFAULT_WEIGHTS };
  return Object.fromEntries(keys.map((k) => [k, (clean[k] * 100) / total])) as unknown as MatchingWeights;
}

const DAY = 86_400_000;

function overlaps(a: { start: Date; end: Date }, b: { start: Date; end: Date }) {
  return a.start.getTime() <= b.end.getTime() && b.start.getTime() <= a.end.getTime();
}

/** Fenêtre de la mission (début → début + durée), si la date de début est connue. */
export function missionWindow(need: Pick<MissionNeed, "startDate" | "durationDays">): { start: Date; end: Date } | null {
  if (!need.startDate) return null;
  const start = new Date(need.startDate);
  const end = new Date(start.getTime() + Math.max(1, need.durationDays ?? 1) * DAY);
  return { start, end };
}

const WEST_AFRICA = new Set(["CI", "SN", "BF", "ML", "NE", "TG", "BJ", "GN", "GH", "NG", "LR", "SL", "GW", "GM", "CV", "MR"]);
const CENTRAL_AFRICA = new Set(["CM", "GA", "CG", "CD", "TD", "CF", "GQ", "ST", "RW", "BI"]);
const EAST_AFRICA = new Set(["KE", "TZ", "UG", "ET", "SO", "DJ", "ER", "SS", "SD"]);
const SOUTHERN_AFRICA = new Set(["ZA", "NA", "BW", "ZW", "ZM", "MZ", "MW", "AO", "LS", "SZ", "MG", "MU"]);
const NORTH_AFRICA = new Set(["MA", "DZ", "TN", "LY", "EG"]);
const REGIONS = [WEST_AFRICA, CENTRAL_AFRICA, EAST_AFRICA, SOUTHERN_AFRICA, NORTH_AFRICA];

export function sameRegion(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return REGIONS.some((r) => r.has(a) && r.has(b));
}

function scoreSkills(need: MissionNeed, c: CandidateProfile) {
  const missing: string[] = [];
  if (need.requirements.length === 0) return { value: 1, missing, explanation: "Aucune compétence spécifiée par le besoin." };
  const bySkill = new Map(c.skills.map((s) => [s.skillId, s]));
  let total = 0;
  let got = 0;
  for (const r of need.requirements) {
    const weight = r.mandatory ? 2 : 1;
    total += weight;
    const s = bySkill.get(r.skillId);
    if (!s) {
      missing.push(r.skillName);
      continue;
    }
    // Niveau atteint : crédit complet ; en dessous, crédit proportionnel.
    got += weight * Math.min(1, s.level / Math.max(1, r.minLevel));
  }
  const value = total ? got / total : 1;
  const matched = need.requirements.length - missing.length;
  return { value, missing, explanation: `${matched}/${need.requirements.length} compétences requises présentes${missing.length ? ` — manquantes : ${missing.join(", ")}` : ""}.` };
}

function scoreExperience(need: MissionNeed, c: CandidateProfile) {
  const min = Math.max(0, need.experienceYearsMin);
  const yearsPart = min === 0 ? 1 : Math.min(1, c.yearsExperience / min);
  const domainPart = need.domainId ? (c.domainIds.includes(need.domainId) ? 1 : 0) : 1;
  const value = 0.7 * yearsPart + 0.3 * domainPart;
  const domainTxt = need.domainId ? (domainPart ? ", domaine correspondant" : ", domaine différent") : "";
  return { value, explanation: `${c.yearsExperience} an(s) d'expérience pour ${min} requis${domainTxt}.` };
}

function scoreReferences(c: CandidateProfile) {
  // Seules les références VÉRIFIÉES comptent pleinement ; 3 vérifiées = score maximal.
  const value = Math.min(1, c.verifiedReferences / 3);
  return {
    value,
    explanation: `${c.verifiedReferences} référence(s) vérifiée(s)${c.declaredReferences ? `, ${c.declaredReferences} déclarée(s) non vérifiée(s) (non comptées)` : ""}.`,
  };
}

function scoreAvailability(need: MissionNeed, c: CandidateProfile) {
  const window = missionWindow(need);
  if (c.availability === "UNAVAILABLE") return { value: 0, conflict: false, explanation: "Se déclare indisponible." };
  let conflict = false;
  if (window) {
    conflict = c.blockedSlots.some((s) => overlaps(s, window));
    if (c.availableFrom && c.availableFrom.getTime() > window.start.getTime()) conflict = true;
  }
  if (conflict) return { value: 0.1, conflict, explanation: "Conflit de calendrier avec la période de la mission." };
  const value = c.availability === "AVAILABLE" ? 1 : 0.6;
  return { value, conflict, explanation: c.availability === "AVAILABLE" ? "Disponible sur la période." : "Disponibilité partielle." };
}

function scoreLocation(need: MissionNeed, c: CandidateProfile) {
  if (need.workMode === "REMOTE") return { value: c.remoteOk ? 1 : 0.5, explanation: c.remoteOk ? "Mission à distance acceptée." : "Préfère le présentiel." };
  const sameCountry = c.countryCode === need.countryCode;
  if (sameCountry) return { value: 1, explanation: "Basé(e) dans le pays de la mission." };
  if (c.mobilityCountries.includes(need.countryCode)) return { value: 0.9, explanation: "Pays de mission dans sa zone d'intervention." };
  const remoteBonus = need.workMode === "HYBRID" && c.remoteOk ? 0.2 : 0;
  if (c.mobility === "INTERNATIONAL") return { value: 0.8 + remoteBonus / 2, explanation: "Mobilité internationale." };
  if (c.mobility === "REGIONAL" && sameRegion(c.countryCode, need.countryCode)) return { value: 0.75, explanation: "Mobilité régionale compatible." };
  return { value: Math.min(1, 0.2 + remoteBonus), explanation: "Hors de sa zone de mobilité déclarée." };
}

function scoreLanguages(need: MissionNeed, c: CandidateProfile) {
  if (need.languages.length === 0) return { value: 1, missing: [] as string[], explanation: "Aucune langue exigée." };
  const missing = need.languages.filter((l) => !c.languages.includes(l));
  const value = (need.languages.length - missing.length) / need.languages.length;
  return { value, missing, explanation: missing.length ? `Langue(s) non déclarée(s) : ${missing.join(", ")}.` : "Toutes les langues requises sont maîtrisées." };
}

/** Score d'un candidat pour un besoin donné. */
export function scoreCandidate(need: MissionNeed, c: CandidateProfile, weightsInput?: Partial<MatchingWeights>): MatchResult {
  const weights = normalizeWeights(weightsInput);
  const skills = scoreSkills(need, c);
  const experience = scoreExperience(need, c);
  const references = scoreReferences(c);
  const availability = scoreAvailability(need, c);
  const location = scoreLocation(need, c);
  const languages = scoreLanguages(need, c);

  // Critères obligatoires
  const exclusionReasons: string[] = [];
  const has = new Set(c.skills.map((s) => s.skillId));
  const mandatoryMissing = need.requirements.filter((r) => r.mandatory && !has.has(r.skillId)).map((r) => r.skillName);
  if (mandatoryMissing.length) exclusionReasons.push(`Compétence(s) obligatoire(s) absente(s) : ${mandatoryMissing.join(", ")}`);
  if (c.availability === "UNAVAILABLE") exclusionReasons.push("Expert indisponible");
  if (need.workMode === "ONSITE" && location.value < 0.5) exclusionReasons.push("Mission sur site hors de la zone de mobilité");

  const parts: [Criterion, number, string][] = [
    ["skills", skills.value, skills.explanation],
    ["experience", experience.value, experience.explanation],
    ["references", references.value, references.explanation],
    ["availability", availability.value, availability.explanation],
    ["location", location.value, location.explanation],
    ["languages", languages.value, languages.explanation],
  ];
  const breakdown: CriterionResult[] = parts.map(([criterion, value, explanation]) => ({
    criterion,
    weight: Math.round(weights[criterion] * 10) / 10,
    value: Math.round(value * 1000) / 1000,
    points: Math.round(value * weights[criterion] * 10) / 10,
    explanation,
  }));
  const score = Math.round(parts.reduce((s, [k, v]) => s + v * weights[k], 0) * 10) / 10;

  const overBudget =
    !!need.budgetMaxMinor && !!c.dailyRateMinor && !!need.durationDays && (!need.currency || need.currency === c.rateCurrency)
      ? c.dailyRateMinor * need.durationDays > need.budgetMaxMinor
      : false;

  return { expertId: c.expertId, eligible: exclusionReasons.length === 0, exclusionReasons, score, breakdown, missingSkills: skills.missing, overBudget };
}

/** Classement : éligibles d'abord, puis score décroissant, puis identifiant (ordre stable). */
export function rankCandidates(need: MissionNeed, candidates: CandidateProfile[], weights?: Partial<MatchingWeights>): MatchResult[] {
  return candidates
    .map((c) => scoreCandidate(need, c, weights))
    .sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score || a.expertId.localeCompare(b.expertId));
}

// ─────────────────────────────────────────────────────────────
// Matching d'équipes pluridisciplinaires
// ─────────────────────────────────────────────────────────────

export interface TeamRole {
  key: string;
  label: string;
  need: MissionNeed;
  /** Jours/personne prévus sur ce rôle (pour le contrôle budgétaire) */
  days: number;
}

export interface TeamProposal {
  assignments: { roleKey: string; roleLabel: string; expertId: string | null; score: number; costMinor: number | null; note: string }[];
  totalCostMinor: number;
  withinBudget: boolean | null;
  uncoveredRoles: string[];
  /** Compétences requises par l'ensemble des rôles, non couvertes par l'équipe proposée */
  missingSkills: string[];
}

/**
 * Proposition d'équipe : affectation gloutonne rôle par rôle (rôles les plus contraints d'abord),
 * un expert ne pouvant occuper qu'un rôle, en respectant le budget global si fourni.
 * Résultat déterministe ; à valider par un humain.
 */
export function proposeTeam(roles: TeamRole[], candidates: CandidateProfile[], budgetMaxMinor?: number | null, weights?: Partial<MatchingWeights>): TeamProposal {
  const ranked = roles.map((role, index) => ({ role, index, results: rankCandidates(role.need, candidates, weights).filter((r) => r.eligible) }));
  // Rôles avec le moins de candidats éligibles traités en premier ; à égalité, ordre de saisie.
  ranked.sort((a, b) => a.results.length - b.results.length || a.index - b.index);

  const used = new Set<string>();
  const byId = new Map(candidates.map((c) => [c.expertId, c]));
  let total = 0;
  const assignments: TeamProposal["assignments"] = [];

  for (const { role, results } of ranked) {
    const remainingBudget = budgetMaxMinor ? budgetMaxMinor - total : null;
    const pick = results.find((r) => {
      if (used.has(r.expertId)) return false;
      const rate = byId.get(r.expertId)?.dailyRateMinor;
      if (remainingBudget !== null && rate) return rate * role.days <= remainingBudget;
      return true;
    });
    if (!pick) {
      assignments.push({ roleKey: role.key, roleLabel: role.label, expertId: null, score: 0, costMinor: null, note: results.length ? "Aucun candidat compatible avec le budget restant." : "Aucun candidat éligible." });
      continue;
    }
    used.add(pick.expertId);
    const rate = byId.get(pick.expertId)?.dailyRateMinor ?? null;
    const cost = rate ? rate * role.days : null;
    total += cost ?? 0;
    assignments.push({ roleKey: role.key, roleLabel: role.label, expertId: pick.expertId, score: pick.score, costMinor: cost, note: cost === null ? "Tarif non renseigné : coût à confirmer." : "" });
  }

  // Ordre d'origine des rôles pour l'affichage.
  const order = new Map(roles.map((r, i) => [r.key, i]));
  assignments.sort((a, b) => (order.get(a.roleKey) ?? 0) - (order.get(b.roleKey) ?? 0));

  const teamSkills = new Set(assignments.flatMap((a) => (a.expertId ? (byId.get(a.expertId)?.skills ?? []).map((s) => s.skillId) : [])));
  const missingSkills = [...new Set(roles.flatMap((r) => r.need.requirements.filter((q) => !teamSkills.has(q.skillId)).map((q) => q.skillName)))];

  return {
    assignments,
    totalCostMinor: total,
    withinBudget: budgetMaxMinor ? total <= budgetMaxMinor : null,
    uncoveredRoles: assignments.filter((a) => !a.expertId).map((a) => a.roleLabel),
    missingSkills,
  };
}

// ─────────────────────────────────────────────────────────────
// Extraction déterministe des compétences d'un texte de besoin
// ─────────────────────────────────────────────────────────────

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .replace(/\.(?=\s|$)/g, " ") // ponctuation finale (« … une EIES. ») ; conserve « next.js »
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Repère dans un texte libre les compétences du référentiel (nom FR/EN ou synonymes),
 * par correspondance de mots entiers. Ne crée jamais de compétence absente du référentiel.
 */
export function extractSkills(text: string, catalog: { id: string; nameFr: string; nameEn: string; synonyms: string[] }[]): { id: string; matched: string }[] {
  const hay = ` ${normalizeText(text)} `;
  const found: { id: string; matched: string }[] = [];
  for (const s of catalog) {
    const terms = [s.nameFr, s.nameEn, ...s.synonyms].map(normalizeText).filter((t) => t.length >= 2);
    const hit = terms.find((t) => hay.includes(` ${t} `));
    if (hit) found.push({ id: s.id, matched: hit });
  }
  return found;
}
