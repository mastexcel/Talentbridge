import type { Metadata } from "next";
import { prisma } from "@/infrastructure/db";
import { requireAdminUser } from "@/lib/session";
import { getMatchingWeights } from "@/application/settings.service";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { ApiForm } from "@/ui/ApiForm";
import { ActionButton } from "@/ui/ActionButton";
import { Checkbox, Field, Input, Select, Textarea } from "@/ui/Field";
import { Badge } from "@/ui/Badge";

export const metadata: Metadata = { title: "Configuration" };
const W: [string, string][] = [["skills", "Compétences"], ["experience", "Expérience pertinente"], ["references", "Références vérifiées"], ["availability", "Disponibilité"], ["location", "Localisation et mobilité"], ["languages", "Langues"]];

export default async function ConfigPage() {
  await requireAdminUser("CONFIG_MANAGE");
  const [weights, countries, domains, skills, templates] = await Promise.all([
    getMatchingWeights(), prisma.country.findMany({ orderBy: { nameFr: "asc" }, include: { currency: true } }), prisma.expertiseDomain.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.skill.findMany({ orderBy: { nameFr: "asc" }, include: { domain: { select: { nameFr: true } } } }), prisma.notificationTemplate.findMany({ orderBy: [{ type: "asc" }, { channel: "asc" }] }),
  ]);
  return (
    <>
      <PageHeader title="Paramètres et référentiels" description="Toute modification est journalisée." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card><CardHeader title="Pondérations du matching" description="Normalisées automatiquement à 100 %. Valeurs indicatives du cahier des charges : 30/20/15/15/10/10." /><CardBody>
          <ApiForm action="/api/v1/admin/matching-weights" successMessage="Pondérations enregistrées." className="grid gap-3 sm:grid-cols-2">
            {W.map(([k, l]) => <Field key={k} label={`${l} (%)`} htmlFor={`w-${k}`}><Input id={`w-${k}`} name={k} type="number" min={0} max={100} step="0.1" data-type="number" defaultValue={Math.round(weights[k as keyof typeof weights] * 10) / 10} /></Field>)}
          </ApiForm>
        </CardBody></Card>
        <Card><CardHeader title="Pays et devises" description="Un pays désactivé n'est plus proposé dans les formulaires." /><CardBody className="max-h-96 space-y-1 overflow-y-auto text-sm">
          {countries.map((c) => <div key={c.code} className="flex items-center justify-between"><span>{c.nameFr} <span className="text-xs text-slate">({c.code} · {c.currencyCode} · {c.region})</span></span><ActionButton action="/api/v1/admin/country-toggle" body={{ code: c.code, isActive: !c.isActive }} variant="ghost" successMessage="Pays mis à jour.">{c.isActive ? "Désactiver" : "Activer"}</ActionButton></div>)}
        </CardBody></Card>
        <Card><CardHeader title="Domaines d'expertise" /><CardBody className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-1">{domains.map((d) => <Badge key={d.id} tone={d.isActive ? "bordeaux" : "neutral"}>{d.nameFr}</Badge>)}</div>
          <ApiForm action="/api/v1/admin/domain" submitLabel="Ajouter le domaine" successMessage="Domaine ajouté." className="grid gap-2 sm:grid-cols-3"><Input name="slug" placeholder="identifiant-url" aria-label="Identifiant" /><Input name="nameFr" placeholder="Nom (FR)" aria-label="Nom FR" /><Input name="nameEn" placeholder="Name (EN)" aria-label="Nom EN" /></ApiForm>
        </CardBody></Card>
        <Card><CardHeader title={`Référentiel des compétences (${skills.length})`} description="Les synonymes servent à l'analyse automatique des besoins." /><CardBody className="space-y-3 text-sm">
          <div className="max-h-48 overflow-y-auto">{skills.map((s) => <p key={s.id}>{s.nameFr} <span className="text-xs text-slate">— {s.domain?.nameFr ?? "sans domaine"} · {s.synonyms.join(", ")}</span></p>)}</div>
          <ApiForm action="/api/v1/admin/skill" submitLabel="Ajouter la compétence" successMessage="Compétence ajoutée." className="grid gap-2 sm:grid-cols-2">
            <Input name="slug" placeholder="identifiant-url" aria-label="Identifiant" /><Select name="domainId" aria-label="Domaine"><option value="">Sans domaine</option>{domains.map((d) => <option key={d.id} value={d.id}>{d.nameFr}</option>)}</Select>
            <Input name="nameFr" placeholder="Nom (FR)" aria-label="Nom FR" /><Input name="nameEn" placeholder="Name (EN)" aria-label="Nom EN" />
            <Input name="synonyms" data-type="array" placeholder="Synonymes séparés par des virgules" className="sm:col-span-2" aria-label="Synonymes" />
          </ApiForm>
        </CardBody></Card>
        <Card className="xl:col-span-2"><CardHeader title="Modèles de notification" description="Variables : {{prenom}}, {{titre}}, {{message}}, {{lien}}." /><CardBody className="grid gap-4 md:grid-cols-2">
          {templates.map((t) => (
            <ApiForm key={t.id} action="/api/v1/admin/template-save" successMessage="Modèle enregistré." className="space-y-2 rounded-xl border border-line p-3" extra={{ id: t.id }}>
              <p className="text-sm font-semibold">{t.type} · {t.channel} · {t.locale}</p>
              <Input name="subject" defaultValue={t.subject} aria-label="Objet" />
              <Textarea name="body" defaultValue={t.body} rows={4} aria-label="Corps" />
              <Checkbox name="isActive" defaultChecked={t.isActive} label="Actif" />
            </ApiForm>
          ))}
        </CardBody></Card>
      </div>
    </>
  );
}
