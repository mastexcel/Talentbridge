import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/infrastructure/db";
import { requireUser } from "@/lib/session";
import { hasAdminPermission } from "@/domain/permissions";
import { PageHeader } from "@/ui/Page";
import { StatCard } from "@/ui/Stat";
import { Alert } from "@/ui/Feedback";
import { Card, CardBody, CardHeader } from "@/ui/Card";

export const metadata: Metadata = { title: "Administration" };

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ refus?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser("/admin");
  const [users, pendingVerif, pendingOrgs, reports, pendingRefunds, transfers, contacts, lastAudit] = await Promise.all([
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.verificationRequest.count({ where: { status: { in: ["PENDING", "IN_REVIEW"] } } }),
    prisma.organization.count({ where: { status: "PENDING" } }),
    prisma.contentReport.count({ where: { status: "OPEN" } }),
    prisma.refund.count({ where: { status: "REQUESTED" } }),
    prisma.payment.count({ where: { method: "BANK_TRANSFER", status: "PENDING" } }),
    prisma.contactRequest.count({ where: { status: "NEW" } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { actor: { select: { email: true } } } }),
  ]);
  const can = (p: Parameters<typeof hasAdminPermission>[1]) => hasAdminPermission(user, p);
  const alerts = [
    can("EXPERTS_VERIFY") && pendingVerif > 0 && [`${pendingVerif} demande(s) de vérification à traiter`, "/admin/verifications"],
    can("ORGS_VALIDATE") && pendingOrgs > 0 && [`${pendingOrgs} organisation(s) en attente de validation`, "/admin/organisations?status=PENDING"],
    can("COMMUNITY_MODERATE") && reports > 0 && [`${reports} signalement(s) ouvert(s)`, "/admin/moderation"],
    can("FINANCE_MANAGE") && pendingRefunds > 0 && [`${pendingRefunds} demande(s) de remboursement`, "/admin/factures"],
    can("FINANCE_MANAGE") && transfers > 0 && [`${transfers} virement(s) à rapprocher`, "/admin/factures"],
    can("CONTENT_MANAGE") && contacts > 0 && [`${contacts} demande(s) de contact`, "/admin/contacts"],
  ].filter(Boolean) as [string, string][];
  return (
    <>
      <PageHeader title="Administration centrale" description={`Connecté en tant que ${user.email} · permissions : ${user.adminPermissions.join(", ")}`} />
      {sp.refus && <Alert tone="error" className="mb-4">Permission insuffisante pour cette section.</Alert>}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Utilisateurs actifs" value={users} />
        <StatCard label="Vérifications en file" value={pendingVerif} tone="orange" />
        <StatCard label="Organisations à valider" value={pendingOrgs} tone="olive" />
        <StatCard label="Signalements ouverts" value={reports} tone="ink" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="À traiter" /><CardBody className="space-y-2">{alerts.length === 0 ? <p className="text-sm text-slate">Rien en attente dans votre périmètre.</p> : alerts.map(([t, h]) => <Link key={h} href={h} className="block rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm font-semibold text-orange-900 hover:bg-orange-100">{t} →</Link>)}</CardBody></Card>
        {can("AUDIT_VIEW") && <Card><CardHeader title="Dernières actions journalisées" action={<Link href="/admin/audit" className="text-sm text-orange-700">Journal complet</Link>} /><CardBody className="space-y-1 text-xs">{lastAudit.map((a) => <p key={a.id}><span className="text-slate">{a.createdAt.toLocaleString("fr-FR")}</span> — <strong>{a.action}</strong> {a.entityType} {a.actor ? `par ${a.actor.email}` : "(système)"}</p>)}</CardBody></Card>}
      </div>
    </>
  );
}
