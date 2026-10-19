import type { Metadata } from "next";
import Link from "next/link";
import { Award, BadgeCheck, Building2, CalendarDays, GraduationCap, MapPin, MonitorPlay, Search, UserRound } from "lucide-react";
import { academyFigures, catalog, catalogDomains, upcomingSessions, type CatalogFilter } from "@/application/academy.service";
import { publicFigures } from "@/application/figures.service";
import { currentUser } from "@/lib/session";
import { Visual } from "@/ui/Visual";
import { visuals } from "@/ui/visuals";
import { DemoBadge } from "@/ui/Badge";
import { EmptyState } from "@/ui/Feedback";
import { ButtonLink } from "@/ui/Button";
import { CourseCard, DateBlock, KindBadge, fmtTime, priceLabel, seatsText, sessionPlace } from "@/ui/academy";
import { cn } from "@/ui/cn";

export const metadata: Metadata = {
  title: "Talent Bridge Academy — formations et séminaires",
  description: "Formations en ligne, classes virtuelles, formations en présentiel et séminaires pour les experts et toute personne qui souhaite se former. Certificats vérifiables par QR code.",
};
export const dynamic = "force-dynamic";

const TABS = [
  { value: "", label: "Tout le catalogue" },
  { value: "TRAINING", label: "Formations" },
  { value: "SEMINAR", label: "Séminaires" },
];

type SP = { q?: string; level?: string; type?: string; format?: string; domaine?: string; prix?: string; bienvenue?: string };

/** Lien de filtre qui conserve les autres critères. */
function href(sp: SP, patch: Partial<SP>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...patch, bienvenue: undefined })) if (v) p.set(k, v);
  const qs = p.toString();
  return `/academy${qs ? `?${qs}` : ""}#catalogue`;
}

