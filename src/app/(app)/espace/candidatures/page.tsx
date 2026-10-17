import type { Metadata } from "next";
import Link from "next/link";
import { requireExpertUser } from "@/lib/session";
import { myApplications, myInvitations } from "@/application/mission.service";
import { APPLICATION_STATUS_LABELS, MISSION_STATUS_LABELS } from "@/domain/workflows";
import { applicationFlow } from "@/domain/workflows";
import { formatMoney } from "@/domain/money";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { StatusBadge } from "@/ui/Badge";
import { ActionButton } from "@/ui/ActionButton";
import { EmptyState } from "@/ui/Feedback";
import { ButtonLink } from "@/ui/Button";

export const metadata: Metadata = { title: "Mes candidatures" };

export default async function ApplicationsPage() {
  const user = await requireExpertUser("/espace/candidatures");
  const [apps, invitations] = await Promise.all([myApplications(user.expertProfile.id), myInvitations(user.expertProfile.id)]);
  const pending = invitations.filter((i) => i.status === "SENT");
  return (
    <>
      <PageHeader title="Candidatures et invitations" />
      {pending.length > 0 && (
        <Card className="mb-6">
          <CardHeader title={`Invitations reçues (${pending.length})`} />
          <CardBody className="space-y-3">
            {pending.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3">
                <div><Link href={`/missions/${i.mission.reference}`} className="font-semibold hover:underline">{i.mission.title}</Link><p className="text-xs text-slate">{i.mission.organization.name}{i.message ? ` — « ${i.message} »` : ""}</p></div>
                <div className="flex gap-2"><ButtonLink href={`/missions/${i.mission.reference}#candidater`} size="sm">Candidater</ButtonLink><ActionButton action={`/api/v1/invitations/${i.id}/respond`} body={{ accept: false }} successMessage="Invitation déclinée.">Décliner</ActionButton></div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
      {apps.length === 0 ? <EmptyState title="Aucune candidature" action={<ButtonLink href="/missions">Parcourir les missions</ButtonLink>} /> : (
        <div className="space-y-4">
          {apps.map((a) => (
            <Card key={a.id}>
              <CardHeader title={<Link href={`/missions/${a.mission.reference}`} className="hover:text-bordeaux-700">{a.mission.title}</Link>} description={`${a.mission.organization.name} · mission ${MISSION_STATUS_LABELS[a.mission.status].toLowerCase()}`} action={<StatusBadge status={a.status} label={APPLICATION_STATUS_LABELS[a.status]} />} />
              <CardBody className="grid gap-4 text-sm md:grid-cols-[1fr_260px]">
                <div>
                  <ol className="flex flex-wrap gap-2 text-xs">{a.events.length === 0 ? <li className="rounded-full bg-mist px-3 py-1">Reçue le {a.createdAt.toLocaleDateString("fr-FR")}</li> : [<li key="s" className="rounded-full bg-mist px-3 py-1">Reçue le {a.createdAt.toLocaleDateString("fr-FR")}</li>, ...a.events.map((e) => <li key={e.id} className="rounded-full bg-mist px-3 py-1">{APPLICATION_STATUS_LABELS[e.toStatus]} le {e.createdAt.toLocaleDateString("fr-FR")}</li>)]}</ol>
                  {a.interviews.map((i) => <p key={i.id} className="mt-3 rounded-xl bg-sky-50 p-2 text-sky-900">Entretien {i.mode === "VISIO" ? "en visio" : i.mode === "PHONE" ? "téléphonique" : "sur site"} le {i.scheduledAt.toLocaleString("fr-FR")} ({i.durationMin} min){i.location ? ` — ${i.location}` : ""}</p>)}
                </div>
                <div className="space-y-2 text-xs text-slate">
                  {a.proposedRateMinor && a.currency && <p>Tarif proposé : <strong className="text-ink">{formatMoney(a.proposedRateMinor, a.currency)}/j</strong></p>}
                  {a.technicalFileId && <a className="block underline" href={`/api/v1/files/${a.technicalFileId}`}>Proposition technique</a>}
                  {a.financialFileId && <a className="block underline" href={`/api/v1/files/${a.financialFileId}`}>Proposition financière</a>}
                  {applicationFlow.can(a.status, "WITHDRAWN") && <ActionButton action={`/api/v1/applications/${a.id}/withdraw`} confirm="Retirer définitivement cette candidature ?" variant="ghost" successMessage="Candidature retirée.">Retirer ma candidature</ActionButton>}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
