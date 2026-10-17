import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminUser } from "@/lib/session";
import { adminQueue } from "@/application/verification.service";
import { VERIFICATION_STATUS_LABELS, VERIFICATION_TYPE_LABELS, type VerificationStatus } from "@/domain/workflows";
import { PageHeader } from "@/ui/Page";
import { Card } from "@/ui/Card";
import { Table, TBody, Td, Th, THead } from "@/ui/Table";
import { StatusBadge } from "@/ui/Badge";
import { EmptyState } from "@/ui/Feedback";

export const metadata: Metadata = { title: "Vérifications" };

export default async function VerificationQueue({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const admin = await requireAdminUser("EXPERTS_VERIFY");
  const status = Object.keys(VERIFICATION_STATUS_LABELS).includes(sp.status ?? "") ? (sp.status as VerificationStatus) : undefined;
  const q = await adminQueue(admin, { status });
  return (
    <>
      <PageHeader title="Centre de certification" description="File d'attente des demandes. Les décisions sont historisées et journalisées." />
      <nav className="mb-4 flex flex-wrap gap-2 text-sm"><Link href="/admin/verifications" className={`rounded-full px-3 py-1 ${!status ? "bg-bordeaux-700 text-white" : "border border-line bg-white"}`}>À traiter</Link>{(["VERIFIED", "REJECTED", "EXPIRED"] as const).map((s) => <Link key={s} href={`?status=${s}`} className={`rounded-full px-3 py-1 ${status === s ? "bg-bordeaux-700 text-white" : "border border-line bg-white"}`}>{VERIFICATION_STATUS_LABELS[s]}</Link>)}</nav>
      {q.items.length === 0 ? <EmptyState title="File vide" /> : (
        <Card><Table><THead><tr><Th>Expert</Th><Th>Type</Th><Th>Soumise le</Th><Th>Pièces</Th><Th>Contrôles</Th><Th>Statut</Th></tr></THead>
          <TBody>{q.items.map((r) => <tr key={r.id}><Td><Link href={`/admin/verifications/${r.id}`} className="font-semibold hover:underline">{r.expert.user.firstName} {r.expert.user.lastName}</Link><p className="text-xs text-slate">{r.expert.headline} · profil {r.expert.completeness} %</p></Td><Td>{VERIFICATION_TYPE_LABELS[r.type]}</Td><Td>{r.submittedAt?.toLocaleDateString("fr-FR") ?? "—"}</Td><Td>{r._count.documents}</Td><Td>{r._count.checks}</Td><Td><StatusBadge status={r.status} label={VERIFICATION_STATUS_LABELS[r.status]} /></Td></tr>)}</TBody></Table></Card>
      )}
    </>
  );
}
