import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, FileSignature, GraduationCap, MessageSquare, Send, ShieldCheck, Wallet } from "lucide-react";
import { prisma } from "@/infrastructure/db";
import { requireExpertUser } from "@/lib/session";
import { getMyProfile } from "@/application/expert.service";
import { recommendedMissions } from "@/application/matching.service";
import { formatMoney } from "@/domain/money";
import { APPLICATION_STATUS_LABELS, VERIFICATION_STATUS_LABELS, VERIFICATION_TYPE_LABELS } from "@/domain/workflows";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { Progress, StatCard } from "@/ui/Stat";
import { StatusBadge } from "@/ui/Badge";
import { ButtonLink } from "@/ui/Button";
import { EmptyState } from "@/ui/Feedback";
import { ScorePill } from "@/ui/MatchBreakdown";
import { VerificationBadges } from "@/ui/cards";

export const metadata: Metadata = { title: "Espace consultant" };

export default async function ExpertDashboard() {
  const user = await requireExpertUser();
  const expertId = user.expertProfile.id;
  const [{ profile, completeness }, recos, apps, invitations, contracts, unreadMessages, enrollments] = await Promise.all([
    getMyProfile(expertId),
    recommendedMissions(expertId, 4),
    prisma.application.findMany({ where: { expertId }, orderBy: { updatedAt: "desc" }, take: 5, include: { mission: { select: { title: true, reference: true } } } }),
    prisma.missionInvitation.count({ where: { expertId, status: "SENT" } }),
    prisma.contract.findMany({ where: { expertId }, select: { status: true, amountMinor: true, currency: true } }),
    prisma.conversationParticipant.count({ where: { userId: user.id, conversation: { messages: { some: { senderId: { not: user.id } } } } } }),
    prisma.enrollment.count({ where: { userId: user.id, status: { in: ["ACTIVE", "COMPLETED"] } } }),
  ]);
  const earned = contracts.filter((c) => c.status === "COMPLETED").reduce((s, c) => s + c.amountMinor, 0);
  const active = contracts.filter((c) => ["SIGNED", "ACTIVE"].includes(c.status)).length;
  const lastVerif = profile.verifications[0];

  return (
    <>
      <PageHeader title={`Bonjour ${user.firstName}`} description="Votre activité sur Talent Bridge en un coup d'œil." actions={<ButtonLink href={`/experts/${profile.slug}`} variant="outline">Voir mon profil public</ButtonLink>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Candidatures" value={apps.length ? await prisma.application.count({ where: { expertId } }) : 0} icon={Send} hint={`${invitations} invitation(s) en attente`} />
        <StatCard label="Contrats actifs" value={active} icon={FileSignature} tone="orange" />
        <StatCard label="Revenus (contrats terminés)" value={formatMoney(earned, "XOF")} icon={Wallet} tone="olive" hint="Montants contractuels hors commissions" />
        <StatCard label="Formations suivies" value={enrollments} icon={GraduationCap} tone="ink" hint={`${unreadMessages} conversation(s)`} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Résumé du profil" />
          <CardBody className="space-y-4">
            <div>
              <div className="flex justify-between text-sm"><span className="font-semibold">Complétude</span><span>{completeness.score} %</span></div>
              <Progress value={completeness.score} className="mt-1" tone={completeness.score >= 60 ? "olive" : "orange"} />
              {completeness.missing.length > 0 && <p className="mt-2 text-xs text-slate">À compléter : {completeness.missing.slice(0, 4).map((m) => m.label).join(", ")}{completeness.missing.length > 4 ? "…" : ""}</p>}
            </div>
            <div className="flex flex-wrap gap-1.5"><VerificationBadges badges={profile.badges} /></div>
            <div className="rounded-xl bg-mist p-3 text-sm">
              <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-olive-700" />Vérification</p>
              {lastVerif ? <p className="mt-1">{VERIFICATION_TYPE_LABELS[lastVerif.type]} : <StatusBadge status={lastVerif.status} label={VERIFICATION_STATUS_LABELS[lastVerif.status]} /></p> : <p className="mt-1 text-slate">Aucune demande.</p>}
            </div>
            <ButtonLink href="/espace/profil" className="w-full">Compléter mon profil</ButtonLink>
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Missions recommandées" description="Calculées par le moteur de matching à partir de votre profil." action={<Link href="/espace/missions" className="text-sm font-semibold text-orange-700">Tout voir</Link>} />
          <CardBody className="space-y-3">
            {recos.length === 0 ? <EmptyState icon={Briefcase} title="Aucune recommandation pour l'instant" description="Ajoutez des compétences à votre profil pour recevoir des missions adaptées." /> : recos.map(({ mission, match }) => (
              <Link key={mission.id} href={`/missions/${mission.reference}`} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3 hover:bg-mist">
                <div className="min-w-0"><p className="truncate font-semibold">{mission.title}</p><p className="text-xs text-slate">{mission.organization.name} · {mission.countryCode}</p></div>
                <ScorePill score={match.score} eligible={match.eligible} />
              </Link>
            ))}
          </CardBody>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title="Mes dernières candidatures" action={<Link href="/espace/candidatures" className="text-sm font-semibold text-orange-700">Suivi complet</Link>} />
          <CardBody>
            {apps.length === 0 ? <p className="text-sm text-slate">Aucune candidature. <Link href="/missions" className="text-orange-700 underline">Parcourir les missions</Link></p> : (
              <ul className="divide-y divide-line">{apps.map((a) => <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm"><Link href={`/missions/${a.mission.reference}`} className="truncate hover:underline">{a.mission.title}</Link><StatusBadge status={a.status} label={APPLICATION_STATUS_LABELS[a.status]} /></li>)}</ul>
            )}
          </CardBody>
        </Card>
      </div>
      <p className="mt-6 flex items-center gap-2 text-sm text-slate"><MessageSquare className="h-4 w-4" /> Les organisations vous contactent via la <Link href="/messages" className="text-orange-700 underline">messagerie</Link> : vos coordonnées restent privées.</p>
    </>
  );
}
