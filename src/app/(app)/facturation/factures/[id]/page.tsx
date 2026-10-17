import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { getInvoice } from "@/application/billing.service";
import { formatMoney } from "@/domain/money";
import { INVOICE_STATUS_LABELS, METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/ui/labels";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { Badge, DemoBadge, StatusBadge } from "@/ui/Badge";
import { ActionButton } from "@/ui/ActionButton";
import { ButtonLink } from "@/ui/Button";
import { Table, TBody, Td, Th, THead } from "@/ui/Table";
import { Alert } from "@/ui/Feedback";
import { ApiForm } from "@/ui/ApiForm";
import { Field, Input } from "@/ui/Field";

export const metadata: Metadata = { title: "Facture" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/facturation/factures/${id}`);
  const inv = await getInvoice(user, id);
  const buyer = inv.buyerSnapshot as Record<string, string | null>;
  const due = inv.totalMinor - inv.paidMinor;
  const pending = inv.payments.find((p) => p.status === "PENDING");
  return (
    <>
      <PageHeader back={{ href: "/facturation", label: "Factures" }} title={<span className="flex items-center gap-2">Facture {inv.number} <DemoBadge show={inv.isDemo} /></span>} description={<StatusBadge status={inv.status} label={INVOICE_STATUS_LABELS[inv.status]} />} actions={<ButtonLink href={`/api/v1/invoices/${inv.id}/pdf`} variant="outline">Télécharger le PDF</ButtonLink>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardBody className="grid gap-4 text-sm sm:grid-cols-2">
            <div><p className="text-xs uppercase text-slate">Client</p><p className="font-semibold">{buyer.name}</p><p>{buyer.address}</p>{buyer.taxId && <p>Identifiant fiscal : {buyer.taxId}</p>}</div>
            <div className="sm:text-right"><p>Émise le {inv.issuedAt?.toLocaleDateString("fr-FR")}</p><p>Échéance {inv.dueAt?.toLocaleDateString("fr-FR")}</p></div>
          </CardBody>
          <Table><THead><tr><Th>Désignation</Th><Th>Qté</Th><Th>PU HT</Th><Th>TVA</Th><Th>Total HT</Th></tr></THead>
            <TBody>{inv.lines.map((l) => <tr key={l.id}><Td>{l.description}</Td><Td>{l.quantity}</Td><Td>{formatMoney(l.unitPriceMinor, inv.currency)}</Td><Td>{l.taxRateBps / 100} %</Td><Td>{formatMoney(l.totalMinor, inv.currency)}</Td></tr>)}</TBody></Table>
          <CardBody className="space-y-1 text-right text-sm">
            <p>Total HT : {formatMoney(inv.subtotalMinor, inv.currency)}</p><p>TVA : {formatMoney(inv.taxMinor, inv.currency)}</p>
            <p className="font-display text-lg font-extrabold">Total TTC : {formatMoney(inv.totalMinor, inv.currency)}</p>
            <p>Déjà réglé : {formatMoney(inv.paidMinor, inv.currency)} · <strong>Reste à payer : {formatMoney(due, inv.currency)}</strong></p>
          </CardBody>
        </Card>
        <aside className="space-y-6">
          {["ISSUED", "PARTIALLY_PAID"].includes(inv.status) && (
            <Card><CardHeader title="Régler la facture" /><CardBody className="space-y-2">
              {pending && pending.provider === "mock" && <ButtonLink href={`/paiement/test/${pending.id}`} className="w-full">Reprendre le paiement de test</ButtonLink>}
              {(["MOBILE_MONEY", "CARD", "BANK_TRANSFER"] as const).map((m) => <ActionButton key={m} action="/api/v1/billing/pay" body={{ invoiceId: inv.id, method: m }} variant={m === "MOBILE_MONEY" ? "primary" : "outline"} size="md" className="w-full" successMessage={m === "BANK_TRANSFER" ? "Instructions de virement générées : la finance confirmera la réception." : null}>{METHOD_LABELS[m]}</ActionButton>)}
            </CardBody></Card>
          )}
          <Card><CardHeader title="Paiements" /><CardBody className="space-y-3 text-sm">
            {inv.payments.length === 0 && <p className="text-slate">Aucun paiement.</p>}
            {inv.payments.map((p) => (
              <div key={p.id} className="rounded-xl border border-line p-3">
                <p className="flex flex-wrap items-center gap-2">{METHOD_LABELS[p.method]} · {formatMoney(p.amountMinor, p.currency)} <StatusBadge status={p.status} label={PAYMENT_STATUS_LABELS[p.status]} />{p.isTest && <Badge tone="demo">Test</Badge>}</p>
                <p className="text-xs text-slate">{p.createdAt.toLocaleString("fr-FR")}{p.failureReason ? ` — ${p.failureReason}` : ""}</p>
                {p.method === "BANK_TRANSFER" && p.status === "PENDING" && <Alert tone="info" className="mt-2">Virement en attente de réception. Référence à indiquer : {p.id}</Alert>}
                {p.refunds.map((r) => <p key={r.id} className="text-xs">Remboursement {formatMoney(r.amountMinor, p.currency)} : {r.status}</p>)}
                {["SUCCEEDED", "PARTIALLY_REFUNDED"].includes(p.status) && (
                  <details className="mt-2"><summary className="cursor-pointer text-xs text-slate">Demander un remboursement</summary>
                    <ApiForm action="/api/v1/billing/refund" submitLabel="Envoyer la demande" successMessage="Demande transmise à la finance." className="mt-2 space-y-2" extra={{ paymentId: p.id }}>
                      <Field label="Montant" htmlFor={`ra-${p.id}`}><Input id={`ra-${p.id}`} name="amount" type="number" data-type="number" /></Field>
                      <Field label="Motif" htmlFor={`rr-${p.id}`}><Input id={`rr-${p.id}`} name="reason" /></Field>
                    </ApiForm>
                    <p className="mt-1 text-xs text-slate">Traitement selon les conditions générales de vente applicables.</p>
                  </details>
                )}
              </div>
            ))}
          </CardBody></Card>
        </aside>
      </div>
    </>
  );
}
