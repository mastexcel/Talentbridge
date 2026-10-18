import type { Metadata } from "next";
import Link from "next/link";
import { Clock, GraduationCap, Users } from "lucide-react";
import { catalog } from "@/application/academy.service";
import { publicFigures } from "@/application/figures.service";
import { Visual } from "@/ui/Visual";
import { visuals } from "@/ui/visuals";
import { formatMoney } from "@/domain/money";
import { Badge, DemoBadge } from "@/ui/Badge";
import { EmptyState } from "@/ui/Feedback";
import { ButtonLink } from "@/ui/Button";
import { LEVEL_LABELS } from "@/ui/labels";

export const metadata: Metadata = { title: "Talent Bridge Academy" };
export const dynamic = "force-dynamic";

export default async function AcademyPage({ searchParams }: { searchParams: Promise<{ q?: string; level?: string }> }) {
  const sp = await searchParams;
  const [courses, figures] = await Promise.all([catalog({ q: sp.q?.slice(0, 80), level: sp.level }), publicFigures()]);
  return (
    <>
      <section className="bg-white">
        <Visual def={visuals(figures).formation} priority rounded={false} className="mx-auto max-w-[1774px]" />
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 px-4 pt-8 sm:px-6">
          <div>
            <h1 className="text-3xl font-extrabold text-ink">Talent Bridge Academy</h1>
            <p className="mt-2 max-w-2xl text-slate">Des formations pour renforcer vos compétences et accélérer votre impact. Certificats vérifiables par identifiant unique et QR code.</p>
          </div>
          <div className="flex gap-3"><ButtonLink href="#catalogue">Explorer les formations</ButtonLink><ButtonLink href="/academy/formateur" variant="outline">Espace formateur</ButtonLink></div>
        </div>
      </section>
      <div id="catalogue" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <form className="mb-6 flex flex-wrap gap-2" role="search">
          <input name="q" defaultValue={sp.q} placeholder="Rechercher une formation" className="h-10 flex-1 rounded-xl border border-line px-3" aria-label="Rechercher une formation" />
          <select name="level" defaultValue={sp.level ?? ""} className="h-10 rounded-xl border border-line px-2" aria-label="Niveau"><option value="">Tous niveaux</option><option value="BEGINNER">Débutant</option><option value="INTERMEDIATE">Intermédiaire</option><option value="ADVANCED">Avancé</option></select>
          <button className="h-10 rounded-xl bg-orange-600 px-4 font-semibold text-white">Rechercher</button>
        </form>
        {courses.length === 0 ? <EmptyState icon={GraduationCap} title="Aucune formation publiée" /> : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <Link key={c.id} href={`/academy/${c.slug}`} className="rounded-2xl border border-line bg-white p-5 shadow-card hover:shadow-lift">
                <div className="flex gap-2"><Badge tone="olive">{LEVEL_LABELS[c.level] ?? c.level}</Badge><DemoBadge show={c.isDemo} /></div>
                <h2 className="mt-3 font-display text-lg font-bold">{c.title}</h2>
                <p className="mt-1 line-clamp-3 text-sm text-slate">{c.summary}</p>
                <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate"><span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{c.durationHours} h</span><span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{c._count.enrollments} apprenant(s)</span><span>Formateur : {c.instructor.firstName} {c.instructor.lastName}</span></div>
                <p className="mt-3 font-semibold">{c.priceMinor === 0 ? "Gratuit" : formatMoney(c.priceMinor, c.currency)}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
