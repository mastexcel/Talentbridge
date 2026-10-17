import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/infrastructure/db";
import { requireExpertUser } from "@/lib/session";
import { recommendedMissions } from "@/application/matching.service";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { EmptyState } from "@/ui/Feedback";
import { MatchBreakdown, ScorePill } from "@/ui/MatchBreakdown";
import { MissionCard } from "@/ui/cards";
import { ButtonLink } from "@/ui/Button";

export const metadata: Metadata = { title: "Missions recommandées" };

export default async function RecommendedPage() {
  const user = await requireExpertUser("/espace/missions");
  const [recos, saved] = await Promise.all([
    recommendedMissions(user.expertProfile.id, 12),
    prisma.savedMission.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { mission: { include: { organization: { select: { name: true, status: true } }, domain: { select: { nameFr: true } } } } } }),
  ]);
  return (
    <>
      <PageHeader title="Missions recommandées" description="Score explicable calculé à partir de votre profil déclaré et vérifié. Aucune donnée n'est inventée." actions={<ButtonLink href="/missions" variant="outline">Rechercher des missions</ButtonLink>} />
      {recos.length === 0 ? <EmptyState title="Aucune recommandation" description="Ajoutez des compétences du référentiel à votre profil." action={<ButtonLink href="/espace/profil">Compléter mon profil</ButtonLink>} /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {recos.map(({ mission, match }) => (
            <Card key={mission.id}>
              <CardHeader title={<Link href={`/missions/${mission.reference}`} className="hover:text-bordeaux-700">{mission.title}</Link>} description={`${mission.organization.name} · ${mission.countryCode}`} action={<ScorePill score={match.score} eligible={match.eligible} />} />
              <CardBody><MatchBreakdown breakdown={match.breakdown} exclusionReasons={match.exclusionReasons} missingSkills={match.missingSkills} overBudget={match.overBudget} /><ButtonLink href={`/missions/${mission.reference}#candidater`} size="sm" className="mt-4">Voir et candidater</ButtonLink></CardBody>
            </Card>
          ))}
        </div>
      )}
      <h2 className="mb-4 mt-10 text-xl font-extrabold">Opportunités enregistrées</h2>
      {saved.length === 0 ? <p className="text-sm text-slate">Aucune opportunité enregistrée.</p> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{saved.map((s) => <MissionCard key={s.missionId} m={s.mission} />)}</div>}
    </>
  );
}
