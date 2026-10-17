"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "./api";
import { Button } from "./Button";
import { Alert } from "./Feedback";

/** Quiz : les bonnes réponses ne sont jamais envoyées au navigateur ; correction côté serveur. */
export function QuizForm({ assessmentId, questions }: { assessmentId: string; questions: { id: string; prompt: string; options: string[] }[] }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ scorePct: number; passed: boolean; correct: number; total: number; passingScore: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          setResult(await api("/api/v1/academy/attempt", { body: { assessmentId, answers } }));
          router.refresh();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Erreur.");
        } finally {
          setBusy(false);
        }
      }}
      className="space-y-5"
    >
      {questions.map((q, i) => (
        <fieldset key={q.id}>
          <legend className="font-semibold">{i + 1}. {q.prompt}</legend>
          <div className="mt-2 space-y-1">{q.options.map((o, j) => <label key={j} className="flex items-center gap-2 text-sm"><input type="radio" name={q.id} checked={answers[q.id] === j} onChange={() => setAnswers({ ...answers, [q.id]: j })} className="accent-orange-600" />{o}</label>)}</div>
        </fieldset>
      ))}
      {error && <Alert tone="error">{error}</Alert>}
      {result && <Alert tone={result.passed ? "success" : "warning"} title={result.passed ? "Évaluation réussie" : "Évaluation non réussie"}>Score : {result.scorePct} % ({result.correct}/{result.total}) — seuil {result.passingScore} %.</Alert>}
      <Button type="submit" disabled={busy || Object.keys(answers).length < questions.length}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Valider mes réponses</Button>
    </form>
  );
}
