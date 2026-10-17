import type { Metadata } from "next";
import { prisma } from "@/infrastructure/db";
import { compareExperts } from "@/application/expert.service";
import { currentUser } from "@/lib/session";
import { formatMoney } from "@/domain/money";
import { PageHeader } from "@/ui/Page";
import { Alert } from "@/ui/Feedback";
import { Table, TBody, Td, Th, THead } from "@/ui/Table";
import { Button } from "@/ui/Button";
import { AVAILABILITY_LABELS } from "@/ui/cards";

export const metadata: Metadata = { title: "Comparer des experts" };
export const dynamic = "force-dynamic";

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string; add?: string }> }) {
  const sp = await searchParams;
  const ids = [...new Set([...(sp.ids?.split(",") ?? []), ...(sp.add ? [sp.add] : [])])].filter(Boolean).slice(0, 4);
  const user = await currentUser();
  const experts = ids.length >= 2 ? await compareExperts(user, ids) : [];
  const favorites = user ? await prisma.favorite.findMany({ where: { userId: user.id, expertId: { notIn: ids } }, include: { expert: { select: { id: true, user: { select: { firstName: true, lastName: true } } } } } }) : [];
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader title="Comparer des experts" description="Comparez jusqu'à 4 profils côte à côte." />
      {ids.length < 2 && <Alert tone="info" className="mb-4">Ajoutez au moins un deuxième expert (depuis vos favoris ci-dessous ou depuis un profil).</Alert>}
      {favorites.length > 0 && ids.length < 4 && (
        <form className="mb-6 flex flex-wrap items-end gap-2">
          <input type="hidden" name="ids" value={ids.join(",")} />
          <label className="text-sm font-semibold">Ajouter un favori
            <select name="add" className="ml-2 h-10 rounded-xl border border-line px-2">{favorites.map((f) => <option key={f.expert.id} value={f.expert.id}>{f.expert.user.firstName} {f.expert.user.lastName}</option>)}</select>
          </label>
          <Button type="submit" variant="outline">Ajouter</Button>
        </form>
      )}
      {experts.length >= 2 && (
        <div className="rounded-2xl border border-line bg-white shadow-card">
          <Table>
            <THead><tr><Th>Critère</Th>{experts.map((e) => <Th key={e.id}>{e.user.firstName} {e.user.lastName}</Th>)}</tr></THead>
            <TBody>
              {[
                ["Titre", (e: (typeof experts)[number]) => e.headline],
                ["Localisation", (e: (typeof experts)[number]) => `${e.city ?? ""} ${e.countryCode ?? ""}`],
                ["Expérience", (e: (typeof experts)[number]) => `${e.yearsExperience} ans`],
                ["Compétences", (e: (typeof experts)[number]) => e.skills.map((s) => s.skill.nameFr).join(", ")],
                ["Vérifications", (e: (typeof experts)[number]) => e.badges.map((b) => b.badge.nameFr).join(", ") || "Aucune"],
                ["Références vérifiées", (e: (typeof experts)[number]) => String(e.references.length)],
                ["Disponibilité", (e: (typeof experts)[number]) => AVAILABILITY_LABELS[e.availability]],
                ["Tarif indicatif", (e: (typeof experts)[number]) => (e.dailyRateMinor && e.rateCurrency ? `${formatMoney(e.dailyRateMinor, e.rateCurrency)}/j` : "Sur demande")],
                ["Évaluation", (e: (typeof experts)[number]) => (e.averageRating ? `${e.averageRating.toFixed(1)}/5 (${e.ratingsCount})` : "—")],
                ["Missions terminées", (e: (typeof experts)[number]) => String(e.completedMissions)],
              ].map(([label, fn]) => (
                <tr key={label as string}><Td className="font-semibold">{label as string}</Td>{experts.map((e) => <Td key={e.id}>{(fn as (x: typeof e) => string | null)(e)}</Td>)}</tr>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}
