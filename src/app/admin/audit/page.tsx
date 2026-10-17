import type { Metadata } from "next";
import { requireAdminUser } from "@/lib/session";
import { listAudit } from "@/application/audit.service";
import { PageHeader, Pagination } from "@/ui/Page";
import { Card } from "@/ui/Card";
import { Table, TBody, Td, Th, THead } from "@/ui/Table";
import { Input } from "@/ui/Field";
import { Button, ButtonLink } from "@/ui/Button";

export const metadata: Metadata = { title: "Journal d'audit" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string; page?: string }> }) {
  const sp = await searchParams;
  await requireAdminUser("AUDIT_VIEW");
  const page = Math.max(1, Number(sp.page) || 1);
  const r = await listAudit({ action: sp.action?.slice(0, 60), page });
  return (
    <>
      <PageHeader title="Journal d'audit" description="Ajout seul : aucune entrée ne peut être modifiée ni supprimée depuis l'application." actions={<><ButtonLink href="/api/v1/exports/audit?format=csv" variant="outline" size="sm">CSV</ButtonLink><ButtonLink href="/api/v1/exports/audit?format=xlsx" variant="outline" size="sm">Excel</ButtonLink></>} />
      <form className="mb-4 flex gap-2"><Input name="action" defaultValue={sp.action} placeholder="Filtrer par action (ex. verification, payment, user.suspend)" className="max-w-md" aria-label="Action" /><Button type="submit">Filtrer</Button></form>
      <Card><Table><THead><tr><Th>Date</Th><Th>Action</Th><Th>Entité</Th><Th>Acteur</Th><Th>Détails</Th></tr></THead>
        <TBody>{r.items.map((a) => <tr key={a.id}><Td className="whitespace-nowrap text-xs">{a.createdAt.toLocaleString("fr-FR")}</Td><Td className="font-mono text-xs">{a.action}</Td><Td className="text-xs">{a.entityType} {a.entityId && <span className="text-slate">{a.entityId.slice(0, 10)}…</span>}</Td><Td className="text-xs">{a.actor?.email ?? "système"}{a.ip ? ` · ${a.ip}` : ""}</Td><Td className="max-w-xs truncate font-mono text-[11px] text-slate">{a.metadata ? JSON.stringify(a.metadata) : ""}</Td></tr>)}</TBody></Table></Card>
      <Pagination page={page} pages={Math.max(1, Math.ceil(r.total / r.pageSize))} params={{ action: sp.action }} basePath="/admin/audit" />
    </>
  );
}
