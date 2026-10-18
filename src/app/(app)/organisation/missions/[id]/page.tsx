import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/infrastructure/db";
import { requireOrgUser } from "@/lib/session";
import { getOrgMission, listApplications } from "@/application/mission.service";
import { getMatches } from "@/application/matching.service";
import { formatMoney, fromMinor } from "@/domain/money";
import { APPLICATION_STATUS_LABELS, MISSION_STATUS_LABELS, applicationFlow, missionFlow } from "@/domain/workflows";
import { orgRoleCan } from "@/domain/permissions";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { Badge, DemoBadge, StatusBadge } from "@/ui/Badge";
import { ActionButton } from "@/ui/ActionButton";
import { ApiForm } from "@/ui/ApiForm";
import { ButtonLink } from "@/ui/Button";
import { Field, Input, Select, Textarea } from "@/ui/Field";
import { Alert, EmptyState } from "@/ui/Feedback";
import { MatchBreakdown, ScorePill } from "@/ui/MatchBreakdown";
import { TeamBuilder } from "@/ui/TeamBuilder";
import { VerificationBadges } from "@/ui/cards";

export const metadata: Metadata = { title: "Pilotage de la mission" };

const TABS = [["candidatures", "Candidatures"], ["matching", "Matching"], ["equipe", "Équipe"], ["historique", "Historique"]] as const;
const ACTION_LABELS: Record<string, string> = { PUBLISHED: "Publier", SHORTLISTING: "Passer en présélection", INTERVIEWS: "Passer aux entretiens", SELECTION: "Passer à la sélection", CONTRACTING: "Contractualisation", IN_PROGRESS: "Démarrer l'exécution", CLOSED: "Clôturer", CANCELLED: "Annuler la mission", DRAFT: "Repasser en brouillon" };

type Breakdown = { criteria: { criterion: string; weight: number; value: number; points: number; explanation: string }[]; eligible: boolean; exclusionReasons: string[]; overBudget: boolean };

