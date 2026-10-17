import type { Metadata } from "next";
import { prisma } from "@/infrastructure/db";
import { requireOrgUser } from "@/lib/session";
import { searchExperts } from "@/application/expert.service";
import { expertSearchSchema } from "@/application/schemas";
import { PageHeader, Pagination } from "@/ui/Page";
import { ExpertCard } from "@/ui/cards";
import { ActionButton } from "@/ui/ActionButton";
import { Input, Select } from "@/ui/Field";
import { Button, ButtonLink } from "@/ui/Button";
import { EmptyState } from "@/ui/Feedback";

export const metadata: Metadata = { title: "Rechercher des experts" };

export default async function OrgExperts({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { user, org } = await requireOrgUser("experts.search");
  const parsed = expertSearchSchema.safeParse(Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== "mission")));
  const f = parsed.success ? parsed.data : expertSearchSchema.parse({});
  const [r, missions, domains] = await Promise.all([
    searchExperts(user, f),
    prisma.mission.findMany({ where: { organizationId: org.id, status: { notIn: ["CLOSED", "CANCELLED"] } }, select: { id: true, title: true } }),
    prisma.expertiseDomain.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const target = missions.find((m) => m.id === sp.mission) ?? missions[0];
  return (
    <>
      <PageHeader title="Rechercher des experts" description="Ajoutez des profils à la shortlist d'une mission ou invitez-les à candidater." actions={<ButtonLink href="/experts" variant="outline">Filtres avancés</ButtonLink>} />
      <form className="mb-6 grid gap-2 rounded-2xl border border-line bg-white p-4 shadow-card sm:grid-cols-5">
        <Input name="q" defaultValue={f.q} placeholder="Compétence, mot-clé…" className="sm:col-span-2" aria-label="Mot-clé" />
        <Select name="domain" defaultValue={f.domain ?? ""} aria-label="Domaine"><option value="">Domaine</option>{domains.map((d) => <option key={d.id} value={d.slug}>{d.nameFr}</option>)}</Select>
        <Select name="mission" defaultValue={target?.id ?? ""} aria-label="Mission cible">{missions.length === 0 ? <option value="">Aucune mission</option> : missions.map((m) => <option key={m.id} value={m.id}>Pour : {m.title.slice(0, 40)}</option>)}</Select>
        <Button type="submit">Rechercher</Button>
      </form>
      {r.items.length === 0 ? <EmptyState title="Aucun expert" /> : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {r.items.map((e) => (
            <ExpertCard key={e.id} e={e} actions={target ? (
              <div className="flex gap-1">
                <ActionButton action={`/api/v1/missions/${target.id}/shortlist`} body={{ expertId: e.id }} successMessage="Ajouté à la shortlist.">Shortlist</ActionButton>
                <ActionButton action={`/api/v1/missions/${target.id}/invite`} body={{ expertId: e.id }} variant="primary" successMessage="Invitation envoyée.">Inviter</ActionButton>
              </div>
            ) : undefined} />
          ))}
        </div>
      )}
      <Pagination page={r.page} pages={r.pages} params={sp} basePath="/organisation/experts" />
    </>
  );
}
