import type { Metadata } from "next";
import { prisma } from "@/infrastructure/db";
import { requireAdminUser } from "@/lib/session";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { ApiForm } from "@/ui/ApiForm";
import { Field, Input, Select, Textarea } from "@/ui/Field";

export const metadata: Metadata = { title: "Veille appels d'offres" };

/** Publication d'appels repérés par la veille Talent Bridge (avec lien vers l'avis officiel). */
export default async function TendersAdmin() {
  await requireAdminUser("MARKETPLACE_MODERATE");
  const [countries, domains] = await Promise.all([prisma.country.findMany({ orderBy: { nameFr: "asc" } }), prisma.expertiseDomain.findMany({ orderBy: { sortOrder: "asc" } })]);
  return (
    <>
      <PageHeader title="Veille appels d'offres" description="Publiez un appel repéré par l'équipe : les alertes des utilisateurs sont déclenchées automatiquement." />
      <Card className="max-w-3xl"><CardHeader title="Nouvel appel" /><CardBody>
        <ApiForm action="/api/v1/admin/tender-publish" submitLabel="Publier" successMessage="Appel publié." className="grid gap-3 sm:grid-cols-2">
          <Field label="Type" htmlFor="type"><Select id="type" name="type"><option value="TENDER">Appel d'offres</option><option value="EOI">AMI</option><option value="RFP">Demande de propositions</option></Select></Field>
          <Field label="Acheteur" htmlFor="buyerName" required><Input id="buyerName" name="buyerName" /></Field>
          <Field label="Intitulé" htmlFor="title" required className="sm:col-span-2"><Input id="title" name="title" /></Field>
          <Field label="Description" htmlFor="description" required className="sm:col-span-2"><Textarea id="description" name="description" rows={6} /></Field>
          <Field label="Éligibilité" htmlFor="eligibility" className="sm:col-span-2"><Textarea id="eligibility" name="eligibility" /></Field>
          <Field label="Pays" htmlFor="countryCode"><Select id="countryCode" name="countryCode">{countries.map((c) => <option key={c.code} value={c.code}>{c.nameFr}</option>)}</Select></Field>
          <Field label="Domaine" htmlFor="domainId"><Select id="domainId" name="domainId"><option value="">—</option>{domains.map((d) => <option key={d.id} value={d.id}>{d.nameFr}</option>)}</Select></Field>
          <Field label="Date limite" htmlFor="deadline" required><Input id="deadline" name="deadline" type="datetime-local" /></Field>
          <Field label="Avis officiel (URL)" htmlFor="sourceUrl"><Input id="sourceUrl" name="sourceUrl" type="url" /></Field>
        </ApiForm>
      </CardBody></Card>
    </>
  );
}
