/* eslint-disable @next/next/no-img-element -- aperçus servis par liens signés temporaires */
/**
 * Protocole de certification côté formateur : institution délivrante (logo, cachet, signataire,
 * signature, attestation) et état de la mise en ligne. Réutilisé dans l'éditeur de formation.
 */
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Eye } from "lucide-react";
import type { CertificateIssuer, TbSignatory } from "@prisma/client";
import { issuerMissing } from "@/domain/certificates";
import { imageUrl } from "@/lib/certificate-view";
import { ApiForm } from "../ApiForm";
import { ActionButton } from "../ActionButton";
import { FileUpload } from "../FileUpload";
import { Badge } from "../Badge";
import { Card, CardBody, CardHeader } from "../Card";
import { Field, Input, Select } from "../Field";

const STATUS: Record<string, { label: string; tone: "neutral" | "orange" | "olive" | "red" }> = {
  DRAFT: { label: "Brouillon", tone: "neutral" },
  SUBMITTED: { label: "En attente de validation", tone: "orange" },
  VALIDATED: { label: "Validée par Talent Bridge", tone: "olive" },
  REJECTED: { label: "Refusée", tone: "red" },
};

function Asset({ title, hint, url, issuerId, kind }: { title: string; hint: string; url: string | null; issuerId: string; kind: "logo" | "seal" | "signature" }) {
  const purpose = { logo: "CERT_LOGO", seal: "CERT_SEAL", signature: "CERT_SIGNATURE" }[kind];
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-line p-3">
      <p className="text-sm font-semibold">{title}</p>
      <div className="flex h-24 items-center justify-center rounded-lg bg-mist">
        {url ? <img src={url} alt={title} className="max-h-20 max-w-full object-contain" /> : <span className="text-xs text-slate">Non fourni</span>}
      </div>
      <p className="text-xs text-slate">{hint}</p>
      <FileUpload purpose={purpose} accept="image/png,image/jpeg" label={url ? "Remplacer" : "Déposer"} attach={{ action: "/api/v1/certificates/issuer-file", body: { issuerId, kind } }} />
    </div>
  );
}

export function CertificateProtocolCard({ courseId, issuer, otherIssuers, tbSignatory, blockers, published }: { courseId: string; issuer: CertificateIssuer | null; otherIssuers: CertificateIssuer[]; tbSignatory: TbSignatory | null; blockers: string[]; published: boolean }) {
  const missing = issuer ? issuerMissing(issuer) : [];
  return (
    <Card>
      <CardHeader
        title="Certificat de la formation"
        description="Avant la mise en ligne : institution délivrante (logo, cachet, signataire et signature) validée par Talent Bridge, et cosignataire Talent Bridge désigné."
      />
      <CardBody className="space-y-5 text-sm">
        {blockers.length ? (
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-orange-900" role="status">
            <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Mise en ligne impossible pour l&apos;instant</p>
            <ul className="mt-1 list-disc pl-5">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
          </div>
        ) : (
          <p className="flex items-center gap-2 rounded-xl bg-olive-100 p-3 font-semibold text-olive-800"><CheckCircle2 className="h-4 w-4" /> Protocole complet : la formation peut être mise en ligne.</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold">Institution qui délivre la formation</h3>
          {issuer && <Badge tone={STATUS[issuer.status].tone}>{STATUS[issuer.status].label}</Badge>}
        </div>
        {issuer?.status === "REJECTED" && issuer.reviewNote && <p className="rounded-lg bg-red-50 p-2 text-red-800">Motif du refus : {issuer.reviewNote}</p>}

        {!published && otherIssuers.length > 0 && (
          <ApiForm action="/api/v1/certificates/issuer-attach" submitLabel="Utiliser cette institution" successMessage="Institution associée." className="flex flex-wrap items-end gap-2" extra={{ courseId }}>
            <Field label="Réutiliser une institution déjà renseignée" htmlFor="issuer-pick" className="min-w-0 flex-1">
              <Select id="issuer-pick" name="issuerId">{otherIssuers.map((i) => <option key={i.id} value={i.id}>{i.name} — {STATUS[i.status].label}</option>)}</Select>
            </Field>
          </ApiForm>
        )}

        <ApiForm action="/api/v1/certificates/issuer-save" submitLabel={issuer ? "Enregistrer les informations" : "Créer l'institution"} successMessage="Informations enregistrées." className="grid gap-3 sm:grid-cols-2" extra={{ issuerId: issuer?.id ?? null, courseId }}>
          <Field label="Nom de l'institution" htmlFor="is-name" required className="sm:col-span-2"><Input id="is-name" name="name" defaultValue={issuer?.name} placeholder="Ex. : Université … / Institut …" /></Field>
          <Field label="Devise ou mention (facultatif)" htmlFor="is-tag" className="sm:col-span-2"><Input id="is-tag" name="tagline" defaultValue={issuer?.tagline ?? ""} placeholder="Ex. : Excellence · Savoir · Impact" /></Field>
          <Field label="Nom du signataire de l'institution" htmlFor="is-sn" required><Input id="is-sn" name="signatoryName" defaultValue={issuer?.signatoryName ?? ""} /></Field>
          <Field label="Fonction du signataire" htmlFor="is-st" required><Input id="is-st" name="signatoryTitle" defaultValue={issuer?.signatoryTitle ?? ""} placeholder="Ex. : Recteur, Directeur général" /></Field>
          <label className="flex items-start gap-2 sm:col-span-2">
            <input type="checkbox" name="attest" defaultChecked={issuer?.authorizationAttested} className="mt-1 accent-orange-600" />
            <span>J&apos;atteste être autorisé(e) par cette institution à utiliser son logo, son cachet et la signature de son signataire sur les certificats Talent Bridge. Toute modification ultérieure entraîne une nouvelle validation.</span>
          </label>
        </ApiForm>

        {issuer && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Asset title="Logo de l'institution" hint="PNG ou JPEG, fond blanc ou transparent." url={imageUrl(issuer.logoFileId)} issuerId={issuer.id} kind="logo" />
              <Asset title="Cachet de l'institution" hint="Image nette du cachet, fond transparent de préférence." url={imageUrl(issuer.sealFileId)} issuerId={issuer.id} kind="seal" />
              <Asset title="Signature du signataire" hint="Signature manuscrite numérisée, fond transparent." url={imageUrl(issuer.signatureFileId)} issuerId={issuer.id} kind="signature" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {(issuer.status === "DRAFT" || issuer.status === "REJECTED") && (
                missing.length ? <p className="text-xs text-slate">À compléter pour soumettre : {missing.join(", ")}.</p> : <ActionButton action="/api/v1/certificates/issuer-submit" body={{ issuerId: issuer.id }} variant="primary" successMessage="Institution soumise à validation.">Soumettre à la validation de Talent Bridge</ActionButton>
              )}
              <Link href={`/academy/formateur/${courseId}/certificat`} className="inline-flex items-center gap-1 font-semibold text-orange-700 hover:underline"><Eye className="h-4 w-4" /> Aperçu du certificat (spécimen)</Link>
            </div>
          </>
        )}

        <div className="border-t border-line pt-4">
          <h3 className="font-display text-base font-bold">Cosignataire Talent Bridge</h3>
          {tbSignatory ? (
            <p className="mt-1">{tbSignatory.fullName} — {tbSignatory.title}{!tbSignatory.isActive && <Badge tone="red" className="ml-2">Inactif</Badge>}</p>
          ) : (
            <p className="mt-1 text-slate">Désigné par Talent Bridge lors de la validation de l&apos;institution.</p>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
