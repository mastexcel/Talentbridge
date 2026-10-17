import type { Metadata } from "next";
import { prisma } from "@/infrastructure/db";
import { requireUser } from "@/lib/session";
import { listAlerts } from "@/application/tender.service";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { ApiForm } from "@/ui/ApiForm";
import { ActionButton } from "@/ui/ActionButton";
import { Field, Input } from "@/ui/Field";
import { Badge } from "@/ui/Badge";

export const metadata: Metadata = { title: "Alertes appels d'offres" };

export default async function AlertsPage() {
  const user = await requireUser("/espace/alertes");
  const [alerts, countries, domains] = await Promise.all([listAlerts(user.id), prisma.country.findMany({ where: { isActive: true }, orderBy: { nameFr: "asc" } }), prisma.expertiseDomain.findMany({ orderBy: { sortOrder: "asc" } })]);
  const dName = new Map(domains.map((d) => [d.id, d.nameFr]));
  return (
    <>
      <PageHeader title="Alertes personnalisées" description="Recevez une notification dès qu'un appel d'offres ou un AMI correspond à vos critères." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Nouvelle alerte" />
          <CardBody>
            <ApiForm action="/api/v1/tenders/alert-create" submitLabel="Créer l'alerte" successMessage="Alerte créée." className="space-y-3">
              <Field label="Nom de l'alerte" htmlFor="a-name" required><Input id="a-name" name="name" placeholder="Ex. Évaluations Afrique de l'Ouest" /></Field>
              <Field label="Mots-clés (séparés par des virgules)" htmlFor="a-kw"><Input id="a-kw" name="keywords" data-type="array" placeholder="évaluation, audit, solaire" /></Field>
              <Field label="Pays (vide = tous)" htmlFor="a-c"><select id="a-c" name="countryCodes" multiple className="h-28 w-full rounded-xl border border-line p-2 text-sm">{countries.map((c) => <option key={c.code} value={c.code}>{c.nameFr}</option>)}</select></Field>
              <Field label="Domaines (vide = tous)" htmlFor="a-d"><select id="a-d" name="domainIds" multiple className="h-28 w-full rounded-xl border border-line p-2 text-sm">{domains.map((d) => <option key={d.id} value={d.id}>{d.nameFr}</option>)}</select></Field>
            </ApiForm>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Mes alertes" />
          <CardBody className="space-y-3">
            {alerts.length === 0 && <p className="text-sm text-slate">Aucune alerte.</p>}
            {alerts.map((a) => (
              <div key={a.id} className="rounded-xl border border-line p-3 text-sm">
                <div className="flex items-center justify-between"><p className="font-semibold">{a.name}</p><ActionButton action="/api/v1/tenders/alert-delete" body={{ id: a.id }} variant="ghost" confirm="Supprimer cette alerte ?" successMessage="Alerte supprimée.">Supprimer</ActionButton></div>
                <div className="mt-1 flex flex-wrap gap-1">{a.keywords.map((k) => <Badge key={k}>{k}</Badge>)}{a.countryCodes.map((c) => <Badge key={c} tone="orange">{c}</Badge>)}{a.domainIds.map((d) => <Badge key={d} tone="bordeaux">{dName.get(d) ?? d}</Badge>)}</div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
