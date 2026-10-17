import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, MapPin } from "lucide-react";
import { prisma } from "@/infrastructure/db";
import { searchTenders } from "@/application/tender.service";
import { daysUntil } from "@/domain/tenders";
import { PageHeader, Pagination } from "@/ui/Page";
import { Badge, DemoBadge } from "@/ui/Badge";
import { EmptyState } from "@/ui/Feedback";
import { Input, Select } from "@/ui/Field";
import { Button, ButtonLink } from "@/ui/Button";
import { TENDER_TYPE_LABELS } from "@/ui/labels";

export const metadata: Metadata = { title: "Appels d'offres et AMI" };
export const dynamic = "force-dynamic";

export default async function TendersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [r, countries, domains] = await Promise.all([
    searchTenders({ q: sp.q?.slice(0, 100), country: sp.country?.length === 2 ? sp.country : undefined, type: ["TENDER", "EOI", "RFP"].includes(sp.type ?? "") ? sp.type : undefined, domain: sp.domain, page }),
    prisma.country.findMany({ orderBy: { nameFr: "asc" } }),
    prisma.expertiseDomain.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader title="Appels d'offres & opportunités" description="Restez informé, analysez les opportunités, préparez vos candidatures et collaborez avec d'autres experts." actions={<ButtonLink href="/espace/alertes" variant="outline">Mes alertes</ButtonLink>} />
      <form className="mb-6 grid gap-2 rounded-2xl border border-line bg-white p-4 shadow-card sm:grid-cols-5" role="search">
        <Input name="q" defaultValue={sp.q} placeholder="Mot-clé, acheteur…" className="sm:col-span-2" aria-label="Mot-clé" />
        <Select name="type" defaultValue={sp.type ?? ""} aria-label="Type"><option value="">Tous types</option><option value="TENDER">Appel d'offres</option><option value="EOI">AMI</option><option value="RFP">Demande de propositions</option></Select>
        <Select name="country" defaultValue={sp.country ?? ""} aria-label="Pays"><option value="">Tous pays</option>{countries.map((c) => <option key={c.code} value={c.code}>{c.nameFr}</option>)}</Select>
        <div className="flex gap-2"><Select name="domain" defaultValue={sp.domain ?? ""} aria-label="Domaine"><option value="">Domaine</option>{domains.map((d) => <option key={d.id} value={d.slug}>{d.nameFr}</option>)}</Select><Button type="submit">OK</Button></div>
      </form>
      {r.items.length === 0 ? <EmptyState title="Aucun appel ouvert ne correspond" /> : (
        <ul className="space-y-3">
          {r.items.map((t) => {
            const d = daysUntil(t.deadline);
            return (
              <li key={t.id} className="rounded-2xl border border-line bg-white p-5 shadow-card">
                <div className="flex flex-wrap items-center gap-2"><Badge tone="bordeaux">{TENDER_TYPE_LABELS[t.type]}</Badge>{t.domain && <Badge>{t.domain.nameFr}</Badge>}<DemoBadge show={t.isDemo} /><Badge tone={d <= 7 ? "red" : "olive"}>J-{d}</Badge></div>
                <Link href={`/appels-offres/${t.id}`} className="mt-2 block font-display text-lg font-bold hover:text-bordeaux-700">{t.title}</Link>
                <p className="mt-1 flex flex-wrap gap-4 text-sm text-slate"><span>{t.buyerName}</span><span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{t.countryCode}</span><span className="flex items-center gap-1"><CalendarClock className="h-4 w-4" />Clôture le {t.deadline.toLocaleDateString("fr-FR")}</span></p>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination page={page} pages={r.pages} params={sp} basePath="/appels-offres" />
    </div>
  );
}
