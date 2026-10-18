"use client";
/**
 * Formulaire de mission (création ou modification) : React Hook Form + Zod (schéma partagé),
 * exigences de compétences issues du référentiel et analyse automatique du besoin.
 */
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { z } from "zod";
import { Loader2, Plus, Trash2, Wand2 } from "lucide-react";
import { missionSchema, type MissionInput } from "@/application/schemas";
import { api, ApiError } from "./api";
import { Button } from "./Button";
import { Checkbox, Field, Input, Select, Textarea } from "./Field";
import { Alert } from "./Feedback";
import { useToast } from "./Toast";

type FormValues = z.input<typeof missionSchema>;

export function MissionForm({ countries, domains, skills, initial, missionId }: { countries: { code: string; nameFr: string }[]; domains: { id: string; nameFr: string }[]; skills: { id: string; nameFr: string; domainId: string | null }[]; initial?: Partial<FormValues>; missionId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const { register, control, handleSubmit, getValues, setValue, formState: { errors, isSubmitting } } = useForm<FormValues, unknown, MissionInput>({
    resolver: zodResolver(missionSchema),
    defaultValues: { languages: ["fr"], workMode: "HYBRID", visibility: "PUBLIC", currency: "XOF", countryCode: "CI", experienceYearsMin: 5, requirements: [], ...initial },
  });
  const reqs = useFieldArray({ control, name: "requirements" });
  const skillName = (id: string) => skills.find((s) => s.id === id)?.nameFr ?? id;

  async function analyze() {
    const text = `${getValues("title") ?? ""}\n${getValues("description") ?? ""}\n${getValues("objectives") ?? ""}`;
    setAnalyzing(true);
    try {
      const r = await api<{ skills: { skillId: string; nameFr: string; domainId: string | null }[] }>("/api/v1/matching/analyze", { body: { text } });
      const existing = new Set(getValues("requirements")?.map((x) => x.skillId));
      const added = r.skills.filter((s) => !existing.has(s.skillId));
      added.forEach((s) => reqs.append({ skillId: s.skillId, mandatory: false, minLevel: 3 }));
      if (!getValues("domainId") && r.skills[0]?.domainId) setValue("domainId", r.skills[0].domainId);
      toast("success", added.length ? `${added.length} compétence(s) repérée(s) dans votre texte : vérifiez-les.` : "Aucune nouvelle compétence repérée.");
    } catch (e) {
      toast("error", e instanceof ApiError ? e.message : "Analyse impossible.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function onSubmit(values: MissionInput) {
    setError(null);
    try {
      if (missionId) {
        await api(`/api/v1/missions/${missionId}/update`, { body: values });
        toast("success", "Mission mise à jour.");
        router.push(`/organisation/missions/${missionId}`);
      } else {
        const r = await api<{ redirectUrl: string }>("/api/v1/missions", { body: values });
        toast("success", "Mission créée en brouillon.");
        router.push(r.redirectUrl);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur réseau.");
    }
  }

  const err = (k: keyof FormValues) => (errors[k]?.message as string | undefined) ?? undefined;
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      {error && <Alert tone="error">{error}</Alert>}
      <section className="grid gap-4 rounded-2xl border border-line bg-white p-5 shadow-card sm:grid-cols-2">
        <h2 className="font-display font-bold sm:col-span-2">Le besoin</h2>
        <Field label="Intitulé de la mission" htmlFor="title" required error={err("title")} className="sm:col-span-2"><Input id="title" {...register("title")} /></Field>
        <Field label="Description" htmlFor="description" required error={err("description")} className="sm:col-span-2" hint="Contexte, périmètre, livrables. Le texte sert aussi à repérer les compétences clés."><Textarea id="description" rows={7} {...register("description")} /></Field>
        <Field label="Objectifs" htmlFor="objectives" error={err("objectives")}><Textarea id="objectives" {...register("objectives")} /></Field>
        <Field label="Résultats attendus" htmlFor="expectedResults" error={err("expectedResults")}><Textarea id="expectedResults" {...register("expectedResults")} /></Field>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display font-bold">Compétences requises</h2>
          <Button type="button" variant="outline" size="sm" onClick={analyze} disabled={analyzing}>{analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Analyser le besoin</Button>
        </div>
        <p className="mt-1 text-xs text-slate">L'analyse repère uniquement des compétences existantes du référentiel ; elle n'invente rien. Validez chaque ligne.</p>
        <div className="mt-4 space-y-2">
          {reqs.fields.map((f, i) => (
            <div key={f.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-2 text-sm sm:border-0 sm:p-0">
              <span className="min-w-0 basis-full font-medium sm:flex-1 sm:basis-auto">{skillName(f.skillId)}</span>
              <Select aria-label="Niveau minimal" className="w-32" {...register(`requirements.${i}.minLevel`)}>{[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>Niveau {l}+</option>)}</Select>
              <Checkbox {...register(`requirements.${i}.mandatory`)} label="Obligatoire" />
              <button type="button" onClick={() => reqs.remove(i)} className="rounded-lg p-2 text-slate hover:text-red-700" aria-label="Retirer"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <AddSkill skills={skills} exclude={reqs.fields.map((f) => f.skillId)} onAdd={(id) => reqs.append({ skillId: id, mandatory: false, minLevel: 3 })} />
          {errors.requirements && <p className="text-xs text-red-700">{errors.requirements.message as string}</p>}
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-line bg-white p-5 shadow-card sm:grid-cols-3">
        <h2 className="font-display font-bold sm:col-span-3">Conditions</h2>
        <Field label="Domaine" htmlFor="domainId"><Select id="domainId" {...register("domainId")}><option value="">—</option>{domains.map((d) => <option key={d.id} value={d.id}>{d.nameFr}</option>)}</Select></Field>
        <Field label="Expérience minimale (années)" htmlFor="experienceYearsMin" error={err("experienceYearsMin")}><Input id="experienceYearsMin" type="number" min={0} {...register("experienceYearsMin")} /></Field>
        <Field label="Langues (codes séparés par des virgules)" htmlFor="languages"><Input id="languages" defaultValue={(initial?.languages ?? ["fr"]).join(", ")} onChange={(e) => setValue("languages", e.target.value.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean))} /></Field>
        <Field label="Pays" htmlFor="countryCode" required><Select id="countryCode" {...register("countryCode")}>{countries.map((c) => <option key={c.code} value={c.code}>{c.nameFr}</option>)}</Select></Field>
        <Field label="Ville" htmlFor="city"><Input id="city" {...register("city")} /></Field>
        <Field label="Modalité" htmlFor="workMode"><Select id="workMode" {...register("workMode")}><option value="ONSITE">Sur site</option><option value="REMOTE">À distance</option><option value="HYBRID">Hybride</option></Select></Field>
        <Field label="Durée (jours)" htmlFor="durationDays" error={err("durationDays")}><Input id="durationDays" type="number" min={1} {...register("durationDays")} /></Field>
        <Field label="Date de démarrage" htmlFor="startDate"><Input id="startDate" type="date" {...register("startDate")} /></Field>
        <Field label="Date limite de candidature" htmlFor="applicationDeadline"><Input id="applicationDeadline" type="date" {...register("applicationDeadline")} /></Field>
        <Field label="Budget minimum" htmlFor="budgetMin"><Input id="budgetMin" type="number" min={0} {...register("budgetMin")} /></Field>
        <Field label="Budget maximum" htmlFor="budgetMax" error={err("budgetMax")}><Input id="budgetMax" type="number" min={0} {...register("budgetMax")} /></Field>
        <Field label="Devise" htmlFor="currency"><Select id="currency" {...register("currency")}><option>XOF</option><option>XAF</option><option>EUR</option><option>USD</option><option>GHS</option><option>NGN</option><option>KES</option><option>MAD</option></Select></Field>
        <Field label="Visibilité" htmlFor="visibility" className="sm:col-span-3"><Select id="visibility" {...register("visibility")}><option value="PUBLIC">Publique</option><option value="MEMBERS">Membres connectés</option><option value="INVITE_ONLY">Sur invitation uniquement</option></Select></Field>
      </section>
      <div className="flex justify-end"><Button type="submit" size="lg" disabled={isSubmitting}>{isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}{missionId ? "Enregistrer les modifications" : "Créer la mission (brouillon)"}</Button></div>
    </form>
  );
}

function AddSkill({ skills, exclude, onAdd }: { skills: { id: string; nameFr: string }[]; exclude: string[]; onAdd: (id: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="flex gap-2 pt-2">
      <Select aria-label="Ajouter une compétence" value={v} onChange={(e) => setV(e.target.value)}><option value="">Ajouter une compétence du référentiel…</option>{skills.filter((s) => !exclude.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.nameFr}</option>)}</Select>
      <Button type="button" variant="outline" disabled={!v} onClick={() => { onAdd(v); setV(""); }}><Plus className="h-4 w-4" /> Ajouter</Button>
    </div>
  );
}
