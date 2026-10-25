/**
 * Visuels officiels affichés tels que fournis (fichiers non modifiés).
 * Seules les zones interactives sont recouvertes par des éléments HTML positionnés en
 * coordonnées de l'image :
 *  - les boutons peints sont remplacés par de vrais liens ;
 *  - les chiffres peints sont remplacés par les chiffres réels de la plateforme ;
 *  - les barres de recherche peintes deviennent de vrais formulaires ;
 *  - les pastilles et cartes peintes deviennent cliquables (zones transparentes).
 * Les tailles de texte suivent la largeur du visuel (unités de conteneur) pour rester
 * alignées sur l'image à toutes les largeurs. Sous 768 px, les actions et chiffres sont
 * repris lisiblement sous le visuel.
 */
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, ClipboardList, FileText, Globe, Landmark, Search, Users } from "lucide-react";
import { cn } from "./cn";

export type Box = readonly [x: number, y: number, w: number, h: number];
export type StatIcon = "users" | "building" | "missions" | "globe" | "file" | "landmark";
export type StatItem = { icon: StatIcon; value: string; label: string; color: "bordeaux" | "orange" | "olive" };

export type Overlay =
  | { kind: "button"; box: Box; href: string; label: string; tone: "orange" | "outline" | "bordeaux"; font?: number }
  | { kind: "link"; box: Box; href: string; label: string }
  | { kind: "stats"; box: Box; items: StatItem[]; tone: "light" | "dark" | "band"; layout?: "row" | "column"; font?: number; demo?: boolean }
  | { kind: "search"; box: Box; action: string; placeholder: string; font?: number };

export interface VisualDef {
  src: string;
  width: number;
  height: number;
  alt: string;
  overlays: Overlay[];
}

const ICONS = { users: Users, building: Building2, missions: ClipboardList, globe: Globe, file: FileText, landmark: Landmark } as const;
const ICON_COLOR = { bordeaux: "text-bordeaux-700", orange: "text-orange-600", olive: "text-olive-700" } as const;
const VALUE_COLOR = { bordeaux: "text-bordeaux-700", orange: "text-orange-600", olive: "text-olive-700" } as const;

/** Taille exprimée en pixels de l'image d'origine, convertie à la largeur affichée. */
const px = (n: number) => `calc(var(--px) * ${n})`;

function place(box: Box, w: number, h: number): React.CSSProperties {
  const [x, y, bw, bh] = box;
  return { left: `${(x / w) * 100}%`, top: `${(y / h) * 100}%`, width: `${(bw / w) * 100}%`, height: `${(bh / h) * 100}%` };
}

function Stats({ o }: { o: Extract<Overlay, { kind: "stats" }> }) {
  const font = o.font ?? 30;
  const column = o.layout === "column";
  const light = o.tone === "light";
  return (
    <div
      className={cn(
        "flex",
        column ? "flex-col justify-around" : "items-center justify-around",
        o.tone === "light" && "bg-white shadow-[0_2px_12px_rgba(23,33,43,0.08)]",
        o.tone === "dark" && "bg-[#30020a]",
        o.tone === "band" && "bg-[#6b0514]",
      )}
      style={{ borderRadius: px(o.tone === "light" ? 22 : 16), padding: column ? `${px(10)} ${px(18)}` : `0 ${px(14)}`, gap: px(10) }}
    >
      {o.items.map((it, i) => {
        const Icon = ICONS[it.icon];
        return (
          <div key={it.label} className={cn("flex min-w-0 items-center", !column && i > 0 && (light ? "border-l border-line" : "border-l border-white/25"))} style={{ gap: px(12), paddingLeft: !column && i > 0 ? px(14) : undefined }}>
            <span
              className={cn("flex shrink-0 items-center justify-center rounded-full", column ? "text-white" : light ? ICON_COLOR[it.color] : "text-orange-400", column && (it.color === "bordeaux" ? "bg-bordeaux-700" : it.color === "orange" ? "bg-orange-600" : "bg-olive-700"))}
              style={{ width: px(column ? 68 : 54), height: px(column ? 68 : 54) }}
              aria-hidden
            >
              <Icon style={{ width: px(column ? 34 : 46), height: px(column ? 34 : 46) }} strokeWidth={1.6} />
            </span>
            <span className="min-w-0 leading-tight">
              <span className={cn("block font-display font-extrabold tabular-nums", light ? VALUE_COLOR[it.color] : "text-white")} style={{ fontSize: px(font) }}>{it.value}</span>
              <span className={cn("block", light ? "text-ink/80" : "text-white/85")} style={{ fontSize: px(font * 0.58) }}>{it.label}</span>
            </span>
          </div>
        );
      })}
      {o.demo && (
        <span className="absolute rounded-full bg-amber-100 font-semibold text-amber-900" style={{ right: px(10), top: px(-12), fontSize: px(13), padding: `${px(2)} ${px(10)}` }}>
          Démo
        </span>
      )}
    </div>
  );
}

