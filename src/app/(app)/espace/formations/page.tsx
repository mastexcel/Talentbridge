import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { myLearning } from "@/application/academy.service";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody } from "@/ui/Card";
import { Progress } from "@/ui/Stat";
import { Badge } from "@/ui/Badge";
import { EmptyState } from "@/ui/Feedback";
import { ButtonLink } from "@/ui/Button";

export const metadata: Metadata = { title: "Mes formations" };

export default async function MyLearning() {
  const user = await requireUser("/espace/formations");
  const items = await myLearning(user.id);
  return (
    <>
      <PageHeader title="Formations et certificats" actions={<ButtonLink href="/academy" variant="outline">Catalogue Academy</ButtonLink>} />
      {items.length === 0 ? <EmptyState title="Aucune formation" action={<ButtonLink href="/academy">Explorer les formations</ButtonLink>} /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((e) => (
            <Card key={e.id}><CardBody className="space-y-3">
              <div className="flex items-start justify-between gap-2"><Link href={`/academy/${e.course.slug}`} className="font-display font-bold hover:text-bordeaux-700">{e.course.title}</Link>{e.status === "PENDING_PAYMENT" ? <Badge tone="orange">Paiement en attente</Badge> : e.status === "COMPLETED" ? <Badge tone="olive">Terminée</Badge> : <Badge tone="blue">En cours</Badge>}</div>
              <Progress value={e.progressPct} /><p className="text-xs text-slate">{e.progressPct} % · {e.course.durationHours} h</p>
              {e.certificate ? <ButtonLink href={`/certificats/${e.certificate.code}`} size="sm" variant="success">Certificat {e.certificate.code}</ButtonLink> : e.status === "ACTIVE" && <ButtonLink href={`/academy/${e.course.slug}/suivre`} size="sm">Continuer</ButtonLink>}
            </CardBody></Card>
          ))}
        </div>
      )}
    </>
  );
}
