import type { Metadata } from "next";
import { requireAdminUser } from "@/lib/session";
import { financeDashboard } from "@/application/finance.service";
import { getSetting } from "@/application/settings.service";
import { prisma } from "@/infrastructure/db";
import { formatMoney } from "@/domain/money";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { StatCard } from "@/ui/Stat";
import { ButtonLink } from "@/ui/Button";
import { Alert } from "@/ui/Feedback";
import { ApiForm } from "@/ui/ApiForm";
import { Field, Input, Select } from "@/ui/Field";
import { BarChartCard, DonutCard } from "@/ui/charts";

export const metadata: Metadata = { title: "Finances" };

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ test?: string; currency?: string }> }) {
  const sp = await searchParams;
  await requireAdminUser("FINANCE_MANAGE");
  const includeTest = sp.test === "1";
  const currency = /^[A-Z]{3}$/.test(sp.currency ?? "") ? sp.currency! : "XOF";
  const [f, seller, prefix, term, commission, countries, taxes] = await Promise.all([
    financeDashboard({ includeTest, currency }), getSetting("seller.identity"), getSetting("invoice.prefix"), getSetting("invoice.paymentTermDays"), getSetting("commission.defaultBps"),
    prisma.country.findMany({ orderBy: { nameFr: "asc" } }), prisma.taxRate.findMany({ where: { isDefault: true, isActive: true } }),
  ]);
  const s = seller as Record<string, string>;
  const fmt = (v: number) => formatMoney(v, currency);
  return (
    <>
      <PageHeader title="Tableau de bord financier" description={`Devise ${currency}. ${includeTest ? "Paiements de TEST et données de démonstration inclus." : "Recettes réelles uniquement (paiements de test exclus)."}`}
        actions={<><ButtonLink href={includeTest ? "?" : "?test=1"} variant="outline" size="sm">{includeTest ? "Exclure les tests" : "Inclure les tests / démo"}</ButtonLink><ButtonLink href="/api/v1/exports/factures?format=xlsx" variant="outline" size="sm">Export Excel</ButtonLink><ButtonLink href="/api/v1/exports/factures?format=csv" variant="outline" size="sm">Export CSV</ButtonLink></>} />
      {!includeTest && f.testPaymentsExcluded > 0 && <Alert tone="info" className="mb-4">{f.testPaymentsExcluded} paiement(s) de test exclu(s) des recettes.</Alert>}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Recettes encaissées (12 mois)" value={fmt(f.revenue)} hint={`Remboursements déduits : ${fmt(f.refunds)}`} tone="olive" />
        <StatCard label="MRR / ARR" value={fmt(f.mrr)} hint={`ARR ${fmt(f.arr)} · ${f.activeSubscriptions} abonnement(s) actif(s)`} />
        <StatCard label="Créances" value={fmt(f.outstanding)} hint={`dont échues : ${fmt(f.overdue)}`} tone="orange" />
        <StatCard label="Commissions" value={f.commissions.map((c) => `${c.status} ${fmt(c.amount)}`).join(" · ") || "—"} tone="ink" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Recettes mensuelles" /><CardBody><BarChartCard data={f.byMonth.map((m) => ({ mois: m.month, recettes: m.amount }))} xKey="mois" series={[{ key: "recettes", label: "Recettes" }]} currency={currency} /></CardBody></Card>
        <Card><CardHeader title="Recettes par service" /><CardBody><DonutCard data={f.byService.map((s) => ({ label: s.label, value: s.amount }))} currency={currency} /></CardBody></Card>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Identité vendeur (mentions des factures)" description="Champs fiscaux à valider par l'expert-comptable (réglementation ivoirienne notamment)." /><CardBody>
          <ApiForm action="/api/v1/admin/seller-identity" successMessage="Identité enregistrée." className="grid gap-3 sm:grid-cols-2">
            <Field label="Raison sociale" htmlFor="s-name"><Input id="s-name" name="name" defaultValue={s.name} /></Field>
            <Field label="Adresse" htmlFor="s-addr"><Input id="s-addr" name="address" defaultValue={s.address} /></Field>
            <Field label="Pays" htmlFor="s-c"><Select id="s-c" name="countryCode" defaultValue={s.countryCode}>{countries.map((c) => <option key={c.code} value={c.code}>{c.nameFr}</option>)}</Select></Field>
            <Field label="RCCM" htmlFor="s-r"><Input id="s-r" name="registrationNumber" defaultValue={s.registrationNumber} /></Field>
            <Field label="Compte contribuable (NCC)" htmlFor="s-t"><Input id="s-t" name="taxId" defaultValue={s.taxId} /></Field>
            <Field label="Régime fiscal" htmlFor="s-g"><Input id="s-g" name="taxRegime" defaultValue={s.taxRegime} /></Field>
          </ApiForm>
        </CardBody></Card>
        <Card><CardHeader title="Paramètres de facturation et TVA" /><CardBody className="space-y-6">
          <ApiForm action="/api/v1/admin/billing-settings" successMessage="Paramètres enregistrés." className="grid gap-3 sm:grid-cols-3">
            <Field label="Préfixe des factures" htmlFor="b-p"><Input id="b-p" name="invoicePrefix" defaultValue={String(prefix)} /></Field>
            <Field label="Délai de paiement (jours)" htmlFor="b-t"><Input id="b-t" name="paymentTermDays" type="number" data-type="number" defaultValue={Number(term)} /></Field>
            <Field label="Commission par défaut (%)" htmlFor="b-c"><Input id="b-c" name="commissionPct" type="number" step="0.1" data-type="number" defaultValue={Number(commission) / 100} /></Field>
          </ApiForm>
          <div><p className="mb-2 text-sm font-semibold">Taux de TVA par défaut</p><p className="mb-2 text-xs text-slate">{taxes.map((t) => `${t.countryCode} ${t.rateBps / 100} %`).join(" · ")}</p>
            <ApiForm action="/api/v1/admin/tax-rate" submitLabel="Définir le taux" successMessage="Taux enregistré (l'ancien est désactivé)." className="grid gap-2 sm:grid-cols-3">
              <Select name="countryCode" aria-label="Pays">{countries.map((c) => <option key={c.code} value={c.code}>{c.nameFr}</option>)}</Select>
              <Input name="name" placeholder="Libellé (ex. TVA 18 %)" aria-label="Libellé" />
              <Input name="ratePct" type="number" step="0.01" data-type="number" placeholder="Taux %" aria-label="Taux" />
            </ApiForm>
          </div>
        </CardBody></Card>
      </div>
    </>
  );
}
