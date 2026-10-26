"use client";
/**
 * Relecture des informations trouvées dans le CV : l'expert corrige, coche ce qu'il garde, puis
 * enregistre. Rien n'est enregistré sans cette validation.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { CvDraft } from "@/domain/cv-parser";
import { api, ApiError } from "./api";
import { useToast } from "./Toast";
import { Button } from "./Button";
import { Checkbox, Input, Select, Textarea } from "./Field";
import { Card, CardBody, CardHeader } from "./Card";

const LANG_LABELS: Record<string, string> = { fr: "Français", en: "Anglais", pt: "Portugais", ar: "Arabe", es: "Espagnol", sw: "Swahili" };
const LEVELS = [[1, "Notions"], [2, "Intermédiaire"], [3, "Confirmé"], [4, "Avancé"], [5, "Expert"]] as const;
const month = (iso: string | null) => (iso ? iso.slice(0, 7) : "");

type Exp = CvDraft["experiences"][number] & { keep: boolean; current: boolean };
type Qual = CvDraft["qualifications"][number] & { keep: boolean };

export function CvImportForm({
  draft,
  current,
  domainNames,
  countryNames,
}: {
  draft: CvDraft;
  current: { headline: string | null; bio: string | null; yearsExperience: number; countryCode: string | null; languages: string[] };
  domainNames: Record<string, string>;
  countryNames: Record<string, string>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Champs uniques : cochés par défaut seulement s'ils sont vides dans le profil (rien n'est écrasé sans le vouloir).
  const [headline, setHeadline] = useState({ keep: !!draft.headline && !current.headline, value: draft.headline ?? "" });
  const [bio, setBio] = useState({ keep: !!draft.bio && !current.bio, value: draft.bio ?? "" });
  const [years, setYears] = useState({ keep: draft.yearsExperience != null && current.yearsExperience === 0, value: draft.yearsExperience ?? 0 });
  const [country, setCountry] = useState({ keep: !!draft.countryCode && !current.countryCode, value: draft.countryCode ?? "" });
  const [langs, setLangs] = useState(draft.languages.filter((l) => !current.languages.includes(l)));
  const [domains, setDomains] = useState(draft.domainIds);
  const [skills, setSkills] = useState(draft.skills.map((s) => ({ ...s, keep: true, level: 3, years: 0 })));
  const [exps, setExps] = useState<Exp[]>(draft.experiences.map((e) => ({ ...e, keep: true, current: e.endDate == null })));
  const [quals, setQuals] = useState<Qual[]>(draft.qualifications.map((q) => ({ ...q, keep: true })));

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const nothingFound = !draft.headline && !draft.bio && draft.yearsExperience == null && !draft.countryCode && !draft.languages.length && !draft.domainIds.length && !draft.skills.length && !draft.experiences.length && !draft.qualifications.length;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body = {
        headline: headline.keep ? headline.value : null,
        bio: bio.keep ? bio.value : null,
        yearsExperience: years.keep ? years.value : null,
        countryCode: country.keep && country.value ? country.value : null,
        languages: langs,
        domainIds: domains,
        skills: skills.filter((s) => s.keep).map(({ skillId, level, years }) => ({ skillId, level, years })),
        experiences: exps.filter((e) => e.keep).map((e) => ({ title: e.title, employer: e.employer, startDate: `${month(e.startDate)}-01`, endDate: e.current || !e.endDate ? null : `${month(e.endDate)}-01`, description: e.description || null })),
        qualifications: quals.filter((q) => q.keep).map((q) => ({ kind: q.kind, title: q.title, institution: q.institution, year: q.year })),
      };
      const r = await api<{ redirectUrl: string; experiences: number; qualifications: number; skills: number }>("/api/v1/me/cv-import", { body });
      toast("success", `Profil complété : ${r.experiences} expérience(s), ${r.qualifications} diplôme(s) et certification(s), ${r.skills} compétence(s).`);
      router.push(r.redirectUrl);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Enregistrement impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  if (nothingFound) return <p className="rounded-xl bg-mist p-4 text-slate">Aucune information exploitable n&apos;a été trouvée dans ce CV. Complétez votre profil manuellement.</p>;

  return (
    <div className="space-y-6">
      {(draft.headline || draft.bio || draft.yearsExperience != null || draft.countryCode) && (
        <Card>
          <CardHeader title="Présentation" description="Cochez ce qui doit remplacer les informations actuelles de votre profil." />
          <CardBody className="space-y-4">
            {draft.headline && (
              <div className="space-y-1.5">
                <Checkbox label={<span>Accroche{current.headline && <span className="text-slate"> (actuelle : « {current.headline} »)</span>}</span>} checked={headline.keep} onChange={(e) => setHeadline({ ...headline, keep: e.target.checked })} />
                <Input aria-label="Accroche" value={headline.value} maxLength={160} onChange={(e) => setHeadline({ keep: true, value: e.target.value })} />
              </div>
            )}
            {draft.bio && (
              <div className="space-y-1.5">
                <Checkbox label={<span>Biographie{current.bio && <span className="text-slate"> (remplace l&apos;actuelle)</span>}</span>} checked={bio.keep} onChange={(e) => setBio({ ...bio, keep: e.target.checked })} />
                <Textarea aria-label="Biographie" value={bio.value} rows={4} maxLength={2000} onChange={(e) => setBio({ keep: true, value: e.target.value })} />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {draft.yearsExperience != null && (
                <div className="space-y-1.5">
                  <Checkbox label={`Années d'expérience (actuel : ${current.yearsExperience})`} checked={years.keep} onChange={(e) => setYears({ ...years, keep: e.target.checked })} />
                  <Input aria-label="Années d'expérience" type="number" min={0} max={60} value={years.value} onChange={(e) => setYears({ keep: true, value: Math.max(0, Math.min(60, +e.target.value || 0)) })} />
                </div>
              )}
              {draft.countryCode && (
                <div className="space-y-1.5">
                  <Checkbox label="Pays de résidence" checked={country.keep} onChange={(e) => setCountry({ ...country, keep: e.target.checked })} />
                  <Select aria-label="Pays" value={country.value} onChange={(e) => setCountry({ keep: true, value: e.target.value })}>
                    {Object.entries(countryNames).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                  </Select>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {(skills.length > 0 || draft.domainIds.length > 0 || draft.languages.length > 0) && (
        <Card>
          <CardHeader title="Compétences, domaines et langues" description="Compétences reconnues dans le référentiel Talent Bridge ; précisez votre niveau." />
          <CardBody className="space-y-5">
            {skills.length > 0 && (
              <ul className="divide-y divide-line">
                {skills.map((s, i) => (
                  <li key={s.skillId} className="flex flex-wrap items-center gap-3 py-2">
                    <Checkbox className="min-w-48 flex-1" label={<span>{s.name} <span className="text-xs text-slate">(« {s.evidence} »)</span></span>} checked={s.keep} onChange={(e) => setSkills(skills.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)))} />
                    <Select aria-label={`Niveau en ${s.name}`} className="w-40" value={s.level} onChange={(e) => setSkills(skills.map((x, j) => (j === i ? { ...x, level: +e.target.value } : x)))}>
                      {LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </Select>
                    <label className="flex items-center gap-2 text-sm text-slate">
                      <Input aria-label={`Années en ${s.name}`} type="number" min={0} max={60} className="w-20" value={s.years} onChange={(e) => setSkills(skills.map((x, j) => (j === i ? { ...x, years: Math.max(0, Math.min(60, +e.target.value || 0)) } : x)))} /> an(s)
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {draft.domainIds.length > 0 && (
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">Domaines d&apos;expertise</legend>
                <div className="flex flex-wrap gap-x-5 gap-y-2">{draft.domainIds.map((d) => <Checkbox key={d} label={domainNames[d] ?? d} checked={domains.includes(d)} onChange={() => setDomains(toggle(domains, d))} />)}</div>
              </fieldset>
            )}
            {draft.languages.length > 0 && (
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">Langues</legend>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {draft.languages.map((l) => current.languages.includes(l)
                    ? <span key={l} className="text-sm text-slate">{LANG_LABELS[l]} (déjà au profil)</span>
                    : <Checkbox key={l} label={LANG_LABELS[l] ?? l} checked={langs.includes(l)} onChange={() => setLangs(toggle(langs, l))} />)}
                </div>
              </fieldset>
            )}
          </CardBody>
        </Card>
      )}

      {exps.length > 0 && (
        <Card>
          <CardHeader title={`Expériences professionnelles (${exps.length})`} description="Vérifiez les intitulés, employeurs et dates." />
          <CardBody className="space-y-4">
            {exps.map((e, i) => {
              const set = (patch: Partial<Exp>) => setExps(exps.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <div key={i} className="space-y-2 rounded-xl border border-line p-3">
                  <Checkbox label={<span className="font-semibold">Ajouter cette expérience</span>} checked={e.keep} onChange={(ev) => set({ keep: ev.target.checked })} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input aria-label="Intitulé du poste" value={e.title} maxLength={140} onChange={(ev) => set({ title: ev.target.value })} />
                    <Input aria-label="Employeur" value={e.employer} maxLength={140} onChange={(ev) => set({ employer: ev.target.value })} />
                    <label className="text-xs text-slate">Début<Input type="month" value={month(e.startDate)} onChange={(ev) => set({ startDate: `${ev.target.value}-01` })} /></label>
                    <label className="text-xs text-slate">Fin<Input type="month" value={month(e.endDate)} disabled={e.current} onChange={(ev) => set({ endDate: ev.target.value ? `${ev.target.value}-01` : null })} /></label>
                  </div>
                  <Checkbox label="Poste actuel" checked={e.current} onChange={(ev) => set({ current: ev.target.checked })} />
                  {e.description && <Textarea aria-label="Description" rows={2} value={e.description} maxLength={2000} onChange={(ev) => set({ description: ev.target.value })} />}
                </div>
              );
            })}
          </CardBody>
        </Card>
      )}

      {quals.length > 0 && (
        <Card>
          <CardHeader title={`Diplômes et certifications (${quals.length})`} description="Ils seront ajoutés comme « déclarés » : déposez ensuite les justificatifs pour les faire vérifier." />
          <CardBody className="space-y-3">
            {quals.map((q, i) => {
              const set = (patch: Partial<Qual>) => setQuals(quals.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <div key={i} className="grid items-center gap-2 rounded-xl border border-line p-3 sm:grid-cols-[auto_9rem_1fr_1fr_6rem]">
                  <input type="checkbox" aria-label="Ajouter" className="h-4 w-4 accent-orange-600" checked={q.keep} onChange={(ev) => set({ keep: ev.target.checked })} />
                  <Select aria-label="Type" value={q.kind} onChange={(ev) => set({ kind: ev.target.value as Qual["kind"] })}><option value="DEGREE">Diplôme</option><option value="CERTIFICATION">Certification</option></Select>
                  <Input aria-label="Intitulé" value={q.title} maxLength={160} onChange={(ev) => set({ title: ev.target.value })} />
                  <Input aria-label="Établissement" value={q.institution} maxLength={160} onChange={(ev) => set({ institution: ev.target.value })} />
                  <Input aria-label="Année" type="number" min={1950} max={2100} value={q.year ?? ""} onChange={(ev) => set({ year: ev.target.value ? +ev.target.value : null })} />
                </div>
              );
            })}
          </CardBody>
        </Card>
      )}

      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="button" size="lg" onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer dans mon profil</Button>
        <Button type="button" size="lg" variant="outline" onClick={() => router.push("/espace/profil")} disabled={busy}>Annuler</Button>
      </div>
    </div>
  );
}
