import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/infrastructure/db";
import { requireAdminUser } from "@/lib/session";
import { listAllInvoices } from "@/application/finance.service";
import { formatMoney } from "@/domain/money";
import { INVOICE_STATUS_LABELS, METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/ui/labels";
import { PageHeader, Pagination } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { Table, TBody, Td, Th, THead } from "@/ui/Table";
import { Badge, DemoBadge, StatusBadge } from "@/ui/Badge";
import { ActionButton } from "@/ui/ActionButton";
import { Input, Select } from "@/ui/Field";
import { Button } from "@/ui/Button";

export const metadata: Metadata = { title: "Factures et paiements" };

export default async function InvoicesAdmin({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const sp = await searchParams;
  await requireAdminUser("FINANCE_MANAGE");
  const page = Math.max(1, Number(sp.page) || 1);
  const [r, refunds, transfers] = await Promise.all([
    listAllInvoices({ q: sp.q?.slice(0, 60), status: Object.keys(INVOICE_STATUS_LABELS).includes(sp.status ?? "") ? sp.status : undefined, page }),
    prisma.refund.findMany({ where: { status: "REQUESTED" }, include: { payment: { include: { invoice: { select: { number: true } } } } } }),
    prisma.payment.findMany({ where: { method: "BANK_TRANSFER", status: "PENDING" }, include: { invoice: { select: { number: true } } } }),
  ]);
  return (
    <>
      <PageHeader title="Factures et paiements" />
      {(refunds.length > 0 || transfers.length > 0) && (
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <Card><CardHeader title="Virements à rapprocher" description="Confirmer uniquement après réception effective sur le compte bancaire." /><CardBody className="space-y-2 text-sm">{transfers.length === 0 ? <p className="text-slate">Aucun.</p> : transfers.map((p) => <div key={p.id} className="flex flex-wrap items-center justify-between gap-2"><span>{p.invoice.number} · {formatMoney(p.amountMinor, p.currency)} · réf. {p.id}</span><ActionButton action="/api/v1/admin/transfer-confirm" body={{ paymentId: p.id }} variant="success" prompt={{ key: "bankReference", label: "Référence bancaire du virement reçu", required: true }} successMessage="Virement rapproché, facture mise à jour.">Confirmer la réception</ActionButton></div>)}</CardBody></Card>
          <Card><CardHeader title="Demandes de remboursement" /><CardBody className="space-y-2 text-sm">{refunds.length === 0 ? <p className="text-slate">Aucune.</p> : refunds.map((x) => <div key={x.id} className="flex flex-wrap items-center justify-between gap-2"><span>{x.payment.invoice.number} · {formatMoney(x.amountMinor, x.payment.currency)} — {x.reason}</span><span className="flex gap-1"><ActionButton action="/api/v1/admin/refund-decide" body={{ refundId: x.id, approve: true }} variant="success" confirm="Déclencher le remboursement auprès du prestataire ?" successMessage="Remboursement traité.">Approuver</ActionButton><ActionButton action="/api/v1/admin/refund-decide" body={{ refundId: x.id, approve: false }} variant="danger" successMessage="Demande refusée.">Refuser</ActionButton></span></div>)}</CardBody></Card>
        </div>
      )}
      <form className="mb-4 flex flex-wrap gap-2"><Input name="q" defaultValue={sp.q} placeholder="Numéro ou client" className="max-w-xs" aria-label="Recherche" /><Select name="status" defaultValue={sp.status ?? ""} className="max-w-[200px]" aria-label="Statut"><option value="">Tous statuts</option>{Object.entries(INVOICE_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select><Button type="submit">Filtrer</Button></form>
      <Card><Table><THead><tr><Th>Numéro</Th><Th>Client</Th><Th>TTC</Th><Th>Payé</Th><Th>Statut</Th><Th>Paiements</Th></tr></THead>
        <TBody>{r.items.map((i) => <tr key={i.id}><Td><Link href={`/facturation/factures/${i.id}`} className="font-mono text-xs underline">{i.number}</Link> <DemoBadge show={i.isDemo} /></Td><Td>{i.organization?.name ?? `${i.user?.firstName ?? ""} ${i.user?.lastName ?? ""}`}</Td><Td>{formatMoney(i.totalMinor, i.currency)}</Td><Td>{formatMoney(i.paidMinor, i.currency)}</Td><Td><StatusBadge status={i.status} label={INVOICE_STATUS_LABELS[i.status]} /></Td><Td className="text-xs">{i.payments.map((p) => <span key={p.id} className="block">{METHOD_LABELS[p.method]} · {PAYMENT_STATUS_LABELS[p.status]}{p.isTest && <Badge tone="demo" className="ml-1">Test</Badge>}</span>)}</Td></tr>)}</TBody></Table></Card>
      <Pagination page={page} pages={Math.max(1, Math.ceil(r.total / r.pageSize))} params={{ q: sp.q, status: sp.status }} basePath="/admin/factures" />
    </>
  );
}
