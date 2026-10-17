import type { Metadata } from "next";
import { prisma } from "@/infrastructure/db";
import { requireOrgUser } from "@/lib/session";
import { getOrganization } from "@/application/organization.service";
import { ORGANIZATION_TYPE_LABELS } from "@/application/schemas";
import { ORG_STATUS_LABELS } from "@/ui/labels";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { ApiForm } from "@/ui/ApiForm";
import { Field, Input, Select, Textarea } from "@/ui/Field";
import { StatusBadge } from "@/ui/Badge";
import { Alert } from "@/ui/Feedback";
import { FileUpload } from "@/ui/FileUpload";

export const metadata: Metadata = { title: "Paramètres de l'organisation" };

export default async function OrgSettings({ searchParams }: { searchParams: Promise<{ bienvenue?: string }> }) {
  const sp = await searchParams;
  const { user, org } = await requireOrgUser("org.manage");
  const [o, countries] = await Promise.all([getOrganization(user, org.id), prisma.country.findMany({ where: { isActive: true }, orderBy: { nameFr: "asc" } })]);
  return (
    <>
      <PageHeader title="Fiche de l'organisation" description={<span className="flex items-center gap-2">Statut : <StatusBadge status={o.status} label={ORG_STATUS_LABELS[o.status]} /></span>} />
      {sp.bienvenue && <Alert tone="success" title="Votre espace est créé" className="mb-4">Complétez la fiche et déposez vos justificatifs : l'équipe Talent Bridge validera votre organisation.</Alert>}
      {o.verificationNote && <Alert tone={o.status === "REJECTED" ? "error" : "info"} className="mb-4">Note de l'équipe de validation : {o.verificationNote}</Alert>}
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card><CardHeader title="Informations" /><CardBody>
          <ApiForm action="/api/v1/org/update" successMessage="Fiche enregistrée." className="grid gap-4 sm:grid-cols-2">
            <Field label="Raison sociale" htmlFor="name" required><Input id="name" name="name" defaultValue={o.name} /></Field>
            <Field label="Type" htmlFor="type"><Select id="type" name="type" defaultValue={o.type}>{Object.entries(ORGANIZATION_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            <Field label="Pays" htmlFor="countryCode"><Select id="countryCode" name="countryCode" defaultValue={o.countryCode}>{countries.map((c) => <option key={c.code} value={c.code}>{c.nameFr}</option>)}</Select></Field>
            <Field label="Ville" htmlFor="city"><Input id="city" name="city" defaultValue={o.city ?? ""} /></Field>
            <Field label="N° d'immatriculation (RCCM…)" htmlFor="registrationNumber"><Input id="registrationNumber" name="registrationNumber" defaultValue={o.registrationNumber ?? ""} /></Field>
            <Field label="Identifiant fiscal (NCC…)" htmlFor="taxId"><Input id="taxId" name="taxId" defaultValue={o.taxId ?? ""} /></Field>
            <Field label="Secteur" htmlFor="sector"><Input id="sector" name="sector" defaultValue={o.sector ?? ""} /></Field>
            <Field label="Taille" htmlFor="size"><Select id="size" name="size" defaultValue={o.size ?? ""}><option value="">—</option><option>1-10</option><option>11-50</option><option>51-200</option><option>201-1000</option><option>1000+</option></Select></Field>
            <Field label="Site internet" htmlFor="website"><Input id="website" name="website" type="url" defaultValue={o.website ?? ""} /></Field>
            <Field label="Adresse" htmlFor="address"><Input id="address" name="address" defaultValue={o.address ?? ""} /></Field>
            <Field label="Contact principal" htmlFor="contactName"><Input id="contactName" name="contactName" defaultValue={o.contactName ?? ""} /></Field>
            <Field label="Email du contact" htmlFor="contactEmail"><Input id="contactEmail" name="contactEmail" type="email" defaultValue={o.contactEmail ?? ""} /></Field>
            <Field label="Téléphone du contact" htmlFor="contactPhone"><Input id="contactPhone" name="contactPhone" defaultValue={o.contactPhone ?? ""} /></Field>
            <Field label="Présentation" htmlFor="description" className="sm:col-span-2"><Textarea id="description" name="description" defaultValue={o.description ?? ""} /></Field>
            <Field label="Besoins en expertise" htmlFor="expertiseNeeds" className="sm:col-span-2"><Textarea id="expertiseNeeds" name="expertiseNeeds" defaultValue={o.expertiseNeeds ?? ""} /></Field>
          </ApiForm>
        </CardBody></Card>
        <Card><CardHeader title="Documents justificatifs" description="Accessibles uniquement aux membres et aux validateurs Talent Bridge." /><CardBody className="space-y-3 text-sm">
          {o.documents.map((d) => <p key={d.id}><a href={`/api/v1/files/${d.file.id}`} className="text-orange-700 underline">{d.kind}</a> <span className="text-xs text-slate">({d.file.filename})</span></p>)}
          {o.documents.length === 0 && <p className="text-slate">Aucun document.</p>}
          {[["RCCM / registre de commerce", "RCCM"], ["Statuts", "STATUTS"], ["Attestation fiscale", "ATTESTATION_FISCALE"]].map(([label, kind]) => <div key={kind}><p className="mb-1 text-xs font-semibold">{label}</p><FileUpload purpose="ORG_DOCUMENT" accept=".pdf,.png,.jpg,.jpeg" label="Déposer" attach={{ action: "/api/v1/org/document", body: { kind } }} /></div>)}
        </CardBody></Card>
      </div>
    </>
  );
}
