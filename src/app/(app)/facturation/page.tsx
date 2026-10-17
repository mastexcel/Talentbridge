import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { activeSubscriptions, listInvoices, listPublicPlans } from "@/application/billing.service";
import { prisma } from "@/infrastructure/db";
import { formatMoney } from "@/domain/money";
import { orgRoleCan, type OrgRole } from "@/domain/permissions";
import { INVOICE_STATUS_LABELS, SUBSCRIPTION_STATUS_LABELS } from "@/ui/labels";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { StatusBadge, DemoBadge } from "@/ui/Badge";
import { ApiForm } from "@/ui/ApiForm";
import { ActionButton } from "@/ui/ActionButton";
import { Field, Input, Select } from "@/ui/Field";
import { Alert } from "@/ui/Feedback";
import { Table, TBody, Td, Th, THead } from "@/ui/Table";

export const metadata: Metadata = { title: "Abonnement et factures" };
const INTERVAL = { MONTH: "mois", YEAR: "an", ONE_TIME: "paiement unique" } as const;

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ offre?: string; ok?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser("/facturation");
  const m = user.memberships.find((x) => x.organizationId === user.activeOrgId);
  const orgBilling = !!m && orgRoleCan(m.role as OrgRole, "billing.manage");
  const holders = [
    ...(user.expertProfile ? [{ key: "user", label: "Mon compte consultant", h: { userId: user.id, organizationId: null } as const, audience: "EXPERT" as const }] : []),
    ...(orgBilling ? [{ key: "org", label: m!.organization.name, h: { userId: null, organizationId: m!.organizationId } as const, audience: "ORGANIZATION" as const }] : []),
  ];
  const plans = await listPublicPlans();
  const data = await Promise.all(holders.map(async (x) => ({ ...x, subs: await activeSubscriptions(x.h), pending: await prisma.subscription.findMany({ where: { ...(x.h.organizationId ? { organizationId: x.h.organizationId } : { userId: x.h.userId! }), status: "PENDING_PAYMENT" }, include: { plan: true, invoices: true } }), invoices: await listInvoices(x.h) })));
  return (
    <>
      <PageHeader title="Abonnement et factures" description="Tarifs issus de la configuration en vigueur. Paiements confirmés uniquement par le prestataire (vérification serveur)." />
      {sp.ok && <Alert tone="success" className="mb-4">Votre offre est active.</Alert>}
      {holders.length === 0 && <Alert tone="info">Aucun espace facturable : la facturation d'une organisation est réservée à ses propriétaires et administrateurs.</Alert>}
      {data.map((d) => {
        const offers = plans.filter((p) => p.audience === d.audience);
        return (
          <section key={d.key} className="mb-10">
            <h2 className="mb-4 text-xl font-extrabold">{d.label}</h2>
            <div className="grid gap-6 xl:grid-cols-2">
              <Card><CardHeader title="Offres actives" /><CardBody className="space-y-3">
                {d.subs.length === 0 && <p className="text-sm text-slate">Aucune offre payante active{d.audience === "EXPERT" ? " (offre gratuite appliquée)." : "."}</p>}
                {d.subs.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3 text-sm">
                    <div><p className="font-semibold">{s.plan.name} <DemoBadge show={s.isDemo} /></p><p className="text-xs text-slate">{formatMoney(s.price.amountMinor, s.price.currency)} / {INTERVAL[s.price.interval]}{s.currentPeriodEnd ? ` · ${s.cancelAtPeriodEnd ? "se termine" : "renouvellement"} le ${s.currentPeriodEnd.toLocaleDateString("fr-FR")}` : ""}</p></div>
                    <div className="flex items-center gap-2"><StatusBadge status={s.status} label={SUBSCRIPTION_STATUS_LABELS[s.status]} />{s.plan.isRecurring && !s.cancelAtPeriodEnd && <ActionButton action="/api/v1/billing/cancel" body={{ subscriptionId: s.id }} confirm="Résilier ? L'offre reste active jusqu'à la fin de la période payée." variant="ghost" successMessage="Résiliation programmée.">Résilier</ActionButton>}</div>
                  </div>
                ))}
                {d.pending.map((s) => <Alert key={s.id} tone="warning">{s.plan.name} : en attente de paiement. {s.invoices[0] && <Link href={`/facturation/factures/${s.invoices[0].id}`} className="underline">Régler la facture</Link>} <ActionButton action="/api/v1/billing/cancel" body={{ subscriptionId: s.id }} variant="ghost" successMessage="Souscription annulée.">Annuler</ActionButton></Alert>)}
              </CardBody></Card>
              <Card><CardHeader title="Souscrire une offre ou un service" /><CardBody>
                <ApiForm action="/api/v1/billing/subscribe" submitLabel="Continuer vers le paiement" successMessage={null} className="space-y-3" extra={{ forOrganization: d.audience === "ORGANIZATION" }}>
                  <Field label="Offre" htmlFor={`price-${d.key}`} required>
                    <Select id={`price-${d.key}`} name="priceId" defaultValue={offers.find((p) => p.code === sp.offre)?.prices[0]?.id}>
                      {offers.flatMap((p) => p.prices.filter((pr) => pr.amountMinor > 0).map((pr) => <option key={pr.id} value={pr.id}>{p.name} — {formatMoney(pr.amountMinor, pr.currency)} / {INTERVAL[pr.interval]}</option>))}
                    </Select>
                  </Field>
                  <Field label="Moyen de paiement" htmlFor={`m-${d.key}`}><Select id={`m-${d.key}`} name="method"><option value="MOBILE_MONEY">Mobile Money</option><option value="CARD">Carte bancaire</option><option value="BANK_TRANSFER">Virement bancaire</option></Select></Field>
                  <Field label="Numéro Mobile Money (facultatif)" htmlFor={`ph-${d.key}`}><Input id={`ph-${d.key}`} name="payerPhone" type="tel" /></Field>
                  <Field label="Code promotionnel" htmlFor={`c-${d.key}`}><Input id={`c-${d.key}`} name="couponCode" /></Field>
                  <p className="text-xs text-slate">Prix HT ; TVA du pays de facturation ajoutée. Une facture numérotée est émise immédiatement.</p>
                </ApiForm>
              </CardBody></Card>
            </div>
            <Card className="mt-6"><CardHeader title="Factures" />
              {d.invoices.length === 0 ? <CardBody><p className="text-sm text-slate">Aucune facture.</p></CardBody> : (
                <Table><THead><tr><Th>Numéro</Th><Th>Émise le</Th><Th>Échéance</Th><Th>Total TTC</Th><Th>Statut</Th><Th /></tr></THead>
                  <TBody>{d.invoices.map((i) => <tr key={i.id}><Td><Link className="font-mono text-xs underline" href={`/facturation/factures/${i.id}`}>{i.number}</Link> <DemoBadge show={i.isDemo} /></Td><Td>{i.issuedAt?.toLocaleDateString("fr-FR")}</Td><Td>{i.dueAt?.toLocaleDateString("fr-FR")}</Td><Td>{formatMoney(i.totalMinor, i.currency)}</Td><Td><StatusBadge status={i.status} label={INVOICE_STATUS_LABELS[i.status]} /></Td><Td><a href={`/api/v1/invoices/${i.id}/pdf`} className="text-sm text-orange-700 underline">PDF</a></Td></tr>)}</TBody></Table>
              )}
            </Card>
          </section>
        );
      })}
    </>
  );
}
