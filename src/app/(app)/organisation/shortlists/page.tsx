import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgUser } from "@/lib/session";
import { listShortlists } from "@/application/mission.service";
import { listFavorites } from "@/application/expert.service";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { ActionButton } from "@/ui/ActionButton";
import { ButtonLink } from "@/ui/Button";
import { EmptyState } from "@/ui/Feedback";
import { ExpertCard } from "@/ui/cards";

export const metadata: Metadata = { title: "Shortlists et favoris" };

export default async function ShortlistsPage() {
  const { user, org } = await requireOrgUser("experts.search");
  const [lists, favorites] = await Promise.all([listShortlists(user, org.id), listFavorites(user.id)]);
  return (
    <>
      <PageHeader title="Shortlists et favoris" />
      {lists.length === 0 ? <EmptyState title="Aucune shortlist" description="Retenez des recommandations du matching ou ajoutez des experts depuis la recherche." action={<ButtonLink href="/organisation/experts">Rechercher des experts</ButtonLink>} /> : (
        <div className="space-y-4">
          {lists.map((s) => (
            <Card key={s.id}>
              <CardHeader title={s.name} description={s.mission ? `Mission ${s.mission.reference}` : undefined} action={s.entries.length >= 2 ? <ButtonLink href={`/comparer?ids=${s.entries.slice(0, 4).map((e) => e.expertId).join(",")}`} variant="outline" size="sm">Comparer</ButtonLink> : undefined} />
              <CardBody>
                {s.entries.length === 0 ? <p className="text-sm text-slate">Vide.</p> : (
                  <ul className="divide-y divide-line">{s.entries.map((e) => (
                    <li key={e.expertId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <span><Link href={`/experts/${e.expert.slug}`} className="font-semibold hover:underline">{e.expert.user.firstName} {e.expert.user.lastName}</Link> — <span className="text-slate">{e.expert.headline}</span>{e.note ? <span className="ml-2 text-xs text-slate">({e.note})</span> : null}</span>
                      <ActionButton action="/api/v1/org/shortlist-remove" body={{ shortlistId: s.id, expertId: e.expertId }} variant="ghost" successMessage="Retiré.">Retirer</ActionButton>
                    </li>
                  ))}</ul>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
      <h2 className="mb-4 mt-10 text-xl font-extrabold">Mes experts favoris</h2>
      {favorites.length === 0 ? <p className="text-sm text-slate">Aucun favori.</p> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{favorites.map((f) => <ExpertCard key={f.expertId} e={f.expert} />)}</div>}
    </>
  );
}
