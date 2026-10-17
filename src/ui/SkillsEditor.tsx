"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ApiForm } from "./ApiForm";
import { Select, Input } from "./Field";
import { Button } from "./Button";

type Row = { skillId: string; level: number; years: number };

/** Édition des compétences : uniquement des compétences du référentiel (aucune saisie libre inventée). */
export function SkillsEditor({ catalog, initial }: { catalog: { id: string; nameFr: string; domain: string | null }[]; initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [pick, setPick] = useState("");
  const used = new Set(rows.map((r) => r.skillId));
  const name = (id: string) => catalog.find((c) => c.id === id)?.nameFr ?? id;
  return (
    <ApiForm action="/api/v1/me/skills" submitLabel="Enregistrer les compétences" successMessage="Compétences enregistrées." transform={() => ({ skills: rows })}>
      <div className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-slate">Aucune compétence. Ajoutez-en au moins 3.</p>}
        {rows.map((r, i) => (
          <div key={r.skillId} className="grid grid-cols-[1fr_120px_110px_40px] items-center gap-2 text-sm">
            <span className="font-medium">{name(r.skillId)}</span>
            <Select aria-label={`Niveau ${name(r.skillId)}`} value={r.level} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, level: Number(e.target.value) } : x)))}>
              {[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>Niveau {l}/5</option>)}
            </Select>
            <Input aria-label={`Années ${name(r.skillId)}`} type="number" min={0} max={60} value={r.years} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, years: Number(e.target.value) } : x)))} />
            <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="rounded-lg p-2 text-slate hover:bg-red-50 hover:text-red-700" aria-label={`Retirer ${name(r.skillId)}`}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Select aria-label="Compétence à ajouter" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">Choisir une compétence du référentiel…</option>
          {catalog.filter((c) => !used.has(c.id)).map((c) => <option key={c.id} value={c.id}>{c.nameFr}{c.domain ? ` — ${c.domain}` : ""}</option>)}
        </Select>
        <Button type="button" variant="outline" disabled={!pick} onClick={() => { setRows([...rows, { skillId: pick, level: 3, years: 1 }]); setPick(""); }}><Plus className="h-4 w-4" /> Ajouter</Button>
      </div>
    </ApiForm>
  );
}
