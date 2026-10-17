import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminUser } from "@/lib/session";
import { adminListOrganizations } from "@/application/organization.service";
import { ORGANIZATION_TYPE_LABELS } from "@/application/schemas";
import { organizationFlow } from "@/domain/workflows";
import { ORG_STATUS_LABELS } from "@/ui/labels";
import { prisma } from "@/infrastructure/db";
import { PageHeader, Pagination } from "@/ui/Page";
import { Card, CardBody } from "@/ui/Card";
import { StatusBadge, DemoBadge } from "@/ui/Badge";
import { ActionButton } from "@/ui/ActionButton";

export const metadata: Metadata = { title: "Organisations" };

export default async function OrgsAdmin({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const sp = await searchParams;
  const admin = await requireAdminUser("ORGS_VALIDATE");
  const page = Math.max(1, Number(sp.page) || 1);
  const r = await adminListOrganizations(admin, { status: ["PENDING", "VERIFIED", "REJECTED", "SUSPENDED"].includes(sp.status ?? "") ? sp.status : undefined, q: sp.q, page });
  const docs = await prisma.organizationDocument.findMany({ where: { organizationId: { in: r.items.map((o) => o.id) } }, include: { file: { select: { id: true, filename: true } } } });
  return (
    <>
      <PageHeader title="Organisations" description="Validation administrative (immatriculation, justificatifs) et contrôle." />
      <nav className="mb-4 flex flex-wrap gap-2 text-sm"><Link href="/admin/organisations" className={`rounded-full px-3 py-1 ${!sp.status ? "bg-bordeaux-700 text-white" : "border border-line bg-white"}`}>Toutes</Link>{Object.entries(ORG_STATUS_LABELS).map(([k, v]) => <Link key={k} href={`?status=${k}`} className={`rounded-full px-3 py-1 ${sp.status === k ? "bg-bordeaux-700 text-white" : "border border-line bg-white"}`}>{v}</Link>)}</nav>
      <div className="space-y-3">
        {r.items.map((o) => (
          <Card key={o.id}><CardBody className="grid gap-3 text-sm md:grid-cols-[1fr_auto]">
            <div>
              <p className="font-display text-lg font-bold">{o.name} <DemoBadge show={o.isDemo} /></p>
              <p className="text-slate">{ORGANIZATION_TYPE_LABELS[o.type]} · {o.countryCode}{o.city ? `, ${o.city}` : ""} · RCCM : {o.registrationNumber ?? "—"} · NCC : {o.taxId ?? "—"} · {o.website ?? ""}</p>
              <p className="text-xs text-slate">{o._count.members} membre(s) · {o._count.missions} mission(s) · créée le {o.createdAt.toLocaleDateString("fr-FR")}</p>
              <p className="mt-1 text-xs">Documents : {docs.filter((d) => d.organizationId === o.id).map((d) => <a key={d.id} href={`/api/v1/files/${d.file.id}`} className="mr-2 text-orange-700 underline">{d.kind}</a>)}{docs.every((d) => d.organizationId !== o.id) && "aucun"}</p>
              {o.verificationNote && <p className="mt-1 text-xs">Note : {o.verificationNote}</p>}
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusBadge status={o.status} label={ORG_STATUS_LABELS[o.status]} />
              <div className="flex flex-wrap justify-end gap-1">{organizationFlow.next(o.status).map((s) => <ActionButton key={s} action="/api/v1/admin/org-decide" body={{ organizationId: o.id, status: s }} variant={s === "VERIFIED" ? "success" : "danger"} prompt={{ key: "note", label: s === "VERIFIED" ? "Note (facultative)" : "Motif (communiqué à l'organisation)", required: s !== "VERIFIED" }} successMessage="Décision enregistrée.">{s === "VERIFIED" ? "Valider" : s === "REJECTED" ? "Refuser" : s === "SUSPENDED" ? "Suspendre" : "Rouvrir"}</ActionButton>)}</div>
            </div>
          </CardBody></Card>
        ))}
      </div>
      <Pagination page={page} pages={Math.max(1, Math.ceil(r.total / r.pageSize))} params={{ status: sp.status }} basePath="/admin/organisations" />
    </>
  );
}
