/** Règles de l'Academy : correction des évaluations et conditions de délivrance des certificats. */
export interface Question {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
}

export function gradeAttempt(questions: Question[], answers: Record<string, number>): { scorePct: number; correct: number; total: number } {
  const total = questions.length;
  if (total === 0) return { scorePct: 0, correct: 0, total: 0 };
  const correct = questions.filter((q) => answers[q.id] === q.answer).length;
  return { scorePct: Math.round((correct * 100) / total), correct, total };
}

/** Questions sans les bonnes réponses (seule forme envoyée au navigateur). */
export function publicQuestions(questions: Question[]): Omit<Question, "answer">[] {
  return questions.map(({ id, prompt, options }) => ({ id, prompt, options }));
}

/**
 * Un certificat n'est délivré que si : toutes les leçons sont terminées, l'évaluation finale
 * (s'il y en a une) est réussie au seuil défini et, pour les formats en sessions datées
 * (classe virtuelle, présentiel, hybride, séminaires), la présence a été attestée par le formateur.
 */
export function certificateEligibility(input: { lessonsTotal: number; lessonsDone: number; hasFinal: boolean; bestScorePct: number | null; passingScore: number; sessionBased?: boolean; attended?: boolean }): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (input.lessonsTotal === 0 && !input.sessionBased) reasons.push("Le cours ne contient aucune leçon.");
  if (input.lessonsDone < input.lessonsTotal) reasons.push(`Leçons terminées : ${input.lessonsDone}/${input.lessonsTotal}.`);
  if (input.hasFinal && (input.bestScorePct ?? 0) < input.passingScore) reasons.push(`Évaluation finale non réussie (seuil ${input.passingScore} %).`);
  if (input.sessionBased && !input.attended) reasons.push("Présence à la session non encore attestée par le formateur.");
  return { eligible: reasons.length === 0, reasons };
}

export type CourseKind = "TRAINING" | "SEMINAR";
export type CourseFormat = "ONLINE" | "VIRTUAL_CLASS" | "IN_PERSON" | "BLENDED";

export const COURSE_KIND_LABELS: Record<CourseKind, string> = { TRAINING: "Formation", SEMINAR: "Séminaire" };
export const COURSE_FORMAT_LABELS: Record<CourseFormat, string> = { ONLINE: "En ligne, à votre rythme", VIRTUAL_CLASS: "Classe virtuelle", IN_PERSON: "Présentiel", BLENDED: "Hybride" };

/** Les formats autres que « en ligne » se déroulent en sessions datées : l'inscription porte sur une session. */
export function isSessionBased(c: { kind: CourseKind | string; format: CourseFormat | string }): boolean {
  return c.kind === "SEMINAR" || c.format !== "ONLINE";
}

/** Places restantes (null = illimité). */
export function seatsLeft(capacity: number | null, taken: number): number | null {
  return capacity == null ? null : Math.max(0, capacity - taken);
}

/** Libellés du certificat selon le type et le format (anciens certificats : formation en ligne). */
export interface CertificateWording { subtitle: string; body: string; closing: string; durationLabel: string }
export function certificateWording(kind: string = "TRAINING", format: string = "ONLINE"): CertificateWording {
  if (kind === "SEMINAR") return { subtitle: "De participation", body: "a participé au séminaire", closing: "et a pris part à l'ensemble des travaux, présence attestée par le formateur.", durationLabel: "Durée du séminaire" };
  const body = { ONLINE: "a suivi avec succès la formation en ligne", VIRTUAL_CLASS: "a suivi avec succès la formation en classe virtuelle", IN_PERSON: "a suivi avec succès la formation présentielle", BLENDED: "a suivi avec succès la formation hybride" }[format] ?? "a suivi avec succès la formation";
  return { subtitle: format === "ONLINE" ? "De formation en ligne" : "De formation", body, closing: "et a satisfait à l'ensemble des exigences pédagogiques et des évaluations requises.", durationLabel: "Durée de la formation" };
}

export function progressPct(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done * 100) / total);
}
