import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminUser } from "@/lib/session";
import { adminExperts } from "@/application/admin.service";
import { PageHeader, Pagination } from "@/ui/Page";
import { Card } from "@/ui/Card";
import { Table, TBody, Td, Th, THead } from "@/ui/Table";
import { Badge, DemoBadge } from "@/ui/Badge";
import { Input } from "@/ui/Field";
import { Button } from "@/ui/Button";

export const metadata: Metadata = { title: "Experts" };

export default async function ExpertsAdmin({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const admin = await requireAdminUser("EXPERTS_VERIFY");
  const page = Math.max(1, Number(sp.page) || 1);
  const r = await adminExperts(admin, { q: sp.q?.slice(0, 80), page });
  return (
    <>
      <PageHeader title="Experts" description={`${r.total} profil(s)`} />
      <form className="mb-4 flex gap-2"><Input name="q" defaultValue={sp.q} placeholder="Nom ou titre" className="max-w-xs" aria-label="Recherche" /><Button type="submit">Rechercher</Button></form>
      <Card><Table><THead><tr><Th>Expert</Th><Th>Pays</Th><Th>Complétude</Th><Th>Visibilité</Th><Th>Badges actifs</Th></tr></THead>
        <TBody>{r.items.map((e) => <tr key={e.id}><Td><Link href={`/experts/${e.slug}`} className="font-semibold hover:underline">{e.user.firstName} {e.user.lastName}</Link> <DemoBadge show={e.isDemo} /><p className="text-xs text-slate">{e.user.email} · {e.headline}</p></Td><Td>{e.countryCode}</Td><Td>{e.completeness} %</Td><Td>{e.visibility}</Td><Td>{e.badges.map((b) => <Badge key={b.id} tone="olive" className="mr-1">{b.badge.nameFr}</Badge>)}</Td></tr>)}</TBody></Table></Card>
      <Pagination page={page} pages={Math.max(1, Math.ceil(r.total / r.pageSize))} params={{ q: sp.q }} basePath="/admin/experts" />
    </>
  );
}
