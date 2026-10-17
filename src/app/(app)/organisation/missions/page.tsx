import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgUser } from "@/lib/session";
import { listOrgMissions } from "@/application/mission.service";
import { MISSION_STATUS_LABELS, type MissionStatus } from "@/domain/workflows";
import { PageHeader, Pagination } from "@/ui/Page";
import { Card } from "@/ui/Card";
import { StatusBadge, DemoBadge } from "@/ui/Badge";
import { ButtonLink } from "@/ui/Button";
import { EmptyState } from "@/ui/Feedback";
import { Table, TBody, Td, Th, THead } from "@/ui/Table";

export const metadata: Metadata = { title: "Missions" };

export default async function OrgMissions({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const sp = await searchParams;
  const { user, org } = await requireOrgUser("org.view");
  const status = Object.keys(MISSION_STATUS_LABELS).includes(sp.status ?? "") ? (sp.status as MissionStatus) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const r = await listOrgMissions(user, org.id, { status, page });
  return (
    <>
      <PageHeader title="Missions" description="Gérez vos publications et le processus de sélection." actions={<ButtonLink href="/organisation/missions/nouvelle">Nouvelle mission</ButtonLink>} />
      <nav className="mb-4 flex flex-wrap gap-2 text-sm" aria-label="Filtrer par statut">
        <Link href="/organisation/missions" className={`rounded-full px-3 py-1 ${!status ? "bg-bordeaux-700 text-white" : "bg-white border border-line"}`}>Toutes</Link>
        {Object.entries(MISSION_STATUS_LABELS).map(([k, v]) => <Link key={k} href={`?status=${k}`} className={`rounded-full px-3 py-1 ${status === k ? "bg-bordeaux-700 text-white" : "bg-white border border-line"}`}>{v.split(" —")[0]}</Link>)}
      </nav>
      {r.items.length === 0 ? <EmptyState title="Aucune mission" action={<ButtonLink href="/organisation/missions/nouvelle">Créer une mission</ButtonLink>} /> : (
        <Card>
          <Table><THead><tr><Th>Référence</Th><Th>Intitulé</Th><Th>Domaine</Th><Th>Candidatures</Th><Th>Statut</Th><Th>Mise à jour</Th></tr></THead>
            <TBody>{r.items.map((m) => <tr key={m.id}><Td className="font-mono text-xs">{m.reference}</Td><Td><Link href={`/organisation/missions/${m.id}`} className="font-semibold hover:text-bordeaux-700">{m.title}</Link> <DemoBadge show={m.isDemo} /></Td><Td>{m.domain?.nameFr ?? "—"}</Td><Td>{m._count.applications}</Td><Td><StatusBadge status={m.status} label={MISSION_STATUS_LABELS[m.status]} /></Td><Td>{m.updatedAt.toLocaleDateString("fr-FR")}</Td></tr>)}</TBody>
          </Table>
        </Card>
      )}
      <Pagination page={page} pages={Math.max(1, Math.ceil(r.total / r.pageSize))} params={{ status }} basePath="/organisation/missions" />
    </>
  );
}
