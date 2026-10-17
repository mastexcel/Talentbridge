import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/infrastructure/db";
import { requireAdminUser } from "@/lib/session";
import { adminMissions } from "@/application/admin.service";
import { MISSION_STATUS_LABELS, APPLICATION_STATUS_LABELS } from "@/domain/workflows";
import { PageHeader, Pagination } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { Table, TBody, Td, Th, THead } from "@/ui/Table";
import { StatusBadge, DemoBadge } from "@/ui/Badge";
import { ActionButton } from "@/ui/ActionButton";
import { StatCard } from "@/ui/Stat";

export const metadata: Metadata = { title: "Marketplace" };

export default async function MarketplaceAdmin({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  const admin = await requireAdminUser("MARKETPLACE_MODERATE");
  const page = Math.max(1, Number(sp.page) || 1);
  const [r, apps, reports] = await Promise.all([
    adminMissions(admin, { page }),
    prisma.application.groupBy({ by: ["status"], _count: true }),
    prisma.contentReport.findMany({ where: { status: "OPEN", targetType: { in: ["MISSION", "EXPERT"] } }, include: { reporter: { select: { email: true } } } }),
  ]);
  return (
    <>
      <PageHeader title="Marketplace" description="Missions, candidatures, signalements et litiges." />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">{apps.slice(0, 4).map((a) => <StatCard key={a.status} label={`Candidatures : ${APPLICATION_STATUS_LABELS[a.status]}`} value={a._count} />)}</div>
      {reports.length > 0 && <Card className="mb-6"><CardHeader title="Signalements (missions, profils)" description="Litiges et contestations : à traiter depuis la modération." /><CardBody className="space-y-1 text-sm">{reports.map((x) => <p key={x.id}>{x.targetType} {x.targetId} — {x.reason} <span className="text-xs text-slate">({x.reporter.email})</span></p>)}<Link href="/admin/moderation" className="text-orange-700 underline">Ouvrir la modération</Link></CardBody></Card>}
      <Card><Table><THead><tr><Th>Mission</Th><Th>Organisation</Th><Th>Candidatures</Th><Th>Statut</Th><Th /></tr></THead>
        <TBody>{r.items.map((m) => <tr key={m.id}><Td><Link href={`/missions/${m.reference}`} className="font-semibold hover:underline">{m.title}</Link> <DemoBadge show={m.isDemo} /><p className="font-mono text-xs text-slate">{m.reference}</p></Td><Td>{m.organization.name}</Td><Td>{m._count.applications}</Td><Td><StatusBadge status={m.status} label={MISSION_STATUS_LABELS[m.status]} /></Td><Td>{!["CLOSED", "CANCELLED"].includes(m.status) && <ActionButton action="/api/v1/admin/mission-moderate" body={{ missionId: m.id }} variant="danger" prompt={{ key: "reason", label: "Motif du retrait (journalisé)", required: true }} successMessage="Mission retirée.">Retirer</ActionButton>}</Td></tr>)}</TBody></Table></Card>
      <Pagination page={page} pages={Math.max(1, Math.ceil(r.total / r.pageSize))} params={{}} basePath="/admin/missions" />
    </>
  );
}