export default async function AcademyPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const filter: CatalogFilter = { q: sp.q?.slice(0, 80), level: sp.level, kind: sp.type, format: sp.format, domain: sp.domaine, price: sp.prix };
  const [courses, agenda, figures, af, domains, user] = await Promise.all([catalog(filter), upcomingSessions(8), publicFigures(), academyFigures(), catalogDomains(), currentUser()]);
  const filtered = !!(sp.q || sp.level || sp.format || sp.domaine || sp.prix);
  const stats = [
    { label: "Formations", value: af.trainings, icon: GraduationCap },
    { label: "Séminaires", value: af.seminars, icon: Building2 },
    { label: "Sessions programmées", value: af.sessions, icon: CalendarDays },
    { label: "Apprenants", value: af.learners, icon: UserRound },
    { label: "Certificats délivrés", value: af.certificates, icon: Award },
  ];

  return (
    <>
      <section className="bg-white">
        <Visual def={visuals(figures).formation} priority rounded={false} className="mx-auto max-w-[1774px]" />
      </section>

      {/* Présentation et chiffres réels */}
      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          {sp.bienvenue && <p className="mb-6 rounded-xl bg-olive-50 px-4 py-3 text-sm text-olive-900">Bienvenue ! Votre compte est créé : choisissez une formation ou un séminaire ci-dessous.</p>}
          <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-700">Apprendre · Évoluer · Innover · Impacter</p>
              <h1 className="mt-2 text-3xl font-extrabold text-ink sm:text-4xl">Talent Bridge Academy</h1>
              <p className="mt-3 max-w-2xl text-lg text-slate">Formations et séminaires pour les experts et pour toute personne qui souhaite développer ses compétences : en ligne à votre rythme, en classe virtuelle, en présentiel ou en format hybride. Chaque parcours réussi donne lieu à un certificat cosigné par l&apos;institution qui délivre la formation et par Talent Bridge, vérifiable par QR code.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <ButtonLink href="#catalogue">Voir les formations</ButtonLink>
                <ButtonLink href="#agenda" variant="outline">Agenda des séminaires</ButtonLink>
              </div>
            </div>
            <div>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-2xl border border-line bg-mist p-4">
                    <dt className="flex items-center gap-1.5 text-xs text-slate"><s.icon className="h-4 w-4 text-bordeaux-700" aria-hidden />{s.label}</dt>
                    <dd className="mt-1 font-display text-2xl font-extrabold tabular-nums text-ink">{s.value.toLocaleString("fr-FR")}</dd>
                  </div>
                ))}
              </dl>
              {af.isDemo && <p className="mt-2 flex items-center gap-2 text-xs text-slate"><DemoBadge show /> Chiffres calculés en direct, données de démonstration incluses.</p>}
            </div>
          </div>
        </div>
      </section>

      {/* Publics */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6" aria-labelledby="publics">
        <h2 id="publics" className="text-2xl font-extrabold">Pour qui ?</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-line bg-white p-6 shadow-card">
            <BadgeCheck className="h-8 w-8 text-bordeaux-700" aria-hidden />
            <h3 className="mt-3 font-display text-lg font-bold">Experts et consultants</h3>
            <p className="mt-2 text-sm text-slate">Renforcez votre expertise, découvrez de nouvelles méthodes et ajoutez des certificats vérifiables à votre parcours. Vos formations apparaissent dans votre espace consultant.</p>
            <div className="mt-4">{user?.expertProfile ? <ButtonLink href="/espace/formations" variant="outline" size="sm">Mes formations</ButtonLink> : <ButtonLink href="/inscription/consultant" variant="outline" size="sm">Créer mon profil d&apos;expert</ButtonLink>}</div>
          </div>
          <div className="rounded-2xl border-2 border-orange-500 bg-white p-6 shadow-card">
            <GraduationCap className="h-8 w-8 text-orange-600" aria-hidden />
            <h3 className="mt-3 font-display text-lg font-bold">Toute personne qui souhaite se former</h3>
            <p className="mt-2 text-sm text-slate">Étudiants, jeunes diplômés, professionnels en reconversion, agents d&apos;administrations, d&apos;ONG ou d&apos;entreprises : un compte apprenant gratuit suffit pour s&apos;inscrire aux formations et séminaires.</p>
            <div className="mt-4">{user ? <ButtonLink href="/espace/formations" size="sm">Mes formations</ButtonLink> : <ButtonLink href="/inscription/apprenant" size="sm">Créer un compte apprenant</ButtonLink>}</div>
          </div>
          <div className="rounded-2xl border border-line bg-white p-6 shadow-card">
            <Building2 className="h-8 w-8 text-olive-700" aria-hidden />
            <h3 className="mt-3 font-display text-lg font-bold">Organismes de formation et formateurs</h3>
            <p className="mt-2 text-sm text-slate">Publiez vos formations et séminaires, programmez vos sessions, suivez la présence et les acquis. Votre institution figure sur chaque certificat après validation par Talent Bridge.</p>
            <div className="mt-4"><ButtonLink href={user ? "/academy/formateur" : "/inscription/organisation?type=TRAINING_PROVIDER"} variant="outline" size="sm">Proposer une formation</ButtonLink></div>
          </div>
        </div>
      </section>

      {/* Agenda */}
      <section id="agenda" className="scroll-mt-24 bg-white py-12" aria-labelledby="agenda-titre">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="agenda-titre" className="text-2xl font-extrabold">Prochains séminaires et sessions</h2>
              <p className="mt-1 text-slate">Séminaires, classes virtuelles et formations en présentiel programmés. Horaires en GMT.</p>
            </div>
            <Link href={href(sp, { type: "SEMINAR" })} className="text-sm font-semibold text-orange-700 hover:underline">Tous les séminaires</Link>
          </div>
          {agenda.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-dashed border-line p-6 text-center text-sm text-slate">Aucune session programmée pour le moment. Les formations en ligne restent accessibles à tout moment.</p>
          ) : (
            <ul className="mt-6 grid gap-3 lg:grid-cols-2">
              {agenda.map((s) => (
                <li key={s.id}>
                  <Link href={`/academy/${s.course.slug}`} className="flex gap-4 rounded-2xl border border-line p-4 transition hover:border-orange-500 hover:bg-orange-50/40">
                    <DateBlock date={s.startsAt} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><KindBadge kind={s.course.kind} /><DemoBadge show={s.course.isDemo} /></div>
                      <p className="mt-1 font-display font-bold leading-snug text-ink">{s.course.title}</p>
                      <p className="text-sm text-slate">{s.title} · {fmtTime(s.startsAt)}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate">
                        <span className="flex items-center gap-1">{s.mode === "VIRTUAL" ? <MonitorPlay className="h-3.5 w-3.5" aria-hidden /> : <MapPin className="h-3.5 w-3.5" aria-hidden />}{sessionPlace(s)}</span>
                        <span className={cn(s.seatsLeft === 0 && "font-semibold text-red-700")}>{seatsText(s.seatsLeft)}</span>
                        <span className="font-semibold text-bordeaux-700">{priceLabel(s.course.priceMinor, s.course.currency)}</span>
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Catalogue */}
      <section id="catalogue" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-12 sm:px-6" aria-labelledby="catalogue-titre">
        <h2 id="catalogue-titre" className="text-2xl font-extrabold">Catalogue des formations et séminaires</h2>
        <nav className="mt-5 flex gap-2 overflow-x-auto border-b border-line" aria-label="Type">
          {TABS.map((t) => {
            const active = (sp.type ?? "") === t.value;
            return <Link key={t.value} href={href(sp, { type: t.value || undefined })} aria-current={active ? "page" : undefined} className={cn("whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold", active ? "border-orange-600 text-bordeaux-700" : "border-transparent text-slate hover:text-ink")}>{t.label}</Link>;
          })}
        </nav>
        <form className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_repeat(4,auto)_auto]" role="search" action="/academy#catalogue">
          {sp.type && <input type="hidden" name="type" value={sp.type} />}
          <label className="sr-only" htmlFor="ac-q">Rechercher</label>
          <input id="ac-q" name="q" defaultValue={sp.q} placeholder="Rechercher un thème, un mot-clé…" className="h-11 min-w-0 rounded-xl border border-line bg-white px-3 sm:col-span-2 lg:col-span-1" />
          <select name="format" defaultValue={sp.format ?? ""} className="h-11 rounded-xl border border-line bg-white px-2" aria-label="Format">
            <option value="">Tous formats</option><option value="ONLINE">En ligne, à votre rythme</option><option value="VIRTUAL_CLASS">Classe virtuelle</option><option value="IN_PERSON">Présentiel</option><option value="BLENDED">Hybride</option>
          </select>
          <select name="domaine" defaultValue={sp.domaine ?? ""} className="h-11 rounded-xl border border-line bg-white px-2" aria-label="Thématique">
            <option value="">Toutes thématiques</option>{domains.map((d) => <option key={d.slug} value={d.slug}>{d.nameFr}</option>)}
          </select>
          <select name="level" defaultValue={sp.level ?? ""} className="h-11 rounded-xl border border-line bg-white px-2" aria-label="Niveau">
            <option value="">Tous niveaux</option><option value="BEGINNER">Débutant</option><option value="INTERMEDIATE">Intermédiaire</option><option value="ADVANCED">Avancé</option>
          </select>
          <select name="prix" defaultValue={sp.prix ?? ""} className="h-11 rounded-xl border border-line bg-white px-2" aria-label="Prix">
            <option value="">Gratuit et payant</option><option value="free">Gratuit</option><option value="paid">Payant</option>
          </select>
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 font-semibold text-white hover:bg-orange-700"><Search className="h-4 w-4" aria-hidden />Filtrer</button>
        </form>
        <p className="mt-4 text-sm text-slate" aria-live="polite">
          {courses.length} résultat{courses.length > 1 ? "s" : ""}
          {filtered && <> · <Link href={href({ type: sp.type }, {})} className="font-semibold text-orange-700 hover:underline">Effacer les filtres</Link></>}
        </p>
        {courses.length === 0 ? (
          <div className="mt-6"><EmptyState icon={GraduationCap} title={filtered || sp.type ? "Aucun résultat pour ces critères" : "Aucune formation publiée pour le moment"} description="Élargissez votre recherche ou revenez bientôt : de nouvelles formations et de nouveaux séminaires sont publiés régulièrement." /></div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => <CourseCard key={c.id} c={c} />)}
          </div>
        )}
      </section>

      {/* Parcours */}
      <section className="bg-bordeaux-800 py-12 text-white" aria-labelledby="parcours">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 id="parcours" className="text-2xl font-extrabold">Comment ça marche</h2>
          <ol className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Choisissez", "Une formation à suivre à votre rythme, ou une session de classe virtuelle, de présentiel ou de séminaire selon vos dates."],
              ["Inscrivez-vous", "Gratuitement ou en payant par Mobile Money, carte ou virement. Votre place est réservée dès l'inscription."],
              ["Participez", "Leçons, exercices et évaluation finale en ligne ; pour les sessions, la présence est attestée par le formateur."],
              ["Obtenez votre certificat", "Cosigné par l'institution et Talent Bridge, numéroté et vérifiable par QR code ; téléchargeable en PDF."],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-2xl bg-white/10 p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 font-display font-extrabold">{i + 1}</span>
                <p className="mt-3 font-display text-lg font-bold">{t}</p>
                <p className="mt-1 text-sm text-white/80">{d}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-white/80">Vous avez reçu un certificat ? <Link href="/certificats" className="font-semibold text-orange-300 underline-offset-2 hover:underline">Vérifier un certificat</Link></p>
        </div>
      </section>
    </>
  );
}
