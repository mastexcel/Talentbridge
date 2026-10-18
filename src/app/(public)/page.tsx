import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, ClipboardList, FileSearch, GraduationCap, Handshake, Landmark, Search, ShieldCheck, Sparkles, Target, Users } from "lucide-react";
import { prisma } from "@/infrastructure/db";
import { getBlocks, publicFaq, publicPartners, publicTestimonials } from "@/application/cms.service";
import { publicFigures } from "@/application/figures.service";
import { Visual } from "@/ui/Visual";
import { visuals } from "@/ui/visuals";
import { directoryCardSelect } from "@/application/expert.service";
import { ButtonLink } from "@/ui/Button";
import { Badge, DemoBadge } from "@/ui/Badge";
import { ExpertCard, MissionCard } from "@/ui/cards";

export const dynamic = "force-dynamic";

const SERVICES = [
  { icon: Search, title: "Trouver les bons experts", text: "Annuaire qualifié, filtres avancés et profils vérifiés dans tous les domaines.", href: "/experts" },
  { icon: ClipboardList, title: "Publier vos missions", text: "Décrivez votre besoin, recevez des candidatures, comparez et sélectionnez.", href: "/missions" },
  { icon: Users, title: "Constituer des équipes projet", text: "Matching intelligent, compétences complémentaires et suivi des livrables.", href: "/services#equipes" },
  { icon: FileSearch, title: "Appels d'offres & opportunités", text: "Veille, alertes, matrice de conformité et constitution de consortiums.", href: "/appels-offres" },
  { icon: GraduationCap, title: "Talent Bridge Academy", text: "Des formations pour renforcer vos compétences et accélérer votre impact.", href: "/academy" },
  { icon: ShieldCheck, title: "Vérification & certification", text: "Identité, diplômes, références et compétences contrôlés par notre équipe.", href: "/services#verification" },
];

const AUDIENCES = [
  { title: "Pour les consultants", items: ["Valorisez vos compétences", "Accédez à plus d'opportunités", "Développez votre réseau", "Formations et certifications"], cta: ["Créer mon profil", "/inscription/consultant"], tone: "bg-orange-600" },
  { title: "Pour les entreprises", items: ["Trouvez les bons experts", "Réduisez vos délais de recrutement", "Constituez des équipes performantes", "Sécurisez vos projets"], cta: ["Publier une mission", "/entreprises"], tone: "bg-bordeaux-700" },
  { title: "Pour les ONG & institutions", items: ["Accédez à un réseau qualifié", "Mobilisez des experts spécialisés", "Renforcez l'impact de vos projets", "Conformité et transparence"], cta: ["Découvrir nos solutions", "/ong-institutions"], tone: "bg-olive-700" },
  { title: "Pour les cabinets de conseil", items: ["Rejoignez un réseau d'experts", "Répondez aux appels d'offres", "Constituez des consortiums", "Développez votre activité"], cta: ["Rejoindre la plateforme", "/cabinets"], tone: "bg-bordeaux-800" },
];

