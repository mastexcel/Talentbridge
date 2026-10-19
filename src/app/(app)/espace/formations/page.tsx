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
import { KindBadge, fmtDay, sessionPlace } from "@/ui/academy";

export const metadata: Metadata = { title: "Mes formations" };

export default async function MyLearning() {
  const user = await requireUser("/espace/formations");
  const items = await myLearning(user.id);
  return (
    <>
      <PageHeader title="Mes formations et certificats" description="Formations, séminaires et sessions auxquels vous êtes inscrit(e)." actions={<ButtonLink href="/academy" variant="outline">Catalogue de l'Academy</ButtonLink>} />
      {items.length === 0 ? <EmptyState title="Aucune inscription pour le moment" description="Parcourez le catalogue : formations en ligne, classes virtuelles, présentiel et séminaires." action={<ButtonLink href="/academy">Explorer l'Academy</ButtonLink>} /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((e) => (
            <Card key={e.id}><CardBody className="space-y-3">
              <div className="flex items-start justify-between gap-2"><Link href={`/academy/${e.course.slug}`} className="font-display font-bold hover:text-bordeaux-700">{e.course.title}</Link>{e.status === "PENDING_PAYMENT" ? <Badge tone="orange">Paiement en attente</Badge> : e.status === "COMPLETED" ? <Badge tone="olive">Terminée</Badge> : <Badge tone="blue">En cours</Badge>}</div>
              <KindBadge kind={e.course.kind} />
              {e.session && <p className="text-sm text-slate first-letter:uppercase">{fmtDay(e.session.startsAt)} · {sessionPlace({ ...e.session, countryName: e.session.country?.nameFr ?? null })}{e.attendedAt ? " · présence confirmée" : ""}</p>}
              <Progress value={e.progressPct} /><p className="text-xs text-slate">{e.progressPct} % · {e.course.durationHours} h</p>
              {e.certificate ? <ButtonLink href={`/certificats/${e.certificate.code}`} size="sm" variant="success">Certificat {e.certificate.code}</ButtonLink> : e.status === "ACTIVE" && <ButtonLink href={`/academy/${e.course.slug}/suivre`} size="sm">Continuer</ButtonLink>}
            </CardBody></Card>
          ))}
        </div>
      )}
    </>
  );
}
