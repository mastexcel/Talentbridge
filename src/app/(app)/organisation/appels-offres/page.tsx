import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/infrastructure/db";
import { requireOrgUser } from "@/lib/session";
import { listBids } from "@/application/tender.service";
import { complianceRate, daysUntil } from "@/domain/tenders";
import { BID_STATUS_LABELS } from "@/ui/labels";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { StatusBadge, Badge } from "@/ui/Badge";
import { Progress } from "@/ui/Stat";
import { ButtonLink } from "@/ui/Button";
import { EmptyState } from "@/ui/Feedback";
import { ApiForm } from "@/ui/ApiForm";
import { Field, Input, Select, Textarea } from "@/ui/Field";

export const metadata: Metadata = { title: "Appels d'offres" };

export default async function OrgTenders() {
  const { user, org } = await requireOrgUser("tenders.manage");
  const [bids, countries, published] = await Promise.all([listBids(user, org.id), prisma.country.findMany({ where: { isActive: true }, orderBy: { nameFr: "asc" } }), prisma.tender.findMany({ where: { publisherOrgId: org.id }, orderBy: { createdAt: "desc" } })]);
  return (
    <>
      <PageHeader title="Appels d'offres & candidatures" description="Préparez vos dossiers : checklist, matrice de conformité, experts clés et consortium." actions={<ButtonLink href="/appels-offres">Rechercher des opportunités</ButtonLink>} />
      {bids.length === 0 ? <EmptyState title="Aucun dossier en cours" description="Ouvrez un dossier depuis la page d'un appel d'offres." action={<ButtonLink href="/appels-offres">Voir les appels d'offres</ButtonLink>} /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {bids.map((b) => {
            const rate = complianceRate(b.requirements);
            const d = daysUntil(b.tender.deadline);
            return (
              <Link key={b.id} href={`/organisation/appels-offres/${b.id}`} className="rounded-2xl border border-line bg-white p-5 shadow-card hover:shadow-lift">
                <div className="flex justify-between gap-2"><StatusBadge status={b.status} label={BID_STATUS_LABELS[b.status]} /><Badge tone={d <= 7 ? "red" : "neutral"}>{d >= 0 ? `J-${d}` : "Clôturé"}</Badge></div>
                <p className="mt-2 font-display font-bold">{b.tender.title}</p>
                <p className="text-sm text-slate">{b.tender.buyerName}</p>
                <div className="mt-3 flex justify-between text-xs"><span>Conformité du dossier</span><span>{rate} %</span></div>
                <Progress value={rate} className="mt-1" />
              </Link>
            );
          })}
        </div>
      )}
      <Card className="mt-8">
        <CardHeader title="Publier un appel d'offres ou un AMI" description="Pour les organisations acheteuses (ONG, institutions, entreprises)." />
        <CardBody>
          {published.length > 0 && <p className="mb-3 text-sm">Vos publications : {published.map((t) => <Link key={t.id} href={`/appels-offres/${t.id}`} className="mr-2 underline">{t.reference}</Link>)}</p>}
          <details><summary className="cursor-pointer text-sm font-semibold">Ouvrir le formulaire</summary>
            <ApiForm action="/api/v1/org/tender-publish" submitLabel="Publier" successMessage="Appel publié ; les alertes correspondantes sont envoyées." className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Type" htmlFor="t-type"><Select id="t-type" name="type"><option value="TENDER">Appel d'offres</option><option value="EOI">AMI</option><option value="RFP">Demande de propositions</option></Select></Field>
              <Field label="Acheteur" htmlFor="t-buyer" required><Input id="t-buyer" name="buyerName" defaultValue={org.name} /></Field>
              <Field label="Intitulé" htmlFor="t-title" required className="sm:col-span-2"><Input id="t-title" name="title" /></Field>
              <Field label="Description / TDR" htmlFor="t-desc" required className="sm:col-span-2"><Textarea id="t-desc" name="description" rows={6} /></Field>
              <Field label="Éligibilité" htmlFor="t-elig" className="sm:col-span-2"><Textarea id="t-elig" name="eligibility" /></Field>
              <Field label="Pays" htmlFor="t-country"><Select id="t-country" name="countryCode">{countries.map((c) => <option key={c.code} value={c.code}>{c.nameFr}</option>)}</Select></Field>
              <Field label="Date limite" htmlFor="t-deadline" required><Input id="t-deadline" name="deadline" type="datetime-local" /></Field>
              <Field label="Budget" htmlFor="t-budget"><Input id="t-budget" name="budget" type="number" data-type="number" /></Field>
              <Field label="Devise" htmlFor="t-cur"><Select id="t-cur" name="currency"><option>XOF</option><option>XAF</option><option>EUR</option><option>USD</option></Select></Field>
              <Field label="Lien vers l'avis officiel" htmlFor="t-url" className="sm:col-span-2"><Input id="t-url" name="sourceUrl" type="url" /></Field>
            </ApiForm>
          </details>
        </CardBody>
      </Card>
    </>
  );
}
