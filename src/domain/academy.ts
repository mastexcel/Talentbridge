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
 * Un certificat n'est délivré que si : toutes les leçons sont terminées ET
 * l'évaluation finale (s'il y en a une) est réussie au seuil défini.
 */
export function certificateEligibility(input: { lessonsTotal: number; lessonsDone: number; hasFinal: boolean; bestScorePct: number | null; passingScore: number }): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (input.lessonsTotal === 0) reasons.push("Le cours ne contient aucune leçon.");
  if (input.lessonsDone < input.lessonsTotal) reasons.push(`Leçons terminées : ${input.lessonsDone}/${input.lessonsTotal}.`);
  if (input.hasFinal && (input.bestScorePct ?? 0) < input.passingScore) reasons.push(`Évaluation finale non réussie (seuil ${input.passingScore} %).`);
  return { eligible: reasons.length === 0, reasons };
}

export function progressPct(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done * 100) / total);
}
