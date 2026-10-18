"use client";
/**
 * Coquille des espaces connectés : barre latérale rétractable (mémorisée), tiroir mobile,
 * barre supérieure (notifications, organisation active, compte). La navigation est calculée
 * côté serveur selon les rôles ; ce composant ne fait que l'afficher.
 */
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, Building2, ChevronsLeft, ChevronsRight, LogOut, Menu, MessageSquare, X } from "lucide-react";
import { NAV_ICONS, type NavIconName } from "./nav-icons";
import { LOGO_FILES } from "./Logo";
import { cn } from "./cn";
import { api } from "./api";

export type NavItem = { href: string; label: string; icon: NavIconName; badge?: number };
export type NavSection = { title: string; items: NavItem[] };

function Icon({ name, className }: { name: NavIconName; className?: string }) {
  const C = NAV_ICONS[name];
  return <C className={className} />;
}

export function Shell({
  sections,
  user,
  orgs,
  activeOrgId,
  unread,
  variant = "app",
  children,
  banner,
}: {
  sections: NavSection[];
  user: { firstName: string; lastName: string; email: string };
  orgs: { id: string; name: string; role: string }[];
  activeOrgId: string | null;
  unread: number;
  variant?: "app" | "admin";
  children: React.ReactNode;
  banner?: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("tb_sidebar") === "1");
    } catch {}
  }, []);
  useEffect(() => setMobile(false), [pathname]);
  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("tb_sidebar", c ? "0" : "1");
      } catch {}
      return !c;
    });
  };
  const dark = variant === "admin";
  const active = (href: string) => pathname === href || (href !== "/espace" && href !== "/organisation" && href !== "/admin" && pathname.startsWith(href + "/"));

  const nav = (compact: boolean) => (
    <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navigation de l'espace">
      {sections.map((s) => (
        <div key={s.title} className="mb-5">
          {!compact && <p className={cn("mb-2 px-3 text-[11px] font-bold uppercase tracking-wider", dark ? "text-white/50" : "text-slate/80")}>{s.title}</p>}
          <ul className="space-y-0.5">
            {s.items.map((i) => (
              <li key={i.href}>
                <Link
                  href={i.href}
                  title={compact ? i.label : undefined}
                  aria-current={active(i.href) ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                    compact && "justify-center px-2",
                    dark
                      ? active(i.href) ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
                      : active(i.href) ? "bg-bordeaux-700 text-white shadow-sm" : "text-ink/80 hover:bg-bordeaux-50 hover:text-bordeaux-700",
                  )}
                >
                  <Icon name={i.icon} className="h-[18px] w-[18px] shrink-0" />
                  {!compact && <span className="flex-1 truncate">{i.label}</span>}
                  {!compact && !!i.badge && <span className="rounded-full bg-orange-600 px-1.5 text-[11px] font-bold text-white">{i.badge}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  const sidebarBase = dark ? "bg-bordeaux-950 text-white" : "bg-white border-r border-line";
  const logo = LOGO_FILES[dark ? "dark" : "light"];

  return (
    <div className="min-h-screen">
      {/* Barre latérale bureau */}
      <aside className={cn("fixed inset-y-0 left-0 z-30 hidden flex-col transition-[width] duration-200 lg:flex", sidebarBase, collapsed ? "w-[76px]" : "w-64")}>
        <div className={cn("flex h-20 items-center px-4", collapsed ? "justify-center" : "justify-between")}>
          <Link href="/" aria-label="Talent Bridge — site public">
            <Image src={logo.src} alt="Talent Bridge" width={logo.w} height={logo.h} className={cn("w-auto", collapsed ? "h-5" : "h-14", dark && "rounded-md")} priority />
          </Link>
        </div>
        {nav(collapsed)}
        <button type="button" onClick={toggle} className={cn("m-3 flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold", dark ? "text-white/70 hover:bg-white/10" : "text-slate hover:bg-mist")} aria-label={collapsed ? "Déplier la barre latérale" : "Replier la barre latérale"}>
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Replier</>}
        </button>
      </aside>

      {/* Tiroir mobile */}
      {mobile && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu de navigation">
          <button className="absolute inset-0 bg-ink/40" aria-label="Fermer le menu" onClick={() => setMobile(false)} />
          <aside className={cn("absolute inset-y-0 left-0 flex w-72 flex-col shadow-lift animate-fade-in", sidebarBase)}>
            <div className="flex h-20 items-center justify-between px-4">
              <Image src={logo.src} alt="Talent Bridge" width={logo.w} height={logo.h} className={cn("h-11 w-auto", dark && "rounded-md")} />
              <button onClick={() => setMobile(false)} aria-label="Fermer"><X className="h-6 w-6" /></button>
            </div>
            {nav(false)}
          </aside>
        </div>
      )}

      <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-64")}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur sm:px-6">
          <button className="rounded-lg p-2 hover:bg-mist lg:hidden" onClick={() => setMobile(true)} aria-label="Ouvrir le menu"><Menu className="h-5 w-5" /></button>
          {orgs.length > 0 && (
            <label className="flex min-w-0 items-center gap-2 text-sm">
              <span className="sr-only">Organisation active</span>
              <Building2 className="hidden h-4 w-4 text-slate sm:block" />
              <select
                value={activeOrgId ?? ""}
                onChange={async (e) => {
                  await api("/api/v1/auth/switch-org", { body: { organizationId: e.target.value } });
                  router.push("/organisation");
                  router.refresh();
                }}
                className="max-w-[46vw] truncate rounded-lg border border-line bg-white px-2 py-1.5 text-sm font-semibold sm:max-w-xs"
              >
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Link href="/notifications" className="relative rounded-xl p-2 hover:bg-mist" aria-label={`Notifications${unread ? ` (${unread} non lues)` : ""}`}>
              <Bell className="h-5 w-5" />
              {unread > 0 && <span className="absolute right-1 top-1 min-w-4 rounded-full bg-orange-600 px-1 text-center text-[10px] font-bold leading-4 text-white">{unread > 99 ? "99+" : unread}</span>}
            </Link>
            <Link href="/messages" className="rounded-xl p-2 hover:bg-mist" aria-label="Messages"><MessageSquare className="h-5 w-5" /></Link>
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-2 py-1 hover:bg-mist">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-bordeaux-100 text-xs font-bold text-bordeaux-700">{user.firstName[0]}{user.lastName[0]}</span>
                <span className="hidden text-sm font-semibold sm:block">{user.firstName}</span>
              </summary>
              <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-line bg-white p-2 shadow-lift">
                <p className="truncate px-3 py-2 text-xs text-slate">{user.email}</p>
                <Link href="/parametres" className="block rounded-lg px-3 py-2 text-sm hover:bg-mist">Paramètres du compte</Link>
                <Link href="/facturation" className="block rounded-lg px-3 py-2 text-sm hover:bg-mist">Abonnement et factures</Link>
                <Link href="/" className="block rounded-lg px-3 py-2 text-sm hover:bg-mist">Site public</Link>
                <button
                  type="button"
                  onClick={async () => {
                    await api("/api/v1/auth/logout", { body: {} });
                    router.push("/");
                    router.refresh();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" /> Déconnexion
                </button>
              </div>
            </details>
          </div>
        </header>
        {banner}
        <main id="contenu" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
