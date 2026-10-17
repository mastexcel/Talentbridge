import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/infrastructure/db";
import { requireExpertUser } from "@/lib/session";
import { listExpertContracts } from "@/application/project.service";
import { formatMoney } from "@/domain/money";
import { CONTRACT_STATUS_LABELS } from "@/domain/workflows";
import { INVOICE_STATUS_LABELS } from "@/ui/labels";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { StatusBadge } from "@/ui/Badge";
import { StatCard } from "@/ui/Stat";
import { ActionButton } from "@/ui/ActionButton";
import { Table, TBody, Td, Th, THead } from "@/ui/Table";
import { EmptyState } from "@/ui/Feedback";

export const metadata: Metadata = { title: "Contrats et revenus" };

export default async function ExpertContracts() {
  const user = await requireExpertUser("/espace/contrats");
  const [contracts, invoices] = await Promise.all([listExpertContracts(user.expertProfile.id), prisma.invoice.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } })]);
  const byCurrency = (status: string[]) => {
    const m = new Map<string, number>();
    for (const c of contracts.filter((x) => status.includes(x.status))) m.set(c.currency, (m.get(c.currency) ?? 0) + c.amountMinor);
    return [...m].map(([cur, v]) => formatMoney(v, cur)).join(" · ") || "—";
  };
  return (
    <>
      <PageHeader title="Contrats et revenus" description="Montants contractuels convenus avec les organisations (hors commission plateforme, qui est facturée aux organisations)." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Revenus réalisés (contrats terminés)" value={byCurrency(["COMPLETED"])} tone="olive" />
        <StatCard label="En cours" value={byCurrency(["SIGNED", "ACTIVE"])} tone="orange" />
        <StatCard label="À signer" value={contracts.filter((c) => c.status === "SENT").length} />
      </div>
      <Card className="mb-6">
        <CardHeader title="Contrats" />
        {contracts.length === 0 ? <CardBody><EmptyState title="Aucun contrat" description="Vos contrats apparaîtront ici dès qu'une organisation vous aura retenu." /></CardBody> : (
          <Table><THead><tr><Th>Référence</Th><Th>Mission</Th><Th>Organisation</Th><Th>Montant</Th><Th>Statut</Th><Th /></tr></THead>
            <TBody>{contracts.map((c) => (
              <tr key={c.id}><Td className="font-mono text-xs">{c.reference}</Td><Td><Link href={`/missions/${c.mission.reference}`} className="hover:underline">{c.mission.title}</Link></Td><Td>{c.organization.name}</Td><Td>{formatMoney(c.amountMinor, c.currency)}</Td><Td><StatusBadge status={c.status} label={CONTRACT_STATUS_LABELS[c.status]} /></Td>
                <Td>{c.status === "SENT" && <ActionButton action={`/api/v1/contracts/${c.id}/status`} body={{ status: "SIGNED" }} variant="success" confirm={`Signer électroniquement le contrat ${c.reference} ? Votre acceptation est horodatée et journalisée.`} successMessage="Contrat signé.">Signer</ActionButton>}</Td></tr>
            ))}</TBody></Table>
        )}
      </Card>
      <Card>
        <CardHeader title="Mes factures Talent Bridge" description="Abonnements, certifications et formations." />
        {invoices.length === 0 ? <CardBody><p className="text-sm text-slate">Aucune facture.</p></CardBody> : (
          <Table><THead><tr><Th>Numéro</Th><Th>Date</Th><Th>Montant TTC</Th><Th>Statut</Th></tr></THead><TBody>{invoices.map((i) => <tr key={i.id}><Td><Link href={`/facturation/factures/${i.id}`} className="font-mono text-xs underline">{i.number}</Link></Td><Td>{i.issuedAt?.toLocaleDateString("fr-FR")}</Td><Td>{formatMoney(i.totalMinor, i.currency)}</Td><Td><StatusBadge status={i.status} label={INVOICE_STATUS_LABELS[i.status]} /></Td></tr>)}</TBody></Table>
        )}
      </Card>
    </>
  );
}