export default async function HomePage() {
  const [blocks, figures, testimonials, partners, faq, domains, featured, missions] = await Promise.all([
    getBlocks(["home.hero", "home.promise", "home.about"]),
    publicFigures(),
    publicTestimonials(),
    publicPartners(),
    publicFaq(),
    prisma.expertiseDomain.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, take: 9 }),
    prisma.expertProfile.findMany({ where: { visibility: "PUBLIC", completeness: { gte: 60 }, badges: { some: { revokedAt: null } } }, orderBy: [{ averageRating: { sort: "desc", nulls: "last" } }, { completedMissions: "desc" }], take: 3, select: directoryCardSelect }),
    prisma.mission.findMany({ where: { status: { in: ["PUBLISHED", "SHORTLISTING"] }, visibility: "PUBLIC" }, orderBy: { publishedAt: "desc" }, take: 3, include: { organization: { select: { name: true, status: true } }, domain: { select: { nameFr: true } }, requirements: { include: { skill: { select: { nameFr: true } } } } } }),
  ]);
  const hero = blocks["home.hero"];
  const v = visuals(figures);

  return (
    <>
      {/* 1. Hero : visuel officiel ; boutons et chiffres rendus actifs (chiffres réels) */}
      <section className="bg-white">
        <h1 className="sr-only">{hero?.title ?? "Des experts d'aujourd'hui pour les défis de demain."}</h1>
        <Visual def={v.accueilHero} priority rounded={false} className="mx-auto max-w-[1774px]" />
        {/* 2. Recherche rapide par domaine */}
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <form action="/experts" className="mx-auto flex max-w-2xl gap-2 rounded-2xl border border-line bg-white p-2 shadow-card" role="search">
            <label htmlFor="q-home" className="sr-only">Métier, compétence, secteur</label>
            <input id="q-home" name="q" placeholder="Métier, compétence, secteur…" className="h-11 min-w-0 flex-1 rounded-xl px-3 text-ink outline-none" />
            <button className="inline-flex h-11 items-center gap-2 rounded-xl bg-orange-600 px-4 font-semibold text-white hover:bg-orange-700">
              <Search className="h-4 w-4" /> <span className="hidden sm:inline">Rechercher</span>
            </button>
          </form>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {domains.map((d) => (
              <Link key={d.id} href={`/experts?domain=${d.slug}`} className="rounded-full border border-line px-3 py-1 text-xs text-ink/80 hover:border-orange-400 hover:text-bordeaux-700">
                {d.nameFr}
              </Link>
            ))}
          </div>
          {figures.isDemo && <p className="mt-3 hidden text-center text-xs text-slate md:block">Environnement de démonstration : les chiffres affichés sont calculés sur des données fictives.</p>}
        </div>
      </section>

      {/* 3. Présentation */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="max-w-3xl">
          <div>
            <Badge tone="orange">Qui sommes-nous</Badge>
            <h2 className="mt-3 text-3xl font-extrabold text-ink">{blocks["home.about"]?.title}</h2>
            <p className="mt-4 text-lg leading-relaxed text-slate">{blocks["home.about"]?.body}</p>
            <div className="mt-6 rounded-2xl border border-orange-200 bg-orange-50 p-5">
              <p className="flex items-center gap-2 font-display font-bold text-orange-800"><Target className="h-5 w-5" /> {blocks["home.promise"]?.title}</p>
              <p className="mt-2 text-sm text-orange-900">{blocks["home.promise"]?.body}</p>
            </div>
          </div>
        </div>
        <Visual def={v.solutions} className="mt-10" />
      </section>

      {/* 5. Catalogue des services */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-extrabold">Nos services</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-slate">Une plateforme unique pour identifier, vérifier, mobiliser et piloter l'expertise.</p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s) => (
              <Link key={s.title} href={s.href} className="group overflow-hidden rounded-2xl border border-line bg-white shadow-card transition hover:-translate-y-1 hover:shadow-lift">
                <div className="p-5">
                  <s.icon className="h-6 w-6 text-orange-600" />
                  <h3 className="mt-2 font-display text-lg font-bold group-hover:text-bordeaux-700">{s.title}</h3>
                  <p className="mt-1 text-sm text-slate">{s.text}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Fonctionnement en trois étapes */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-3xl font-extrabold">Comment ça marche</h2>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            [Target, "Définissez vos besoins", "Publiez une mission ou décrivez votre besoin : nous repérons automatiquement les compétences clés."],
            [Users, "Recevez des profils", "Candidatures et recommandations expliquées critère par critère, profils vérifiés mis en avant."],
            [BadgeCheck, "Sélectionnez et pilotez", "Entretiens, contrat, équipe projet, livrables et évaluation finale dans un seul espace."],
          ].map(([Icon, title, text], i) => {
            const I = Icon as typeof Target;
            return (
              <li key={i} className="relative rounded-2xl border border-line bg-white p-6 shadow-card">
                <span className="absolute -top-4 left-6 flex h-8 w-8 items-center justify-center rounded-full bg-orange-600 font-display font-bold text-white">{i + 1}</span>
                <I className="h-7 w-7 text-bordeaux-700" />
                <h3 className="mt-3 font-display text-lg font-bold">{title as string}</h3>
                <p className="mt-1 text-sm text-slate">{text as string}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <Visual def={v.equipesProjet} />
      </section>

      {/* 7. Experts mis en avant */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-3xl font-extrabold">Experts vérifiés</h2>
              <p className="mt-1 text-slate">Profils ayant passé au moins une vérification humaine.</p>
            </div>
            <ButtonLink href="/experts" variant="outline">Tout l'annuaire <ArrowRight className="h-4 w-4" /></ButtonLink>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {featured.length ? featured.map((e) => <ExpertCard key={e.id} e={e} />) : <p className="text-slate">Les premiers experts vérifiés apparaîtront ici.</p>}
          </div>
        </div>
      </section>

      {/* 8. Missions disponibles */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-3xl font-extrabold">Missions disponibles</h2>
          <ButtonLink href="/missions" variant="outline">Toutes les missions <ArrowRight className="h-4 w-4" /></ButtonLink>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {missions.length ? missions.map((m) => <MissionCard key={m.id} m={m} />) : <p className="text-slate">Aucune mission ouverte pour le moment.</p>}
        </div>
      </section>

      {/* 9. Avantages par catégorie */}
      <section className="bg-white py-16">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 sm:px-6 md:grid-cols-2">
          {AUDIENCES.map((a) => (
            <div key={a.title} className="flex overflow-hidden rounded-2xl border border-line bg-white shadow-card">
              <div className="flex-1 p-6">
                <h3 className="font-display text-xl font-extrabold text-bordeaux-700">{a.title}</h3>
                <ul className="mt-3 space-y-1.5 text-sm text-ink">
                  {a.items.map((i) => (
                    <li key={i} className="flex gap-2"><BadgeCheck className="h-4 w-4 shrink-0 text-olive-600" />{i}</li>
                  ))}
                </ul>
                <Link href={a.cta[1]} className={`mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white ${a.tone}`}>
                  {a.cta[0]} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 10. Témoignages */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-3xl font-extrabold">Ils témoignent</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure key={t.id} className="rounded-2xl border border-line bg-white p-6 shadow-card">
              <div className="flex gap-2">
                {t.isVerified && <Badge tone="olive"><BadgeCheck className="h-3.5 w-3.5" /> Témoignage vérifié</Badge>}
                <DemoBadge show={t.isDemo} />
              </div>
              <blockquote className="mt-3 text-ink">« {t.quote} »</blockquote>
              <figcaption className="mt-4 text-sm text-slate">
                <span className="font-semibold text-ink">{t.authorName}</span> — {t.authorRole}{t.organization ? `, ${t.organization}` : ""}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* 11. Partenaires */}
      {partners.length > 0 && (
        <section className="border-y border-line bg-white py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <p className="text-center text-sm font-semibold uppercase tracking-wide text-slate">Ils nous font confiance</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-4">
              {partners.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-2 rounded-xl border border-line px-5 py-3 font-display font-bold text-slate">
                  <Handshake className="h-4 w-4" /> {p.name} <DemoBadge show={p.isDemo} />
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 12. Appels à l'action */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <Visual def={v.plateforme} className="mb-10" />
        <div className="grid gap-5 md:grid-cols-3">
          {[
            [Sparkles, "Vous êtes expert ?", "Créez votre profil, faites-le vérifier et recevez des missions.", "/inscription/consultant", "Créer mon profil", "bg-orange-600"],
            [Building2, "Vous recrutez des experts ?", "Publiez votre besoin et recevez des profils qualifiés.", "/inscription/organisation", "Créer mon espace", "bg-bordeaux-700"],
            [Landmark, "Bailleur ou institution ?", "Mobilisez des équipes pour vos programmes en toute transparence.", "/contact", "Nous contacter", "bg-olive-700"],
          ].map(([Icon, title, text, href, label, tone]) => {
            const I = Icon as typeof Sparkles;
            return (
              <div key={title as string} className={`rounded-2xl p-6 text-white ${tone}`}>
                <I className="h-7 w-7" />
                <h3 className="mt-3 font-display text-xl font-extrabold">{title as string}</h3>
                <p className="mt-1 text-white/90">{text as string}</p>
                <Link href={href as string} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink">
                  {label as string} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* 13. FAQ */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-extrabold">Questions fréquentes</h2>
          <div className="mt-8 divide-y divide-line rounded-2xl border border-line">
            {faq.slice(0, 6).map((f) => (
              <details key={f.id} className="group p-5">
                <summary className="cursor-pointer list-none font-semibold text-ink marker:hidden">
                  <span className="flex items-center justify-between gap-3">{f.question}<span className="text-orange-600 transition group-open:rotate-45">+</span></span>
                </summary>
                <p className="mt-2 text-sm text-slate">{f.answer}</p>
              </details>
            ))}
          </div>
          <p className="mt-4 text-center"><Link href="/faq" className="font-semibold text-orange-700 hover:underline">Toutes les questions</Link></p>
        </div>
      </section>
    </>
  );
}
