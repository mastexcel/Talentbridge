import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, Calendar, Clock, FileText, Languages, MapPin, Wallet } from "lucide-react";
import { getPublicMission } from "@/application/mission.service";
import { currentUser } from "@/lib/session";
import { formatMoney } from "@/domain/money";
import { APPLICATION_STATUS_LABELS, MISSION_STATUS_LABELS, MISSION_OPEN_STATUSES } from "@/domain/workflows";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { Badge, DemoBadge, StatusBadge } from "@/ui/Badge";
import { ButtonLink } from "@/ui/Button";
import { ActionButton } from "@/ui/ActionButton";
import { Alert } from "@/ui/Feedback";
import { RichText } from "@/ui/Page";
import { ApplyForm } from "@/ui/ApplyForm";
import { WORK_MODE_LABELS } from "@/ui/cards";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mission" };

export default async function MissionDetail({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const user = await currentUser();
  const data = await getPublicMission(user, reference);
  if (!data) notFound();
  const { mission: m, application, saved, isOwner, invited } = data;
  const open = (MISSION_OPEN_STATUSES as readonly string[]).includes(m.status) && (!m.applicationDeadline || m.applicationDeadline > new Date());
  const budget = m.budgetMinMinor || m.budgetMaxMinor ? `${m.budgetMinMinor ? formatMoney(m.budgetMinMinor, m.currency) : ""}${m.budgetMinMinor && m.budgetMaxMinor ? " – " : ""}${m.budgetMaxMinor ? formatMoney(m.budgetMaxMinor, m.currency) : ""}` : "Non communiqué";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="orange">{m.domain?.nameFr ?? "Mission"}</Badge>
          <StatusBadge status={m.status} label={MISSION_STATUS_LABELS[m.status]} />
          <DemoBadge show={m.isDemo} />
          {invited && <Badge tone="olive">Vous êtes invité(e)</Badge>}
        </div>
        <h1 className="mt-3 text-3xl font-extrabold">{m.title}</h1>
        <p className="mt-1 text-slate">{m.organization.name} {m.organization.status === "VERIFIED" && <BadgeCheck className="inline h-4 w-4 text-olive-700" aria-label="Organisation vérifiée" />} · Réf. {m.reference}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card><CardHeader title="Description" /><CardBody><RichText text={m.description} /></CardBody></Card>
          {m.objectives && <Card><CardHeader title="Objectifs" /><CardBody><RichText text={m.objectives} /></CardBody></Card>}
          {m.expectedResults && <Card><CardHeader title="Résultats attendus" /><CardBody><RichText text={m.expectedResults} /></CardBody></Card>}
          <Card>
            <CardHeader title="Compétences requises" />
            <CardBody className="flex flex-wrap gap-2">
              {m.requirements.map((r) => <Badge key={r.id} tone={r.mandatory ? "bordeaux" : "neutral"}>{r.skill.nameFr}{r.mandatory ? " · obligatoire" : ""} (niv. {r.minLevel}+)</Badge>)}
            </CardBody>
          </Card>
          {m.attachments.length > 0 && user && (
            <Card><CardHeader title="Documents joints" /><CardBody className="space-y-2">{m.attachments.map((a) => <a key={a.id} href={`/api/v1/files/${a.fileId}`} className="flex items-center gap-2 text-sm text-orange-700 hover:underline"><FileText className="h-4 w-4" />{a.label ?? "Document"}</a>)}</CardBody></Card>
          )}
          {open && user?.expertProfile && !application && !isOwner && (
            <Card id="candidater"><CardHeader title="Déposer ma candidature" /><CardBody><ApplyForm missionId={m.id} currency={m.currency} /></CardBody></Card>
          )}
        </div>
        <aside className="space-y-4">
          <Card>
            <CardBody className="space-y-3 text-sm">
              <p className="flex gap-2"><MapPin className="h-4 w-4 text-bordeaux-700" />{m.city ? `${m.city}, ` : ""}{m.countryCode} · {WORK_MODE_LABELS[m.workMode]}</p>
              <p className="flex gap-2"><Clock className="h-4 w-4 text-bordeaux-700" />{m.durationDays ? `${m.durationDays} jours` : "Durée à préciser"}</p>
              <p className="flex gap-2"><Calendar className="h-4 w-4 text-bordeaux-700" />Démarrage : {m.startDate ? m.startDate.toLocaleDateString("fr-FR") : "à convenir"}</p>
              <p className="flex gap-2"><Wallet className="h-4 w-4 text-bordeaux-700" />Budget indicatif : {budget}</p>
              <p className="flex gap-2"><Languages className="h-4 w-4 text-bordeaux-700" />Langues : {m.languages.join(", ").toUpperCase()}</p>
              <p>Expérience minimale : <strong>{m.experienceYearsMin} ans</strong></p>
              {m.applicationDeadline && <p>Date limite : <strong>{m.applicationDeadline.toLocaleDateString("fr-FR")}</strong></p>}
            </CardBody>
          </Card>
          {isOwner ? (
            <ButtonLink href={`/organisation/missions/${m.id}`} className="w-full">Gérer cette mission</ButtonLink>
          ) : !user ? (
            <ButtonLink href={`/connexion?suite=/missions/${m.reference}`} className="w-full">Se connecter pour candidater</ButtonLink>
          ) : application ? (
            <Alert tone="success" title="Candidature déposée">Statut : {APPLICATION_STATUS_LABELS[application.status]}. <a href="/espace/candidatures" className="underline">Suivre mes candidatures</a></Alert>
          ) : !user.expertProfile ? (
            <Alert tone="info">Seuls les comptes consultants peuvent candidater.</Alert>
          ) : !open ? (
            <Alert tone="warning">Les candidatures sont closes pour cette mission.</Alert>
          ) : (
            <ButtonLink href="#candidater" className="w-full">Candidater</ButtonLink>
          )}
          {user && !isOwner && (
            <ActionButton action="/api/v1/me/save-mission" body={{ missionId: m.id }} successMessage={saved ? "Retirée des opportunités enregistrées." : "Opportunité enregistrée."} className="w-full">
              {saved ? "Retirer des opportunités enregistrées" : "Enregistrer cette opportunité"}
            </ActionButton>
          )}
        </aside>
      </div>
    </div>
  );
}
