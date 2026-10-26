import type { Metadata } from "next";
import { Trash2, Wand2 } from "lucide-react";
import { prisma } from "@/infrastructure/db";
import { requireExpertUser } from "@/lib/session";
import { getMyProfile } from "@/application/expert.service";
import { fromMinor } from "@/domain/money";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { ApiForm } from "@/ui/ApiForm";
import { ActionButton } from "@/ui/ActionButton";
import { Checkbox, Field, Input, Select, Textarea } from "@/ui/Field";
import { Progress } from "@/ui/Stat";
import { Badge } from "@/ui/Badge";
import { Alert } from "@/ui/Feedback";
import { ButtonLink } from "@/ui/Button";
import { FileUpload } from "@/ui/FileUpload";
import { SkillsEditor } from "@/ui/SkillsEditor";

export const metadata: Metadata = { title: "Mon profil" };

const LANGS = [["fr", "Français"], ["en", "Anglais"], ["pt", "Portugais"], ["ar", "Arabe"], ["es", "Espagnol"], ["sw", "Swahili"]];
const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

function RemoveButton({ kind, id }: { kind: string; id: string }) {
  return <ActionButton action="/api/v1/me/item-remove" body={{ kind, id }} confirm="Supprimer cet élément de votre profil ?" variant="ghost" successMessage="Élément supprimé."><Trash2 className="h-4 w-4" /><span className="sr-only">Supprimer</span></ActionButton>;
}

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ bienvenue?: string; import?: string }> }) {
  const sp = await searchParams;
  const user = await requireExpertUser("/espace/profil");
  const [{ profile: p, completeness }, countries, domains, skills] = await Promise.all([
    getMyProfile(user.expertProfile.id),
    prisma.country.findMany({ where: { isActive: true }, orderBy: { nameFr: "asc" } }),
    prisma.expertiseDomain.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.skill.findMany({ where: { isActive: true }, orderBy: { nameFr: "asc" }, include: { domain: { select: { nameFr: true } } } }),
  ]);
  const myDomains = new Set(p.domains.map((d) => d.domainId));

  return (
    <>
      <PageHeader title="Mon profil d'expert" description="Plus votre profil est complet et vérifié, plus il est recommandé aux organisations." />
      {sp.bienvenue && <Alert tone="success" title="Bienvenue sur Talent Bridge !" className="mb-6">Complétez votre profil (60 % minimum) pour le soumettre à vérification. Gagnez du temps : déposez votre CV (rubrique « Photo et CV ») puis « Remplir mon profil depuis mon CV ». Votre profil est privé par défaut : choisissez « Publique » ou « Membres connectés » dans la visibilité pour apparaître dans l'annuaire et les recommandations.</Alert>}
      {sp.import && <Alert tone="success" className="mb-6">Les informations choisies dans votre CV ont été ajoutées. Vérifiez votre profil et déposez les justificatifs de vos diplômes pour les faire vérifier.</Alert>}
      {!sp.bienvenue && p.visibility === "PRIVATE" && <Alert tone="info" className="mb-6">Votre profil est privé : il n'apparaît ni dans l'annuaire ni dans les recommandations du matching.</Alert>}
      <Card className="mb-6">
        <CardBody>
          <div className="flex justify-between text-sm font-semibold"><span>Complétude du profil</span><span>{completeness.score} %</span></div>
          <Progress value={completeness.score} className="mt-2" tone={completeness.score >= 60 ? "olive" : "orange"} />
          {completeness.missing.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{completeness.missing.map((m) => <Badge key={m.key} tone="orange">{m.label}</Badge>)}</div>}
        </CardBody>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Identité, présentation et préférences" />
            <CardBody>
              <ApiForm action="/api/v1/me/profile" successMessage="Profil enregistré." className="grid gap-4 sm:grid-cols-2">
                <Field label="Titre professionnel" htmlFor="headline" required className="sm:col-span-2"><Input id="headline" name="headline" defaultValue={p.headline ?? ""} placeholder="Ex. Expert en suivi-évaluation de programmes" /></Field>
                <Field label="Présentation" htmlFor="bio" className="sm:col-span-2" hint="Parcours, spécialités, réalisations marquantes (80 caractères minimum)."><Textarea id="bio" name="bio" rows={6} defaultValue={p.bio ?? ""} /></Field>
                <Field label="Pays" htmlFor="countryCode" required><Select id="countryCode" name="countryCode" defaultValue={p.countryCode ?? "CI"}>{countries.map((c) => <option key={c.code} value={c.code}>{c.nameFr}</option>)}</Select></Field>
                <Field label="Ville" htmlFor="city"><Input id="city" name="city" defaultValue={p.city ?? ""} /></Field>
                <Field label="Années d'expérience" htmlFor="yearsExperience" required><Input id="yearsExperience" name="yearsExperience" type="number" min={0} max={60} data-type="number" defaultValue={p.yearsExperience} /></Field>
                <Field label="Visibilité du profil" htmlFor="visibility" hint="Vos coordonnées ne sont jamais publiées."><Select id="visibility" name="visibility" defaultValue={p.visibility}><option value="PUBLIC">Publique (annuaire)</option><option value="MEMBERS">Membres connectés uniquement</option><option value="PRIVATE">Privée (organisations où j'ai candidaté)</option></Select></Field>
                <fieldset className="sm:col-span-2"><legend className="mb-1.5 text-sm font-semibold">Domaines d'expertise (5 max.)</legend><div className="flex flex-wrap gap-3">{domains.map((d) => <Checkbox key={d.id} name="domainIds" value={d.id} data-type="array" defaultChecked={myDomains.has(d.id)} label={d.nameFr} />)}</div></fieldset>
                <fieldset className="sm:col-span-2"><legend className="mb-1.5 text-sm font-semibold">Langues de travail</legend><div className="flex flex-wrap gap-3">{LANGS.map(([c, l]) => <Checkbox key={c} name="languages" value={c} data-type="array" defaultChecked={p.languages.includes(c)} label={l} />)}</div></fieldset>
                <Field label="Disponibilité" htmlFor="availability"><Select id="availability" name="availability" defaultValue={p.availability}><option value="AVAILABLE">Disponible</option><option value="PARTIAL">Partiellement disponible</option><option value="UNAVAILABLE">Indisponible</option></Select></Field>
                <Field label="Disponible à partir du" htmlFor="availableFrom"><Input id="availableFrom" name="availableFrom" type="date" defaultValue={iso(p.availableFrom)} /></Field>
                <Field label="Mobilité géographique" htmlFor="mobility"><Select id="mobility" name="mobility" defaultValue={p.mobility}><option value="LOCAL">Locale</option><option value="NATIONAL">Nationale</option><option value="REGIONAL">Régionale</option><option value="INTERNATIONAL">Internationale</option></Select></Field>
                <div className="flex items-end"><Checkbox name="remoteOk" defaultChecked={p.remoteOk} label="J'accepte les missions à distance" /></div>
                <Field label="Zone d'intervention (pays)" htmlFor="mobilityCountries" className="sm:col-span-2" hint="Ctrl/Cmd + clic pour sélectionner plusieurs pays."><select id="mobilityCountries" name="mobilityCountries" multiple defaultValue={p.mobilityCountries} className="h-28 w-full rounded-xl border border-line p-2 text-sm">{countries.map((c) => <option key={c.code} value={c.code}>{c.nameFr}</option>)}</select></Field>
                <Field label="Tarif journalier indicatif" htmlFor="dailyRate"><Input id="dailyRate" name="dailyRate" type="number" min={0} data-type="number" defaultValue={p.dailyRateMinor && p.rateCurrency ? fromMinor(p.dailyRateMinor, p.rateCurrency) : ""} /></Field>
                <Field label="Devise" htmlFor="rateCurrency"><Select id="rateCurrency" name="rateCurrency" defaultValue={p.rateCurrency ?? "XOF"}><option>XOF</option><option>XAF</option><option>EUR</option><option>USD</option></Select></Field>
                <Field label="Préférences de mission" htmlFor="missionPreferences" className="sm:col-span-2"><Textarea id="missionPreferences" name="missionPreferences" rows={3} defaultValue={p.missionPreferences ?? ""} placeholder="Types de missions, durées, secteurs privilégiés…" /></Field>
              </ApiForm>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Compétences" description="Choisies dans le référentiel ; niveau auto-évalué de 1 à 5 (vérifiable par une évaluation de compétences)." />
            <CardBody><SkillsEditor catalog={skills.map((s) => ({ id: s.id, nameFr: s.nameFr, domain: s.domain?.nameFr ?? null }))} initial={p.skills.map((s) => ({ skillId: s.skillId, level: s.level, years: s.years }))} /></CardBody>
          </Card>

          <Card>
            <CardHeader title="Expériences professionnelles" />
            <CardBody className="space-y-4">
              {p.experiences.map((e) => (
                <div key={e.id} className="flex items-start justify-between gap-3 rounded-xl border border-line p-3 text-sm">
                  <div><p className="font-semibold">{e.title} — {e.employer}</p><p className="text-xs text-slate">{e.startDate.toLocaleDateString("fr-FR")} → {e.endDate ? e.endDate.toLocaleDateString("fr-FR") : "aujourd'hui"}</p></div>
                  <RemoveButton kind="experience" id={e.id} />
                </div>
              ))}
              <details className="rounded-xl bg-mist p-3"><summary className="cursor-pointer text-sm font-semibold">+ Ajouter une expérience</summary>
                <ApiForm action="/api/v1/me/item-add" submitLabel="Ajouter" successMessage="Expérience ajoutée." className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="itemKind" value="experience" />
                  <Field label="Poste" htmlFor="x-title" required><Input id="x-title" name="title" /></Field>
                  <Field label="Employeur / client" htmlFor="x-employer" required><Input id="x-employer" name="employer" /></Field>
                  <Field label="Début" htmlFor="x-start" required><Input id="x-start" name="startDate" type="date" /></Field>
                  <Field label="Fin (vide si en cours)" htmlFor="x-end"><Input id="x-end" name="endDate" type="date" /></Field>
                  <Field label="Pays" htmlFor="x-country"><Select id="x-country" name="countryCode" defaultValue="">{[<option key="" value="">—</option>, ...countries.map((c) => <option key={c.code} value={c.code}>{c.nameFr}</option>)]}</Select></Field>
                  <Field label="Secteur" htmlFor="x-sector"><Input id="x-sector" name="sector" /></Field>
                  <Field label="Description" htmlFor="x-desc" className="sm:col-span-2"><Textarea id="x-desc" name="description" /></Field>
                </ApiForm>
              </details>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Diplômes et certifications" description="Déclarés jusqu'à vérification documentaire par l'équipe Talent Bridge." />
            <CardBody className="space-y-3">
              {p.qualifications.map((q) => (
                <div key={q.id} className="flex items-start justify-between gap-3 rounded-xl border border-line p-3 text-sm">
                  <div><p className="font-semibold">{q.title}</p><p className="text-xs text-slate">{q.institution}{q.year ? ` · ${q.year}` : ""}</p>{q.status === "VERIFIED" ? <Badge tone="olive">Vérifié</Badge> : q.status === "REJECTED" ? <Badge tone="red">Non vérifié</Badge> : <Badge>Déclaré</Badge>}</div>
                  {q.status !== "VERIFIED" && <RemoveButton kind="qualification" id={q.id} />}
                </div>
              ))}
              <details className="rounded-xl bg-mist p-3"><summary className="cursor-pointer text-sm font-semibold">+ Ajouter un diplôme ou une certification</summary>
                <ApiForm action="/api/v1/me/item-add" submitLabel="Ajouter" successMessage="Ajouté." className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="itemKind" value="qualification" />
                  <Field label="Type" htmlFor="q-kind"><Select id="q-kind" name="kind" defaultValue="DEGREE"><option value="DEGREE">Diplôme</option><option value="CERTIFICATION">Certification professionnelle</option></Select></Field>
                  <Field label="Intitulé" htmlFor="q-title" required><Input id="q-title" name="title" /></Field>
                  <Field label="Établissement / organisme" htmlFor="q-inst" required><Input id="q-inst" name="institution" /></Field>
                  <Field label="Année" htmlFor="q-year"><Input id="q-year" name="year" type="number" data-type="number" /></Field>
                </ApiForm>
                <p className="mt-2 text-xs text-slate">Les justificatifs (copies de diplômes) se déposent dans le <a href="/espace/verification" className="underline">centre de vérification</a>.</p>
              </details>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Références professionnelles" description="Les coordonnées des référents ne sont visibles que par les vérificateurs Talent Bridge." />
            <CardBody className="space-y-3">
              {p.references.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-3 rounded-xl border border-line p-3 text-sm">
                  <div><p className="font-semibold">{r.missionTitle ?? "Mission"} — {r.contactOrg}</p><p className="text-xs text-slate">Référent : {r.contactName}{r.year ? ` · ${r.year}` : ""}</p>{r.status === "VERIFIED" ? <Badge tone="olive">Vérifiée</Badge> : <Badge>Déclarée</Badge>}</div>
                  {r.status !== "VERIFIED" && <RemoveButton kind="reference" id={r.id} />}
                </div>
              ))}
              <details className="rounded-xl bg-mist p-3"><summary className="cursor-pointer text-sm font-semibold">+ Ajouter une référence</summary>
                <ApiForm action="/api/v1/me/item-add" submitLabel="Ajouter" successMessage="Référence ajoutée." className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="itemKind" value="reference" />
                  <Field label="Nom du référent" htmlFor="r-name" required><Input id="r-name" name="contactName" /></Field>
                  <Field label="Organisation" htmlFor="r-org" required><Input id="r-org" name="contactOrg" /></Field>
                  <Field label="Email du référent" htmlFor="r-email"><Input id="r-email" name="contactEmail" type="email" /></Field>
                  <Field label="Téléphone du référent" htmlFor="r-phone"><Input id="r-phone" name="contactPhone" /></Field>
                  <Field label="Mission concernée" htmlFor="r-mission"><Input id="r-mission" name="missionTitle" /></Field>
                  <Field label="Année" htmlFor="r-year"><Input id="r-year" name="year" type="number" data-type="number" /></Field>
                </ApiForm>
              </details>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Portfolio" />
            <CardBody className="space-y-3">
              {p.portfolio.map((x) => <div key={x.id} className="flex justify-between rounded-xl border border-line p-3 text-sm"><span>{x.title}</span><RemoveButton kind="portfolio" id={x.id} /></div>)}
              <details className="rounded-xl bg-mist p-3"><summary className="cursor-pointer text-sm font-semibold">+ Ajouter une réalisation</summary>
                <ApiForm action="/api/v1/me/item-add" submitLabel="Ajouter" successMessage="Réalisation ajoutée." className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="itemKind" value="portfolio" />
                  <Field label="Titre" htmlFor="p-title" required><Input id="p-title" name="title" /></Field>
                  <Field label="Lien (facultatif)" htmlFor="p-url"><Input id="p-url" name="url" type="url" /></Field>
                  <Field label="Description" htmlFor="p-desc" className="sm:col-span-2"><Textarea id="p-desc" name="description" /></Field>
                </ApiForm>
              </details>
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Photo et CV" />
            <CardBody className="space-y-4 text-sm">
              <div><p className="mb-1 font-semibold">Photo de profil</p><p className="mb-2 text-xs text-slate">{p.photoFileId ? "Photo enregistrée." : "Aucune photo."} PNG, JPG ou WebP, 10 Mo max.</p><FileUpload purpose="PHOTO" accept="image/png,image/jpeg,image/webp" label="Changer la photo" attach={{ action: "/api/v1/me/profile-file", body: { field: "photoFileId" } }} /></div>
              <div><p className="mb-1 font-semibold">CV</p><p className="mb-2 text-xs text-slate">{p.cvFileId ? <a className="text-orange-700 underline" href={`/api/v1/files/${p.cvFileId}`}>Consulter mon CV</a> : "Aucun CV."} PDF ou DOCX. Visible uniquement par les organisations auxquelles vous candidatez.</p><FileUpload purpose="CV" accept=".pdf,.docx" label="Déposer mon CV" attach={{ action: "/api/v1/me/profile-file", body: { field: "cvFileId" } }} />{p.cvFileId && <div className="mt-3"><ButtonLink href="/espace/profil/import-cv" size="sm" variant="secondary"><Wand2 className="h-4 w-4" aria-hidden /> Remplir mon profil depuis mon CV</ButtonLink><p className="mt-1 text-xs text-slate">Expériences, diplômes, compétences et langues trouvés dans le CV, à relire avant enregistrement.</p></div>}</div>
            </CardBody>
          </Card>
          <Card><CardBody className="text-sm"><p className="font-semibold">Disponibilités détaillées</p><p className="mt-1 text-slate">Indiquez vos périodes déjà engagées : elles sont prises en compte par le matching.</p><a href="/espace/disponibilites" className="mt-2 inline-block font-semibold text-orange-700">Gérer mon calendrier →</a></CardBody></Card>
        </aside>
      </div>
    </>
  );
}
