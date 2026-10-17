import type { Metadata } from "next";
import { SlidersHorizontal } from "lucide-react";
import { prisma } from "@/infrastructure/db";
import { searchExperts } from "@/application/expert.service";
import { expertSearchSchema } from "@/application/schemas";
import { currentUser } from "@/lib/session";
import { PageHeader, Pagination } from "@/ui/Page";
import { ExpertCard } from "@/ui/cards";
import { EmptyState } from "@/ui/Feedback";
import { Input, Select } from "@/ui/Field";
import { Button, ButtonLink } from "@/ui/Button";

export const metadata: Metadata = { title: "Annuaire des experts" };
export const dynamic = "force-dynamic";

export default async function ExpertsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const parsed = expertSearchSchema.safeParse(Object.fromEntries(Object.entries(sp).filter(([, v]) => v)));
  const filters = parsed.success ? parsed.data : expertSearchSchema.parse({});
  const user = await currentUser();
  const [result, countries, domains, skills] = await Promise.all([
    searchExperts(user, filters),
    prisma.country.findMany({ where: { isActive: true }, orderBy: { nameFr: "asc" } }),
    prisma.expertiseDomain.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.skill.findMany({ where: { isActive: true }, orderBy: { nameFr: "asc" } }),
  ]);
  const f = (name: keyof typeof filters) => (filters[name] as string | number | undefined)?.toString() ?? "";

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader title="Annuaire des experts" description="Recherchez parmi des profils qualifiés. Les coordonnées ne sont jamais affichées : contactez les experts via la messagerie sécurisée." />
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <form className="h-fit rounded-2xl border border-line bg-white p-5 shadow-card lg:sticky lg:top-24" role="search" aria-label="Filtres de recherche">
          <p className="mb-4 flex items-center gap-2 font-display font-bold"><SlidersHorizontal className="h-4 w-4" /> Filtres</p>
          <div className="space-y-3 text-sm">
            <Input name="q" defaultValue={f("q")} placeholder="Mot-clé, compétence, nom…" aria-label="Mot-clé" />
            <Select name="country" defaultValue={f("country")} aria-label="Pays"><option value="">Tous les pays</option>{countries.map((c) => <option key={c.code} value={c.code}>{c.nameFr}</option>)}</Select>
            <Input name="city" defaultValue={f("city")} placeholder="Ville" aria-label="Ville" />
            <Select name="domain" defaultValue={f("domain")} aria-label="Domaine"><option value="">Tous les domaines</option>{domains.map((d) => <option key={d.id} value={d.slug}>{d.nameFr}</option>)}</Select>
            <Select name="skill" defaultValue={f("skill")} aria-label="Compétence ou spécialisation"><option value="">Toutes les compétences</option>{skills.map((s) => <option key={s.id} value={s.slug}>{s.nameFr}</option>)}</Select>
            <Select name="language" defaultValue={f("language")} aria-label="Langue"><option value="">Toutes les langues</option><option value="fr">Français</option><option value="en">Anglais</option><option value="pt">Portugais</option><option value="ar">Arabe</option></Select>
            <Select name="minYears" defaultValue={f("minYears")} aria-label="Expérience minimale"><option value="">Expérience : toutes</option><option value="3">3 ans et plus</option><option value="5">5 ans et plus</option><option value="10">10 ans et plus</option><option value="15">15 ans et plus</option></Select>
            <Select name="certified" defaultValue={f("certified")} aria-label="Niveau de vérification"><option value="">Vérification : toutes</option><option value="identity">Identité vérifiée</option><option value="documents">Diplômes et références vérifiés</option><option value="skills">Compétences évaluées</option></Select>
            <Select name="availability" defaultValue={f("availability")} aria-label="Disponibilité"><option value="">Disponibilité : toutes</option><option value="AVAILABLE">Disponible</option><option value="PARTIAL">Disponible ou partiel</option></Select>
            <Select name="mobility" defaultValue={f("mobility")} aria-label="Mobilité"><option value="">Mobilité : toutes</option><option value="NATIONAL">Nationale ou plus</option><option value="REGIONAL">Régionale ou plus</option><option value="INTERNATIONAL">Internationale</option></Select>
            <div className="grid grid-cols-2 gap-2">
              <Input name="minRate" type="number" min={0} step={10000} defaultValue={f("minRate")} placeholder="TJM min" aria-label="Tarif journalier minimum (FCFA)" />
              <Input name="maxRate" type="number" min={0} step={10000} defaultValue={f("maxRate")} placeholder="TJM max" aria-label="Tarif journalier maximum (FCFA)" />
            </div>
            <p className="text-xs text-slate">Fourchette tarifaire en FCFA / jour.</p>
            <Select name="sort" defaultValue={f("sort")} aria-label="Tri"><option value="relevance">Tri : pertinence</option><option value="experience">Expérience</option><option value="rating">Évaluations</option><option value="recent">Plus récents</option></Select>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="submit" className="flex-1">Appliquer</Button>
            <ButtonLink href="/experts" variant="ghost">Effacer</ButtonLink>
          </div>
        </form>
        <section aria-live="polite">
          <p className="mb-4 text-sm text-slate"><strong className="text-ink">{result.total}</strong> expert(s) correspondant(s)</p>
          {!parsed.success && <p className="mb-4 text-sm text-red-700">Certains filtres sont invalides et ont été ignorés.</p>}
          {result.items.length === 0 ? (
            <EmptyState title="Aucun expert ne correspond" description="Élargissez vos critères ou publiez une mission : notre équipe peut aussi sourcer des profils pour vous." action={<ButtonLink href="/organisation/missions/nouvelle">Publier une mission</ButtonLink>} />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {result.items.map((e) => <ExpertCard key={e.id} e={e} />)}
            </div>
          )}
          <Pagination page={result.page} pages={result.pages} params={sp} basePath="/experts" />
        </section>
      </div>
    </div>
  );
}
