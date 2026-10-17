import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, FileSignature, Inbox, KanbanSquare, Users } from "lucide-react";
import { prisma } from "@/infrastructure/db";
import { requireOrgUser } from "@/lib/session";
import { activeSubscriptions } from "@/application/billing.service";
import { MISSION_STATUS_LABELS } from "@/domain/workflows";
import { ORG_ROLE_LABELS } from "@/domain/permissions";
import { ORG_STATUS_LABELS } from "@/ui/labels";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { StatCard } from "@/ui/Stat";
import { StatusBadge } from "@/ui/Badge";
import { ButtonLink } from "@/ui/Button";
import { Alert, EmptyState } from "@/ui/Feedback";

export const metadata: Metadata = { title: "Espace organisation" };

export default async function OrgDashboard({ searchParams }: { searchParams: Promise<{ refus?: string }> }) {
  const sp = await searchParams;
  const { org, role } = await requireOrgUser();
  const [missions, appsToReview, contracts, projects, members, subs] = await Promise.all([
    prisma.mission.findMany({ where: { organizationId: org.id }, orderBy: { updatedAt: "desc" }, take: 6, include: { _count: { select: { applications: true } } } }),
    prisma.application.count({ where: { mission: { organizationId: org.id }, status: "SUBMITTED" } }),
    prisma.contract.count({ where: { organizationId: org.id, status: { in: ["SENT", "SIGNED", "ACTIVE"] } } }),
    prisma.project.count({ where: { organizationId: org.id, status: { in: ["PLANNING", "ACTIVE"] } } }),
    prisma.organizationMember.count({ where: { organizationId: org.id } }),
    activeSubscriptions({ userId: null, organizationId: org.id }),
  ]);
  return (
    <>
      <PageHeader title={org.name} description={`Votre rôle : ${ORG_ROLE_LABELS[role]} · Statut : ${ORG_STATUS_LABELS[org.status]}`} actions={<ButtonLink href="/organisation/missions/nouvelle">Publier une mission</ButtonLink>} />
      {sp.refus && <Alert tone="error" className="mb-4">Votre rôle ne permet pas d'accéder à cette page.</Alert>}
      {org.status === "PENDING" && <Alert tone="warning" title="Organisation en attente de validation" className="mb-4">Complétez la fiche (immatriculation, documents justificatifs) pour accélérer la validation. Vous pouvez déjà préparer et publier des missions. <Link href="/organisation/parametres" className="underline">Compléter la fiche</Link></Alert>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Missions ouvertes" value={missions.filter((m) => ["PUBLISHED", "SHORTLISTING", "INTERVIEWS", "SELECTION"].includes(m.status)).length} icon={Briefcase} />
        <StatCard label="Candidatures à examiner" value={appsToReview} icon={Inbox} tone="orange" />
        <StatCard label="Contrats en cours" value={contracts} icon={FileSignature} tone="olive" />
        <StatCard label="Projets actifs" value={projects} icon={KanbanSquare} tone="ink" />
        <StatCard label="Collaborateurs" value={members} icon={Users} hint={subs.length ? `Offre : ${subs.map((s) => s.plan.name).join(", ")}` : "Aucun abonnement actif"} />
      </div>
      <Card className="mt-6">
        <CardHeader title="Missions récentes" action={<Link href="/organisation/missions" className="text-sm font-semibold text-orange-700">Toutes les missions</Link>} />
        <CardBody>
          {missions.length === 0 ? <EmptyState title="Aucune mission" description="Publiez votre premier besoin pour recevoir des candidatures et des recommandations." action={<ButtonLink href="/organisation/missions/nouvelle">Publier une mission</ButtonLink>} /> : (
            <ul className="divide-y divide-line">{missions.map((m) => <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><Link href={`/organisation/missions/${m.id}`} className="font-semibold hover:text-bordeaux-700">{m.title}</Link><span className="flex items-center gap-3 text-sm text-slate">{m._count.applications} candidature(s) <StatusBadge status={m.status} label={MISSION_STATUS_LABELS[m.status]} /></span></li>)}</ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}
