import { AlertTriangle } from "lucide-react";

const LABELS: Record<string, string> = { skills: "Compétences", experience: "Expérience", references: "Références vérifiées", availability: "Disponibilité", location: "Localisation & mobilité", languages: "Langues" };

/** Détail explicable d'un score de matching (critère, poids, contribution, justification). */
export function MatchBreakdown({ breakdown, exclusionReasons = [], missingSkills = [], overBudget }: { breakdown: { criterion: string; weight: number; value: number; points: number; explanation: string }[]; exclusionReasons?: string[]; missingSkills?: string[]; overBudget?: boolean }) {
  return (
    <div className="space-y-2 text-xs">
      {exclusionReasons.map((r) => <p key={r} className="flex items-center gap-1 font-semibold text-red-700"><AlertTriangle className="h-3.5 w-3.5" />{r}</p>)}
      {breakdown.map((c) => (
        <div key={c.criterion}>
          <div className="flex justify-between"><span className="font-semibold">{LABELS[c.criterion] ?? c.criterion}</span><span className="tabular-nums text-slate">{c.points.toFixed(1)} / {c.weight.toFixed(0)} pts</span></div>
          <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-olive-600" style={{ width: `${Math.round(c.value * 100)}%` }} /></div>
          <p className="mt-0.5 text-slate">{c.explanation}</p>
        </div>
      ))}
      {missingSkills.length > 0 && <p className="text-orange-800">Compétences manquantes : {missingSkills.join(", ")}</p>}
      {overBudget && <p className="text-orange-800">Le tarif indicatif dépasse le budget maximal annoncé.</p>}
    </div>
  );
}

export function ScorePill({ score, eligible = true }: { score: number; eligible?: boolean }) {
  const tone = !eligible ? "bg-mist text-slate" : score >= 75 ? "bg-olive-100 text-olive-800" : score >= 50 ? "bg-orange-100 text-orange-800" : "bg-red-100 text-red-800";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-display text-sm font-extrabold tabular-nums ${tone}`}>{score.toFixed(0)}/100</span>;
}
