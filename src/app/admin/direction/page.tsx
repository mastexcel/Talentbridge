import type { Metadata } from "next";
import { prisma } from "@/infrastructure/db";
import { requireAdminUser } from "@/lib/session";
import { ceoKpis, topOrganizations } from "@/application/analytics.service";
import { ORGANIZATION_TYPE_LABELS } from "@/application/schemas";
import { kpiFilterFrom } from "@/lib/kpi-filter";
import { formatMoney } from "@/domain/money";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { StatCard } from "@/ui/Stat";
import { Alert } from "@/ui/Feedback";
import { Button, ButtonLink } from "@/ui/Button";
import { Input, Select, Checkbox } from "@/ui/Field";
import { Table, TBody, Td, Th, THead } from "@/ui/Table";
import { BarChartCard, DonutCard, FunnelCard, LineChartCard } from "@/ui/charts";
import { AfricaTileMap } from "@/ui/AfricaTileMap";

export const metadata: Metadata = { title: "CEO Dashboard" };
export const dynamic = "force-dynamic";

/** Cockpit de direction. Définitions des indicateurs : docs/KPI.md. */
export default async function CeoDashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  await requireAdminUser("ANALYTICS_VIEW");
  const f = kpiFilterFrom(sp);
  const [k, top, countries] = await Promise.all([ceoKpis(f), topOrganizations(f), prisma.country.findMany({ orderBy: { nameFr: "asc" } })]);
  const money = (v: number) => formatMoney(v, f.currency);
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
  const pct = (v: number | null) => (v == null ? "n.d." : `${v} %`);
  return (
    <>
      <PageHeader title="CEO Dashboard" description={`Du ${f.from.toLocaleDateString("fr-FR")} au ${f.to.toLocaleDateString("fr-FR")}`} actions={<><ButtonLink href={`/api/v1/exports/direction?format=pdf&${qs}`} variant="outline" size="sm">PDF</ButtonLink><ButtonLink href={`/api/v1/exports/direction?format=xlsx&${qs}`} variant="outline" size="sm">Excel</ButtonLink><ButtonLink href={`/api/v1/exports/direction?format=csv&${qs}`} variant="outline" size="sm">CSV</ButtonLink></>} />
      <form className="mb-6 flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-white p-4 shadow-card" aria-label="Filtres">
        <label className="text-xs font-semibold">Du<Input name="from" type="date" defaultValue={f.from.toISOString().slice(0, 10)} /></label>
        <label className="text-xs font-semibold">Au<Input name="to" type="date" defaultValue={f.to.toISOString().slice(0, 10)} /></label>
        <label className="text-xs font-semibold">Pays<Select name="country" defaultValue={f.country ?? ""}><option value="">Tous</option>{countries.map((c) => <option key={c.code} value={c.code}>{c.nameFr}</option>)}</Select></label>
        <label className="text-xs font-semibold">Type de client<Select name="orgType" defaultValue={f.orgType ?? ""}><option value="">Tous</option>{Object.entries(ORGANIZATION_TYPE_LABELS).map(([kk, v]) => <option key={kk} value={kk}>{v}</option>)}</Select></label>
        <label className="text-xs font-semibold">Devise<Select name="currency" defaultValue={f.currency}><option>XOF</option><option>XAF</option><option>EUR</option><option>USD</option></Select></label>
        <Checkbox name="demo" value="1" defaultChecked={f.includeDemo} label="Inclure la démo" />
        <Button type="submit">Appliquer</Button>
      </form>
      {k.includeDemo && <Alert tone="warning" title="Données de démonstration incluses" className="mb-6">Ces chiffres ne représentent pas l'activité réelle et ne doivent pas être communiqués comme tels.</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Utilisateurs" value={k.totals.totalUsers} hint={`+${k.totals.newUsersPeriod} sur la période`} />
        <StatCard label="Experts inscrits / vérifiés" value={`${k.totals.experts} / ${k.totals.verifiedExperts}`} tone="olive" />
        <StatCard label="Organisations" value={k.totals.organizations} tone="ink" />
        <StatCard label="Clients payants" value={k.totals.payingClients} tone="orange" hint={`${k.totals.activeSubs} abonnement(s) actif(s)`} />
        <StatCard label="Chiffre d'affaires encaissé" value={money(k.finance.revenue)} tone="olive" />
        <StatCard label="MRR / ARR" value={money(k.finance.mrr)} hint={`ARR ${money(k.finance.arr)}`} />
        <StatCard label="Missions publiées / attribuées" value={`${k.totals.missionsPublished} / ${k.totals.missionsAwarded}`} tone="ink" />
        <StatCard label="Délai moyen de matching" value={k.rates.avgMatchingHours != null ? `${k.rates.avgMatchingHours} h` : "n.d."} tone="orange" hint={`Publication → 1re sélection (${k.rates.matchingSample} mission(s)) · objectif 72 h`} />
        <StatCard label="Taux de conversion" value={pct(k.rates.conversionPct)} hint="Clients payants / inscrits" />
        <StatCard label="Taux de sélection des candidatures" value={pct(k.rates.applicationSelectionPct)} tone="olive" />
        <StatCard label="Satisfaction" value={k.rates.satisfaction != null ? `${k.rates.satisfaction}/5` : "n.d."} hint={`${k.rates.satisfactionCount} avis vérifiés`} tone="orange" />
        <StatCard label="Taux de renouvellement" value={pct(k.rates.renewalPct)} tone="ink" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card><CardHeader title="Évolution des inscriptions" /><CardBody><LineChartCard data={k.signupsByMonth.map((m) => ({ mois: m.month, experts: m.experts, organisations: m.organizations }))} xKey="mois" series={[{ key: "experts", label: "Consultants" }, { key: "organisations", label: "Comptes organisation" }]} /></CardBody></Card>
        <Card><CardHeader title="Chiffre d'affaires mensuel" /><CardBody><BarChartCard data={k.finance.byMonth.map((m) => ({ mois: m.month, ca: m.amount }))} xKey="mois" series={[{ key: "ca", label: "Encaissements" }]} format={money} /></CardBody></Card>
        <Card><CardHeader title="Revenus par service" /><CardBody><DonutCard data={k.finance.byService.map((s) => ({ label: s.label, value: s.amount }))} format={money} /></CardBody></Card>
        <Card><CardHeader title="Entonnoir de conversion des consultants" description="Inscrits sur la période" /><CardBody><FunnelCard steps={k.funnel} /></CardBody></Card>
        <Card><CardHeader title="Experts par pays" /><CardBody><AfricaTileMap values={k.expertsByCountry.map((x) => ({ code: x.code, value: x.count }))} /></CardBody></Card>
        <Card><CardHeader title="Revenus par pays" /><CardBody>{k.finance.byCountry.length ? <BarChartCard layout="vertical" data={k.finance.byCountry.map((c) => ({ pays: c.code, ca: c.amount }))} xKey="pays" series={[{ key: "ca", label: "Encaissements" }]} format={money} /> : <p className="py-10 text-center text-sm text-slate">Aucune recette sur la période.</p>}</CardBody></Card>
        <Card><CardHeader title="Organisations par type" /><CardBody><BarChartCard layout="vertical" data={k.orgsByType.map((o) => ({ type: ORGANIZATION_TYPE_LABELS[o.type], organisations: o.count }))} xKey="type" series={[{ key: "organisations", label: "Organisations" }]} /></CardBody></Card>
        <Card><CardHeader title="Classement des organisations" description="Par missions publiées sur la période" /><CardBody className="p-0">
          <Table><THead><tr><Th>#</Th><Th>Organisation</Th><Th>Pays</Th><Th>Missions</Th><Th>Contrats</Th></tr></THead><TBody>{top.map((o, i) => <tr key={o.name}><Td>{i + 1}</Td><Td>{o.name}</Td><Td>{o.countryCode}</Td><Td>{o._count.missions}</Td><Td>{o._count.contracts}</Td></tr>)}</TBody></Table>
          {top.length === 0 && <p className="p-5 text-sm text-slate">Aucune donnée.</p>}
        </CardBody></Card>
      </div>
    </>
  );
}
