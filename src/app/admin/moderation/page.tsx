import type { Metadata } from "next";
import { prisma } from "@/infrastructure/db";
import { requireAdminUser } from "@/lib/session";
import { moderationQueue } from "@/application/community.service";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody } from "@/ui/Card";
import { ActionButton } from "@/ui/ActionButton";
import { Badge } from "@/ui/Badge";
import { EmptyState } from "@/ui/Feedback";

export const metadata: Metadata = { title: "Modération" };

export default async function ModerationPage() {
  const admin = await requireAdminUser("COMMUNITY_MODERATE");
  const reports = await moderationQueue(admin);
  const postIds = reports.filter((r) => r.targetType === "POST").map((r) => r.targetId);
  const posts = new Map((await prisma.communityPost.findMany({ where: { id: { in: postIds } }, select: { id: true, body: true, status: true } })).map((p) => [p.id, p]));
  return (
    <>
      <PageHeader title="Modération" description={`Une publication signalée par 3 personnes distinctes est masquée automatiquement en attendant votre décision.`} />
      {reports.length === 0 ? <EmptyState title="Aucun signalement ouvert" /> : (
        <div className="space-y-3">{reports.map((r) => (
          <Card key={r.id}><CardBody className="grid gap-3 text-sm md:grid-cols-[1fr_auto]">
            <div><p><Badge tone="red">{r.targetType}</Badge> signalé par {r.reporter.firstName} {r.reporter.lastName} le {r.createdAt.toLocaleDateString("fr-FR")}</p><p className="mt-1"><strong>Motif :</strong> {r.reason}</p>{posts.get(r.targetId) && <blockquote className="mt-2 rounded-xl bg-mist p-3">{posts.get(r.targetId)!.body} <Badge className="ml-2">{posts.get(r.targetId)!.status}</Badge></blockquote>}</div>
            <div className="flex flex-col gap-1">
              {["POST", "COMMENT"].includes(r.targetType) && <ActionButton action="/api/v1/admin/report-resolve" body={{ reportId: r.id, action: "REMOVE" }} variant="danger" prompt={{ key: "note", label: "Motif du retrait" }} successMessage="Contenu retiré.">Retirer le contenu</ActionButton>}
              {["POST", "COMMENT"].includes(r.targetType) && <ActionButton action="/api/v1/admin/report-resolve" body={{ reportId: r.id, action: "RESTORE" }} successMessage="Contenu rétabli.">Rétablir</ActionButton>}
              <ActionButton action="/api/v1/admin/report-resolve" body={{ reportId: r.id, action: "DISMISS" }} variant="ghost" successMessage="Signalement classé.">Classer sans suite</ActionButton>
            </div>
          </CardBody></Card>
        ))}</div>
      )}
    </>
  );
}
