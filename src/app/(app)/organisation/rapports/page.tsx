import type { Metadata } from "next";
import { prisma } from "@/infrastructure/db";
import { requireOrgUser } from "@/lib/session";
import { formatMoney } from "@/domain/money";
import { APPLICATION_STATUS_LABELS, MISSION_STATUS_LABELS } from "@/domain/workflows";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { StatCard } from "@/ui/Stat";
import { BarChartCard, DonutCard, LineChartCard } from "@/ui/charts";

export const metadata: Metadata = { title: "Rapports" };

/** Rapports de l'organisation : calculés exclusivement sur ses propres données. */
export default async function OrgReports() {
  const { org } = await requireOrgUser("reports.view");
  const since = new Date(Date.now() - 365 * 86_400_000);
  const [missions, apps, contracts, reviews] = await Promise.all([
    prisma.mission.groupBy({ by: ["status"], where: { organizationId: org.id }, _count: true }),
    prisma.application.findMany({ where: { mission: { organizationId: org.id }, createdAt: { gte: since } }, select: { createdAt: true, status: true } }),
    prisma.contract.findMany({ where: { organizationId: org.id }, select: { amountMinor: true, currency: true, createdAt: true, status: true } }),
    prisma.review.aggregate({ where: { organizationId: org.id }, _avg: { rating: true }, _count: true }),
  ]);
  const byMonth = new Map<string, number>();
  for (const a of apps) byMonth.set(a.createdAt.toISOString().slice(0, 7), (byMonth.get(a.createdAt.toISOString().slice(0, 7)) ?? 0) + 1);
  const appStatus = new Map<string, number>();
  for (const a of apps) appStatus.set(a.status, (appStatus.get(a.status) ?? 0) + 1);
  const spend = contracts.filter((c) => c.currency === "XOF" && c.status !== "TERMINATED").reduce((s, c) => s + c.amountMinor, 0);
  return (
    <>
      <PageHeader title="Rapports" description="Activité de votre organisation sur les 12 derniers mois." />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Missions" value={missions.reduce((s, m) => s + m._count, 0)} />
        <StatCard label="Candidatures reçues (12 mois)" value={apps.length} tone="orange" />
        <StatCard label="Engagements contractuels (XOF)" value={formatMoney(spend, "XOF")} tone="olive" />
        <StatCard label="Note moyenne donnée" value={reviews._count ? `${reviews._avg.rating?.toFixed(1)}/5` : "—"} tone="ink" hint={`${reviews._count} évaluation(s)`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Candidatures reçues par mois" /><CardBody><LineChartCard data={[...byMonth].sort().map(([month, n]) => ({ month, candidatures: n }))} xKey="month" series={[{ key: "candidatures", label: "Candidatures" }]} /></CardBody></Card>
        <Card><CardHeader title="Missions par statut" /><CardBody><BarChartCard layout="vertical" data={missions.map((m) => ({ label: MISSION_STATUS_LABELS[m.status].split(" —")[0], missions: m._count }))} xKey="label" series={[{ key: "missions", label: "Missions" }]} /></CardBody></Card>
        <Card className="lg:col-span-2"><CardHeader title="Issue des candidatures" /><CardBody><DonutCard data={[...appStatus].map(([s, v]) => ({ label: APPLICATION_STATUS_LABELS[s as keyof typeof APPLICATION_STATUS_LABELS], value: v }))} /></CardBody></Card>
      </div>
    </>
  );
}
