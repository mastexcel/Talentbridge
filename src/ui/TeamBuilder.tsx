"use client";
import Link from "next/link";
import { useState } from "react";
import { Loader2, Plus, Trash2, Users } from "lucide-react";
import { api, ApiError } from "./api";
import { Button } from "./Button";
import { Input } from "./Field";
import { Alert } from "./Feedback";
import { useToast } from "./Toast";

type Role = { key: string; label: string; skillIds: string[]; days: number };
type Proposal = { proposal: { assignments: { roleKey: string; roleLabel: string; expertId: string | null; score: number; costMinor: number | null; note: string }[]; totalCostMinor: number; withinBudget: boolean | null; uncoveredRoles: string[]; missingSkills: string[] }; profiles: { id: string; slug: string; headline: string | null; user: { firstName: string; lastName: string } }[]; currency: string };

const fmt = (v: number, c: string) => (c === "XOF" || c === "XAF" ? `${new Intl.NumberFormat("fr-FR").format(v)} FCFA` : `${(v / 100).toFixed(2)} ${c}`);

/** Matching d'équipe : rôles, compétences, jours, budget — proposition déterministe à valider. */
export function TeamBuilder({ missionId, skills }: { missionId: string; skills: { id: string; nameFr: string }[] }) {
  const toast = useToast();
  const [roles, setRoles] = useState<Role[]>([{ key: "r1", label: "Chef de mission", skillIds: [], days: 20 }, { key: "r2", label: "Expert technique", skillIds: [], days: 15 }]);
  const [budget, setBudget] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Proposal | null>(null);
  const update = (i: number, patch: Partial<Role>) => setRoles(roles.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function run() {
    setBusy(true);
    try {
      setResult(await api<Proposal>(`/api/v1/missions/${missionId}/team`, { body: { roles, budgetMax: budget ? Number(budget) : null } }));
    } catch (e) {
      toast("error", e instanceof ApiError ? e.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  }
  const byId = new Map(result?.profiles.map((p) => [p.id, p]) ?? []);
  return (
    <div className="space-y-4">
      {roles.map((r, i) => (
        <div key={r.key} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1fr_1.4fr_90px_40px]">
          <Input aria-label="Rôle" value={r.label} onChange={(e) => update(i, { label: e.target.value })} />
          <select aria-label="Compétences du rôle" multiple value={r.skillIds} onChange={(e) => update(i, { skillIds: Array.from(e.target.selectedOptions).map((o) => o.value) })} className="h-20 rounded-xl border border-line p-1 text-xs">
            {skills.map((s) => <option key={s.id} value={s.id}>{s.nameFr}</option>)}
          </select>
          <Input aria-label="Jours" type="number" min={1} value={r.days} onChange={(e) => update(i, { days: Number(e.target.value) })} />
          <button type="button" onClick={() => setRoles(roles.filter((_, j) => j !== i))} aria-label="Retirer le rôle" className="text-slate hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setRoles([...roles, { key: `r${Date.now()}`, label: "Nouveau rôle", skillIds: [], days: 10 }])}><Plus className="h-4 w-4" /> Ajouter un rôle</Button>
        <Input aria-label="Budget maximal de l'équipe" type="number" min={0} placeholder="Budget max (vide = budget de la mission)" value={budget} onChange={(e) => setBudget(e.target.value)} className="max-w-xs" />
        <Button type="button" onClick={run} disabled={busy || roles.some((r) => r.skillIds.length === 0)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />} Proposer une équipe</Button>
      </div>
      {roles.some((r) => r.skillIds.length === 0) && <p className="text-xs text-slate">Sélectionnez au moins une compétence par rôle (Ctrl/Cmd + clic pour plusieurs).</p>}
      {result && (
        <div className="space-y-3">
          {result.proposal.withinBudget === false && <Alert tone="warning">Le coût estimé dépasse le budget.</Alert>}
          {result.proposal.uncoveredRoles.length > 0 && <Alert tone="warning">Rôles non pourvus : {result.proposal.uncoveredRoles.join(", ")}.</Alert>}
          <ul className="divide-y divide-line rounded-xl border border-line">
            {result.proposal.assignments.map((a) => {
              const p = a.expertId ? byId.get(a.expertId) : null;
              return (
                <li key={a.roleKey} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <span className="font-semibold">{a.roleLabel}</span>
                  {p ? <Link href={`/experts/${p.slug}`} className="text-orange-700 underline">{p.user.firstName} {p.user.lastName}</Link> : <span className="text-slate">{a.note}</span>}
                  <span className="text-xs text-slate">{a.expertId ? `score ${a.score.toFixed(0)}/100` : ""}{a.costMinor !== null ? ` · ${fmt(a.costMinor, result.currency)}` : a.expertId ? " · coût à confirmer" : ""}</span>
                </li>
              );
            })}
          </ul>
          <p className="text-sm">Coût estimé : <strong>{fmt(result.proposal.totalCostMinor, result.currency)}</strong>{result.proposal.missingSkills.length > 0 && <> · compétences non couvertes : {result.proposal.missingSkills.join(", ")}</>}</p>
          <p className="text-xs text-slate">Proposition indicative, à valider : invitez ensuite les experts à candidater ou ajoutez-les à la shortlist.</p>
        </div>
      )}
    </div>
  );
}
