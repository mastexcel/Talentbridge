/* eslint-disable @next/next/no-img-element -- images servies par liens signés temporaires */
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/infrastructure/db";
import { requireAdminUser } from "@/lib/session";
import { hasAdminPermission } from "@/domain/permissions";
import { coursePublishBlockers } from "@/domain/certificates";
import { imageUrl } from "@/lib/certificate-view";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { Badge, DemoBadge } from "@/ui/Badge";
import { ActionButton } from "@/ui/ActionButton";
import { ApiForm } from "@/ui/ApiForm";
import { Select } from "@/ui/Field";
import { EmptyState } from "@/ui/Feedback";
import { SignatoryForm } from "@/ui/certificates/SignatoryForm";

export const metadata: Metadata = { title: "Academy et certificats" };
export const dynamic = "force-dynamic";

const ISSUER_STATUS: Record<string, [string, "neutral" | "orange" | "olive" | "red"]> = { DRAFT: ["Brouillon", "neutral"], SUBMITTED: ["À valider", "orange"], VALIDATED: ["Validée", "olive"], REJECTED: ["Refusée", "red"] };

function Thumb({ label, fileId }: { label: string; fileId: string | null }) {
  const url = imageUrl(fileId);
  return (
    <figure className="min-w-0 text-center">
      <div className="flex h-20 items-center justify-center rounded-lg border border-line bg-white p-1">{url ? <img src={url} alt={label} className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-red-700">Manquant</span>}</div>
      <figcaption className="mt-1 text-xs text-slate">{label}</figcaption>
    </figure>
  );
}

export default async function CertificatesAdmin() {
  const admin = await requireAdminUser("ACADEMY_MANAGE");
  const superAdmin = hasAdminPermission(admin, "SUPER_ADMIN");
  const [signatories, issuers, courses, consultantCerts] = await Promise.all([
    prisma.tbSignatory.findMany({ orderBy: [{ isActive: "desc" }, { fullName: "asc" }] }),
    prisma.certificateIssuer.findMany({ orderBy: [{ status: "asc" }, { updatedAt: "desc" }], include: { courses: { select: { id: true, title: true } }, organization: { select: { name: true } } }, take: 50 }),
    prisma.course.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { updatedAt: "desc" }, include: { issuer: true, tbSignatory: true, _count: { select: { modules: true } } }, take: 50 }),
    prisma.expertCertificate.findMany({ orderBy: { issuedAt: "desc" }, take: 20 }),
  ]);
  const creators = await prisma.user.findMany({ where: { id: { in: issuers.map((i) => i.createdById) } }, select: { id: true, firstName: true, lastName: true, email: true } });
  const creator = (id: string) => creators.find((c) => c.id === id);
  const active = signatories.filter((s) => s.isActive);

  return (
    <>
      <PageHeader title="Academy et certificats" description="Protocole de certification : cosignataires Talent Bridge, validation des institutions délivrantes (logo, cachet, signature) et désignation des cosignataires des formations." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="xl:col-span-2">
          <CardHeader title={`Institutions délivrantes (${issuers.length})`} description="Vérifiez que le logo, le cachet et la signature correspondent à l'institution et que le déclarant y est autorisé. La validation doit être faite par une autre personne que le déclarant." />
          <CardBody className="space-y-4">
            {issuers.length === 0 && <EmptyState title="Aucune institution renseignée" description="Les formateurs renseignent l'institution depuis l'éditeur de leur formation." />}
            {issuers.map((i) => {
              const by = creator(i.createdById);
              return (
                <div key={i.id} className="grid gap-4 rounded-xl border border-line p-4 lg:grid-cols-[1fr_auto]">
                  <div className="min-w-0 space-y-2 text-sm">
                    <p className="flex flex-wrap items-center gap-2 font-display text-base font-bold">{i.name} <Badge tone={ISSUER_STATUS[i.status][1]}>{ISSUER_STATUS[i.status][0]}</Badge> <DemoBadge show={i.isDemo} /></p>
                    <p className="text-slate">Signataire : <span className="text-ink">{i.signatoryName ?? "—"}</span>, {i.signatoryTitle ?? "—"} · Déclaré par {by ? `${by.firstName} ${by.lastName} (${by.email})` : "—"}{i.organization ? ` pour ${i.organization.name}` : ""}</p>
                    <p className="text-slate">Attestation d&apos;autorisation : {i.authorizationAttested ? `oui, le ${i.attestedAt?.toLocaleDateString("fr-FR")}` : "non"} · Formations : {i.courses.map((c) => c.title).join(", ") || "aucune"}</p>
                    {i.reviewNote && <p className="text-slate">Note : {i.reviewNote}</p>}
                    <div className="grid max-w-md grid-cols-3 gap-3">
                      <Thumb label="Logo" fileId={i.logoFileId} />
                      <Thumb label="Cachet" fileId={i.sealFileId} />
                      <Thumb label="Signature" fileId={i.signatureFileId} />
                    </div>
                  </div>
                  {i.status === "SUBMITTED" && (
                    <div className="flex flex-wrap items-start gap-2 lg:flex-col">
                      <ActionButton action="/api/v1/certificates/issuer-review" body={{ issuerId: i.id, approve: true }} variant="success" confirm="Valider cette institution ? Ses logo, cachet et signature figureront sur les certificats." successMessage="Institution validée.">Valider</ActionButton>
                      <ActionButton action="/api/v1/certificates/issuer-review" body={{ issuerId: i.id, approve: false }} variant="danger" prompt={{ key: "note", label: "Motif du refus", required: true }} successMessage="Institution refusée.">Refuser</ActionButton>
                    </div>
                  )}
                </div>
              );
            })}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Formations : cosignataire Talent Bridge" description="Une formation ne peut être mise en ligne qu'avec une institution validée et un cosignataire actif." />
          <CardBody className="space-y-3 text-sm">
            {courses.map((c) => {
              const blockers = coursePublishBlockers({ lessons: c._count.modules, issuer: c.issuer, tbSignatory: c.tbSignatory });
              return (
                <div key={c.id} className="rounded-xl border border-line p-3">
                  <p className="font-semibold"><Link href={`/academy/formateur/${c.id}`} className="hover:underline">{c.title}</Link> <DemoBadge show={c.isDemo} /></p>
                  <p className="text-xs text-slate">{c.status === "PUBLISHED" ? "En ligne" : "Non publiée"} · Institution : {c.issuer ? `${c.issuer.name} (${ISSUER_STATUS[c.issuer.status][0]})` : "non renseignée"}</p>
                  {blockers.length > 0 && <p className="mt-1 text-xs text-orange-800">{blockers.join(" ")}</p>}
                  <ApiForm action="/api/v1/certificates/course-cosigner" submitLabel="Désigner" successMessage="Cosignataire désigné." className="mt-2 flex flex-wrap items-center gap-2 [&>div]:mt-0" extra={{ courseId: c.id }}>
                    <label htmlFor={`cs-${c.id}`} className="sr-only">Cosignataire de {c.title}</label>
                    <Select id={`cs-${c.id}`} name="tbSignatoryId" defaultValue={c.tbSignatoryId ?? ""} className="min-w-0 flex-1">
                      <option value="">— Aucun —</option>
                      {active.map((s) => <option key={s.id} value={s.id}>{s.fullName} — {s.title}</option>)}
                    </Select>
                  </ApiForm>
                </div>
              );
            })}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Cosignataires Talent Bridge" description={superAdmin ? "Personnes habilitées à cosigner les certificats." : "Gérés par un super-administrateur."} />
          <CardBody className="space-y-4 text-sm">
            {signatories.map((s) => (
              <div key={s.id} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="h-14 w-36 shrink-0"><Thumb label="Signature" fileId={s.signatureFileId} /></div>
                  <div className="min-w-0">
                    <p className="font-semibold">{s.fullName} <DemoBadge show={s.isDemo} /></p>
                    <p className="text-slate">{s.title}</p>
                    <p className="mt-1 flex flex-wrap gap-1">{s.isActive ? <Badge tone="olive">Actif</Badge> : <Badge tone="red">Inactif</Badge>}{s.forVerification && <Badge tone="bordeaux">Certificats consultants</Badge>}</p>
                  </div>
                </div>
                {superAdmin && <details className="mt-3"><summary className="cursor-pointer text-orange-700">Modifier</summary><div className="mt-3"><SignatoryForm signatory={s} /></div></details>}
              </div>
            ))}
            {superAdmin && (
              <details className="rounded-xl border border-dashed border-line p-3" open={signatories.length === 0}>
                <summary className="cursor-pointer font-semibold text-orange-700">Ajouter un cosignataire</summary>
                <div className="mt-3"><SignatoryForm /></div>
              </details>
            )}
          </CardBody>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Derniers certificats « Consultant vérifié »" />
          <CardBody className="overflow-x-auto text-sm">
            {consultantCerts.length === 0 ? <p className="text-slate">Aucun certificat délivré.</p> : (
              <ul className="divide-y divide-line">
                {consultantCerts.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span><Link href={`/certificats/${c.code}`} className="font-mono font-semibold hover:underline">{c.code}</Link> · {c.holderName} <DemoBadge show={c.isDemo} /></span>
                    <span className="text-xs text-slate">Valable jusqu&apos;au {c.validUntil.toLocaleDateString("fr-FR")}{c.revokedAt ? " · révoqué" : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