export default async function OrgMissionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ onglet?: string }> }) {
  const { id } = await params;
  const { onglet = "candidatures" } = await searchParams;
  const { user, role } = await requireOrgUser("org.view");
  const m = await getOrgMission(user, id);
  const canManage = orgRoleCan(role, "missions.manage");
  const canReview = orgRoleCan(role, "applications.review");
  const canSearch = orgRoleCan(role, "experts.search");
  const canContract = orgRoleCan(role, "contracts.manage");
  const [apps, matches, skills] = await Promise.all([
    canReview ? listApplications(user, id) : Promise.resolve([]),
    canSearch && onglet === "matching" ? getMatches(user, id) : Promise.resolve([]),
    onglet === "equipe" ? prisma.skill.findMany({ where: { isActive: true }, orderBy: { nameFr: "asc" }, select: { id: true, nameFr: true } }) : Promise.resolve([]),
  ]);
  const contracts = await prisma.contract.findMany({ where: { missionId: id }, select: { applicationId: true, reference: true } });
  const contractByApp = new Map(contracts.map((c) => [c.applicationId, c.reference]));

  return (
    <>
      <PageHeader
        back={{ href: "/organisation/missions", label: "Missions" }}
        title={<span className="flex flex-wrap items-center gap-2">{m.title} <DemoBadge show={m.isDemo} /></span>}
        description={<span className="flex flex-wrap items-center gap-2">Réf. {m.reference} · <StatusBadge status={m.status} label={MISSION_STATUS_LABELS[m.status]} /> · {m._count.applications} candidature(s)</span>}
        actions={<>
          {m.status !== "DRAFT" && <ButtonLink href={`/missions/${m.reference}`} variant="outline" size="sm">Voir la page publique</ButtonLink>}
          {canManage && ["DRAFT", "PUBLISHED"].includes(m.status) && <ButtonLink href={`/organisation/missions/${m.id}/modifier`} variant="outline" size="sm">Modifier</ButtonLink>}
        </>}
      />
      {canManage && missionFlow.next(m.status).length > 0 && (
        <Card className="mb-6"><CardBody className="flex flex-wrap items-center gap-2">
          <span className="mr-2 text-sm font-semibold">Faire avancer le processus :</span>
          {missionFlow.next(m.status).map((s) => (
            <ActionButton key={s} action={`/api/v1/missions/${m.id}/status`} body={{ status: s }} variant={s === "CANCELLED" ? "danger" : s === "PUBLISHED" ? "primary" : "outline"} confirm={s === "CANCELLED" ? "Annuler cette mission ? Les candidats seront notifiés." : s === "CLOSED" ? "Clôturer définitivement la mission ?" : undefined} successMessage={`Mission : ${MISSION_STATUS_LABELS[s]}.`}>
              {ACTION_LABELS[s] ?? s}
            </ActionButton>
          ))}
        </CardBody></Card>
      )}
      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-line" aria-label="Onglets de la mission">
        {TABS.map(([k, l]) => <Link key={k} href={`?onglet=${k}`} aria-current={onglet === k ? "page" : undefined} className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold ${onglet === k ? "border-orange-600 text-bordeaux-700" : "border-transparent text-slate hover:text-ink"}`}>{l}</Link>)}
      </nav>

      {onglet === "candidatures" && (!canReview ? <Alert tone="info">Votre rôle ne permet pas d'examiner les candidatures.</Alert> : apps.length === 0 ? <EmptyState title="Aucune candidature pour l'instant" description="Lancez le matching pour identifier et inviter des experts." action={<ButtonLink href="?onglet=matching">Lancer le matching</ButtonLink>} /> : (
        <div className="space-y-4">
          {apps.map((a) => (
            <Card key={a.id}>
              <CardHeader
                title={<Link href={`/experts/${a.expert.slug}`} className="hover:text-bordeaux-700">{a.expert.user.firstName} {a.expert.user.lastName}</Link>}
                description={`${a.expert.headline ?? ""} · ${a.expert.countryCode ?? ""} · ${a.expert.yearsExperience} ans`}
                action={<StatusBadge status={a.status} label={APPLICATION_STATUS_LABELS[a.status]} />}
              />
              <CardBody className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <div className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-1.5"><VerificationBadges badges={a.expert.badges} /></div>
                  <p className="whitespace-pre-line">{a.coverLetter}</p>
                  <div className="flex flex-wrap gap-4 text-xs">
                    {a.proposedRateMinor && a.currency && <span>Tarif proposé : <strong>{formatMoney(a.proposedRateMinor, a.currency)}/j</strong></span>}
                    {a.availableFrom && <span>Disponible le {a.availableFrom.toLocaleDateString("fr-FR")}</span>}
                    {a.technicalFileId && <a href={`/api/v1/files/${a.technicalFileId}`} className="text-orange-700 underline">Proposition technique</a>}
                    {a.financialFileId && <a href={`/api/v1/files/${a.financialFileId}`} className="text-orange-700 underline">Proposition financière</a>}
                    {a.expert.cvFileId && <a href={`/api/v1/files/${a.expert.cvFileId}`} className="text-orange-700 underline">CV</a>}
                  </div>
                  {a.interviews.map((i) => <p key={i.id} className="rounded-xl bg-sky-50 p-2 text-xs text-sky-900">Entretien le {i.scheduledAt.toLocaleString("fr-FR")} ({i.mode}){i.notes ? ` — ${i.notes}` : ""}</p>)}
                  {a.recruiterNote && <p className="rounded-xl bg-mist p-2 text-xs">Note interne : {a.recruiterNote}</p>}
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {(["SHORTLISTED", "INTERVIEW", "SELECTED", "REJECTED"] as const).filter((s) => applicationFlow.can(a.status, s)).map((s) => (
                      <ActionButton key={s} action={`/api/v1/applications/${a.id}/decide`} body={{ status: s }} variant={s === "SELECTED" ? "success" : s === "REJECTED" ? "danger" : "outline"} prompt={s === "REJECTED" || s === "SELECTED" ? { key: "note", label: "Note interne (facultative)" } : undefined} successMessage={`Candidature : ${APPLICATION_STATUS_LABELS[s]}.`}>
                        {s === "SHORTLISTED" ? "Présélectionner" : s === "INTERVIEW" ? "Entretien" : s === "SELECTED" ? "Retenir" : "Écarter"}
                      </ActionButton>
                    ))}
                    <ButtonLink href={`/messages/nouveau?expert=${a.expert.id}&sujet=${encodeURIComponent(m.title)}`} size="sm" variant="ghost">Message</ButtonLink>
                  </div>
                  {["SHORTLISTED", "INTERVIEW"].includes(a.status) && (
                    <details className="rounded-xl border border-line p-3"><summary className="cursor-pointer text-sm font-semibold">Planifier un entretien</summary>
                      <ApiForm action={`/api/v1/applications/${a.id}/interview`} submitLabel="Planifier" successMessage="Entretien planifié, le candidat est notifié." className="mt-2 space-y-2">
                        <Field label="Date et heure" htmlFor={`i-at-${a.id}`} required><Input id={`i-at-${a.id}`} name="scheduledAt" type="datetime-local" /></Field>
                        <Field label="Mode" htmlFor={`i-mode-${a.id}`}><Select id={`i-mode-${a.id}`} name="mode"><option value="VISIO">Visio</option><option value="PHONE">Téléphone</option><option value="ONSITE">Sur site</option></Select></Field>
                        <Field label="Durée (min)" htmlFor={`i-d-${a.id}`}><Input id={`i-d-${a.id}`} name="durationMin" type="number" defaultValue={45} data-type="number" /></Field>
                        <Field label="Lieu ou lien" htmlFor={`i-l-${a.id}`}><Input id={`i-l-${a.id}`} name="location" /></Field>
                      </ApiForm>
                    </details>
                  )}
                  {a.status === "SELECTED" && canContract && !contractByApp.has(a.id) && (
                    <details open className="rounded-xl border border-olive-200 bg-olive-50 p-3"><summary className="cursor-pointer text-sm font-semibold text-olive-800">Établir le contrat</summary>
                      <ApiForm action={`/api/v1/applications/${a.id}/contract`} submitLabel="Créer le contrat" successMessage="Contrat créé (brouillon)." className="mt-2 space-y-2">
                        <Field label={`Montant total (${m.currency})`} htmlFor={`c-amt-${a.id}`} required><Input id={`c-amt-${a.id}`} name="amount" type="number" min={1} data-type="number" defaultValue={a.proposedRateMinor && m.durationDays ? fromMinor(a.proposedRateMinor * m.durationDays, m.currency) : undefined} /></Field>
                        <div className="grid grid-cols-2 gap-2"><Field label="Début" htmlFor={`c-s-${a.id}`}><Input id={`c-s-${a.id}`} name="startDate" type="date" /></Field><Field label="Fin" htmlFor={`c-e-${a.id}`}><Input id={`c-e-${a.id}`} name="endDate" type="date" /></Field></div>
                        <Field label="Conditions particulières" htmlFor={`c-t-${a.id}`}><Textarea id={`c-t-${a.id}`} name="terms" /></Field>
                      </ApiForm>
                    </details>
                  )}
                  {contractByApp.has(a.id) && <p className="text-sm">Contrat <Link href="/organisation/contrats" className="font-mono text-orange-700 underline">{contractByApp.get(a.id)}</Link></p>}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      ))}

      {onglet === "matching" && (!canSearch ? <Alert tone="info">Votre rôle ne permet pas d'utiliser le matching.</Alert> : (
        <div className="space-y-4">
          <Card><CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm"><p className="font-semibold">Recommandations d'experts</p><p className="text-slate">Moteur déterministe (v1) : score expliqué critère par critère, coefficients configurés par l'administrateur. Chaque proposition doit être validée par un humain.</p></div>
            <ActionButton action={`/api/v1/missions/${m.id}/run-matching`} variant="primary" size="md" successMessage="Recommandations calculées.">{matches.length ? "Recalculer" : "Lancer le matching"}</ActionButton>
          </CardBody></Card>
          {matches.length === 0 ? <EmptyState title="Aucune recommandation calculée" /> : matches.map((x) => {
            const b = x.breakdown as unknown as Breakdown;
            return (
              <Card key={x.id}>
                <CardHeader
                  title={<span className="flex items-center gap-2"><Link href={`/experts/${x.expert.slug}`} className="hover:text-bordeaux-700">{x.expert.user.firstName} {x.expert.user.lastName}</Link><DemoBadge show={x.expert.isDemo} /></span>}
                  description={`${x.expert.headline ?? ""} · ${x.expert.city ?? ""} ${x.expert.countryCode ?? ""}${x.expert.dailyRateMinor && x.expert.rateCurrency ? ` · ${formatMoney(x.expert.dailyRateMinor, x.expert.rateCurrency)}/j` : ""}`}
                  action={<div className="flex items-center gap-2">{x.decision !== "SUGGESTED" && <Badge tone={x.decision === "ACCEPTED" ? "olive" : "neutral"}>{x.decision === "ACCEPTED" ? "Retenu (shortlist)" : "Écarté"}</Badge>}<ScorePill score={x.score} eligible={b.eligible} /></div>}
                />
                <CardBody className="grid gap-4 md:grid-cols-[1fr_220px]">
                  <MatchBreakdown breakdown={b.criteria} exclusionReasons={b.exclusionReasons} missingSkills={x.missingSkills} overBudget={b.overBudget} />
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-1.5"><VerificationBadges badges={x.expert.badges} /></div>
                    {x.decision !== "ACCEPTED" && <ActionButton action={`/api/v1/matches/${x.id}/decide`} body={{ decision: "ACCEPTED" }} variant="success" successMessage="Ajouté à la shortlist de la mission.">Retenir</ActionButton>}
                    {x.decision !== "DISMISSED" && <ActionButton action={`/api/v1/matches/${x.id}/decide`} body={{ decision: "DISMISSED" }} successMessage="Recommandation écartée.">Écarter</ActionButton>}
                    {canManage && <ActionButton action={`/api/v1/missions/${m.id}/invite`} body={{ expertId: x.expertId }} prompt={{ key: "message", label: "Message d'invitation (facultatif)" }} successMessage="Invitation envoyée.">Inviter à candidater</ActionButton>}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      ))}

      {onglet === "equipe" && (
        <Card><CardHeader title="Constituer une équipe pluridisciplinaire" description="Rôles, compétences complémentaires, jours, budget, disponibilités et calendriers des experts." /><CardBody>{canSearch ? <TeamBuilder missionId={m.id} skills={skills} /> : <Alert tone="info">Réservé aux rôles autorisés à rechercher des experts.</Alert>}</CardBody></Card>
      )}

      {onglet === "historique" && (
        <Card><CardHeader title="Historique du processus" /><CardBody>
          {m.events.length === 0 ? <p className="text-sm text-slate">Aucun événement.</p> : <ol className="space-y-2 border-l-2 border-orange-200 pl-4 text-sm">{m.events.map((e) => <li key={e.id}><span className="text-xs text-slate">{e.createdAt.toLocaleString("fr-FR")}</span> — {MISSION_STATUS_LABELS[e.fromStatus]} → <strong>{MISSION_STATUS_LABELS[e.toStatus]}</strong>{e.note ? ` (${e.note})` : ""}</li>)}</ol>}
        </CardBody></Card>
      )}
    </>
  );
}