function OverlayEl({ o }: { o: Overlay }) {
  switch (o.kind) {
    case "button": {
      const font = o.font ?? 20;
      return (
        <Link
          href={o.href}
          className={cn(
            "flex h-full w-full items-center justify-center rounded-full font-semibold shadow-sm outline-offset-2 transition hover:brightness-110 focus-visible:outline-3 focus-visible:outline-orange-400",
            o.tone === "orange" && "bg-[#f26a1b] text-white",
            o.tone === "bordeaux" && "bg-bordeaux-800 text-white",
            o.tone === "outline" && "border-2 border-white bg-[#3a050d] text-white",
          )}
          style={{ fontSize: px(font), gap: px(14) }}
        >
          {o.label} <ArrowRight style={{ width: px(font * 1.1), height: px(font * 1.1) }} aria-hidden />
        </Link>
      );
    }
    case "link":
      return <Link href={o.href} aria-label={o.label} title={o.label} className="block h-full w-full rounded-2xl transition hover:bg-white/15 focus-visible:outline-3 focus-visible:outline-orange-500" />;
    case "stats":
      return <Stats o={o} />;
    case "search": {
      const font = o.font ?? 20;
      return (
        <form action={o.action} role="search" className="flex h-full w-full items-center rounded-full bg-white shadow-[0_4px_18px_rgba(23,33,43,0.12)]" style={{ paddingLeft: px(26), paddingRight: px(8), gap: px(14) }}>
          <Search className="shrink-0 text-ink/70" style={{ width: px(30), height: px(30) }} aria-hidden />
          <label className="sr-only" htmlFor={`q-${o.action}`}>{o.placeholder}</label>
          <input id={`q-${o.action}`} name="q" placeholder={o.placeholder} className="h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-slate" style={{ fontSize: px(font) }} />
          <button type="submit" className="flex shrink-0 items-center justify-center rounded-full bg-[#f26a1b] text-white hover:brightness-110" style={{ width: px(76), height: "80%" }} aria-label="Rechercher">
            <Search style={{ width: px(30), height: px(30) }} aria-hidden />
          </button>
        </form>
      );
    }
  }
}

/** Reprise lisible des actions et chiffres sous le visuel (écrans étroits). */
function MobileExtras({ def }: { def: VisualDef }) {
  const buttons = def.overlays.filter((o): o is Extract<Overlay, { kind: "button" }> => o.kind === "button");
  const stats = def.overlays.filter((o): o is Extract<Overlay, { kind: "stats" }> => o.kind === "stats");
  const search = def.overlays.find((o): o is Extract<Overlay, { kind: "search" }> => o.kind === "search");
  if (!buttons.length && !stats.length && !search) return null;
  return (
    <div className="space-y-4 px-4 py-5 md:hidden">
      {search && (
        <form action={search.action} role="search" className="flex gap-2 rounded-2xl border border-line bg-white p-2">
          <label className="sr-only" htmlFor={`qm-${search.action}`}>{search.placeholder}</label>
          <input id={`qm-${search.action}`} name="q" placeholder={search.placeholder} className="h-11 min-w-0 flex-1 rounded-xl px-3 outline-none" />
          <button className="rounded-xl bg-orange-600 px-4 text-white" aria-label="Rechercher"><Search className="h-4 w-4" /></button>
        </form>
      )}
      {stats.map((s, i) => (
        <dl key={i} className="grid grid-cols-2 gap-3">
          {s.items.map((it) => (
            <div key={it.label} className="rounded-xl border border-line bg-white p-3 text-center">
              <dt className="text-xs text-slate">{it.label}</dt>
              <dd className={cn("font-display text-2xl font-extrabold", VALUE_COLOR[it.color])}>{it.value}</dd>
            </div>
          ))}
        </dl>
      ))}
      {stats.some((s) => s.demo) && <p className="text-center text-xs text-slate">Environnement de démonstration : chiffres calculés sur des données fictives.</p>}
      {buttons.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {buttons.map((b) => (
            <Link key={b.href + b.label} href={b.href} className={cn("inline-flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold", b.tone === "outline" ? "border-2 border-bordeaux-700 text-bordeaux-700" : b.tone === "bordeaux" ? "bg-bordeaux-800 text-white" : "bg-orange-600 text-white")}>
              {b.label} <ArrowRight className="h-4 w-4" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function Visual({ def, priority, className, rounded = true }: { def: VisualDef; priority?: boolean; className?: string; rounded?: boolean }) {
  return (
    <div className={className}>
      <div className={cn("relative w-full overflow-hidden [container-type:inline-size]", rounded && "rounded-3xl shadow-card")} style={{ aspectRatio: `${def.width} / ${def.height}` }}>
        <Image src={def.src} alt={def.alt} fill priority={priority} sizes="(min-width: 1774px) 1774px, 100vw" className="object-contain" />
        <div className="absolute inset-0" style={{ ["--px" as string]: `calc(100cqw / ${def.width})` }}>
          {def.overlays.map((o, i) => (
            // Toujours affichés, même en petit : ils masquent les boutons et chiffres peints.
            <div key={i} className="absolute" style={place(o.box, def.width, def.height)}>
              <div className="relative h-full w-full [&>*]:h-full">
                <OverlayEl o={o} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <MobileExtras def={def} />
    </div>
  );
}
