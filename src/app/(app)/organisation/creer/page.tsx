import type { Metadata } from "next";
import { prisma } from "@/infrastructure/db";
import { requireUser } from "@/lib/session";
import { ORGANIZATION_TYPE_LABELS } from "@/application/schemas";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody } from "@/ui/Card";
import { ApiForm } from "@/ui/ApiForm";
import { Field, Input, Select } from "@/ui/Field";

export const metadata: Metadata = { title: "Créer une organisation" };

/** Un utilisateur (consultant inclus) peut créer ou rejoindre plusieurs organisations. */
export default async function CreateOrg() {
  await requireUser("/organisation/creer");
  const countries = await prisma.country.findMany({ where: { isActive: true }, orderBy: { nameFr: "asc" } });
  return (
    <>
      <PageHeader title="Créer une organisation" description="Votre compte personnel reste distinct : vous deviendrez propriétaire de ce nouvel espace." />
      <Card className="max-w-2xl"><CardBody>
        <ApiForm action="/api/v1/me/organization-create" submitLabel="Créer l'organisation" successMessage="Organisation créée." className="grid gap-4 sm:grid-cols-2">
          <Field label="Raison sociale" htmlFor="name" required className="sm:col-span-2"><Input id="name" name="name" /></Field>
          <Field label="Type" htmlFor="type"><Select id="type" name="type" defaultValue="CONSULTING_FIRM">{Object.entries(ORGANIZATION_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Pays" htmlFor="countryCode"><Select id="countryCode" name="countryCode" defaultValue="CI">{countries.map((c) => <option key={c.code} value={c.code}>{c.nameFr}</option>)}</Select></Field>
        </ApiForm>
      </CardBody></Card>
    </>
  );
}
