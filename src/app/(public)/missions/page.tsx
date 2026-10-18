import type { Metadata } from "next";
import { prisma } from "@/infrastructure/db";
import { publicFigures } from "@/application/figures.service";
import { Visual } from "@/ui/Visual";
import { visuals } from "@/ui/visuals";
import { searchMissions } from "@/application/mission.service";
import { missionSearchSchema } from "@/application/schemas";
import { currentUser } from "@/lib/session";
import { PageHeader, Pagination } from "@/ui/Page";
import { MissionCard } from "@/ui/cards";
import { EmptyState } from "@/ui/Feedback";
import { Input, Select } from "@/ui/Field";
import { Button, ButtonLink } from "@/ui/Button";

export const metadata: Metadata = { title: "Missions" };
export const dynamic = "force-dynamic";

export default async function MissionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const parsed = missionSearchSchema.safeParse(Object.fromEntries(Object.entries(sp).filter(([, v]) => v)));
  const f = parsed.success ? parsed.data : missionSearchSchema.parse({});
  const [user, countries, domains] = await Promise.all([currentUser(), prisma.country.findMany({ where: { isActive: true }, orderBy: { nameFr: "asc" } }), prisma.expertiseDomain.findMany({ orderBy: { sortOrder: "asc" } })]);
  const [r, figures] = await Promise.all([searchMissions(user, f), publicFigures()]);
  return (
    <>
    <Visual def={visuals(figures).publierMissions} priority rounded={false} className="mx-auto max-w-[1672px] bg-white" />
    <div id="liste" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader title="Missions disponibles" description="Opportunités publiées par des organisations vérifiées ou en cours de validation." actions={<ButtonLink href="/organisation/missions/nouvelle">Publier une mission</ButtonLink>} />
      <form className="mb-6 grid gap-2 rounded-2xl border border-line bg-white p-4 shadow-card sm:grid-cols-5" role="search">
        <Input name="q" defaultValue={f.q} placeholder="Mot-clé, compétence…" className="sm:col-span-2" aria-label="Mot-clé" />
        <Select name="country" defaultValue={f.country ?? ""} aria-label="Pays"><option value="">Tous les pays</option>{countries.map((c) => <option key={c.code} value={c.code}>{c.nameFr}</option>)}</Select>
        <Select name="domain" defaultValue={f.domain ?? ""} aria-label="Domaine"><option value="">Tous les domaines</option>{domains.map((d) => <option key={d.id} value={d.slug}>{d.nameFr}</option>)}</Select>
        <div className="flex gap-2">
          <Select name="workMode" defaultValue={f.workMode ?? ""} aria-label="Modalité"><option value="">Modalité</option><option value="ONSITE">Sur site</option><option value="REMOTE">À distance</option><option value="HYBRID">Hybride</option></Select>
          <Button type="submit">Filtrer</Button>
        </div>
      </form>
      <p className="mb-4 text-sm text-slate">{r.total} mission(s)</p>
      {r.items.length === 0 ? <EmptyState title="Aucune mission ne correspond" description="Modifiez vos filtres ou créez une alerte depuis votre espace." /> : <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{r.items.map((m) => <MissionCard key={m.id} m={m} />)}</div>}
      <Pagination page={r.page} pages={r.pages} params={sp} basePath="/missions" />
    </div>
    </>
  );
}
