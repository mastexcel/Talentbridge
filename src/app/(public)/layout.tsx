import Link from "next/link";
import { Logo } from "@/ui/Logo";
import { ButtonLink } from "@/ui/Button";
import { MobileMenu } from "@/ui/MobileMenu";
import { LocaleSwitch } from "@/ui/LocaleSwitch";
import { currentUser, homePathFor } from "@/lib/session";
import { getT } from "@/i18n/server";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [user, { t, locale }] = await Promise.all([currentUser(), getT()]);
  const links = [
    { href: "/experts", label: t("nav.experts") },
    { href: "/missions", label: t("nav.missions") },
    { href: "/appels-offres", label: t("nav.tenders") },
    { href: "/academy", label: t("nav.academy") },
    { href: "/services", label: t("nav.services") },
    { href: "/tarifs", label: t("nav.pricing") },
    { href: "/a-propos", label: t("nav.about") },
  ];
  const cta = user ? [{ href: homePathFor(user), label: t("nav.myspace") }] : [{ href: "/inscription", label: t("nav.signup") }, { href: "/connexion", label: t("nav.login") }];
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="relative mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo className="h-9 w-auto sm:h-11" />
          <nav className="hidden items-center gap-0.5 xl:flex" aria-label="Navigation principale">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm font-medium text-ink/80 hover:bg-mist hover:text-bordeaux-700">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-2 xl:flex">
            <LocaleSwitch locale={locale} />
            {user ? (
              <ButtonLink href={homePathFor(user)} variant="secondary">{t("nav.myspace")}</ButtonLink>
            ) : (
              <>
                <ButtonLink href="/connexion" variant="ghost">{t("nav.login")}</ButtonLink>
                <ButtonLink href="/inscription">{t("nav.signup")}</ButtonLink>
              </>
            )}
          </div>
          <MobileMenu links={links} cta={cta} />
        </div>
        <div className="h-0.5 bg-bridge-line" />
      </header>
      <main id="contenu">{children}</main>
      <footer className="bg-bordeaux-950 text-white/80">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo variant="dark" tagline className="h-12 w-auto" taglineClassName="text-[10px]" priority={false} />
            <p className="mt-3 max-w-sm text-xs text-white/60">Plateforme panafricaine : experts, cabinets, entreprises, ONG, institutions, bailleurs et organismes de formation.</p>
          </div>
          {[
            { title: t("footer.platform"), links: [["Trouver un expert", "/experts"], ["Missions", "/missions"], ["Appels d'offres & AMI", "/appels-offres"], ["Academy", "/academy"], ["Communauté", "/communaute"]] },
            { title: t("footer.solutions"), links: [["Consultants", "/inscription/consultant"], ["Cabinets de conseil", "/cabinets"], ["Entreprises", "/entreprises"], ["ONG & institutions", "/ong-institutions"], ["Tarifs", "/tarifs"]] },
            { title: t("footer.company"), links: [["À propos", "/a-propos"], ["Notre mission", "/notre-mission"], ["Nos services", "/services"], ["FAQ", "/faq"], ["Contact", "/contact"], ["Vérifier un certificat", "/certificats"]] },
          ].map((col) => (
            <div key={col.title}>
              <p className="font-display font-bold text-white">{col.title}</p>
              <ul className="mt-3 space-y-2 text-sm">
                {col.links.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="hover:text-orange-400">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-white/60 sm:px-6">
            <p>© {new Date().getFullYear()} Talent Bridge. {t("footer.rights")}</p>
            <nav className="flex flex-wrap gap-4" aria-label={t("footer.legal")}>
              <Link href="/conditions-generales" className="hover:text-white">Conditions générales</Link>
              <Link href="/confidentialite" className="hover:text-white">Confidentialité</Link>
              <Link href="/mentions-legales" className="hover:text-white">Mentions légales</Link>
            </nav>
          </div>
        </div>
      </footer>
    </>
  );
}
