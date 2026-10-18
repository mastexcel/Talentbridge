import Image from "next/image";
import Link from "next/link";
import { cn } from "./cn";

/**
 * Logo officiel, déclinaisons générées par scripts/brand/generate_brand_assets.py à partir des
 * fichiers fournis (docs/brand-sources) : dessin inchangé, fond transparent, marges retirées.
 *  - light : fonds clairs ; dark : fonds sombres (issu du cartouche bordeaux, sans contour noir).
 *  - Le slogan, illisible une fois réduit dans une image, est composé en texte (net à toute taille)
 *    et n'apparaît que là où la place le permet (`tagline`).
 * Les PNG sont servis tels quels (pas de recompression), en haute définition pour les écrans Retina.
 */
export const LOGO_FILES = {
  light: { src: "/brand/tb-wordmark.png", w: 1400, h: 281 },
  dark: { src: "/brand/tb-wordmark-inverse.png", w: 1400, h: 267 },
  pictogram: { src: "/brand/tb-pictogramme.png", w: 801, h: 428 },
} as const;

export const TAGLINE = ["Connecter les experts.", "Transformer les compétences en résultats."] as const;

export function Tagline({ variant = "light", className }: { variant?: "light" | "dark"; className?: string }) {
  return (
    <span className={cn("block text-center font-medium uppercase leading-snug", variant === "dark" ? "text-white/90" : "text-[#3B4450]", className)} style={{ letterSpacing: "0.16em" }}>
      <span className="block">{TAGLINE[0]}</span>
      <span className="block">{TAGLINE[1]}</span>
    </span>
  );
}

export function Logo({
  variant = "light",
  className,
  href = "/",
  tagline = false,
  taglineClassName,
  priority = true,
}: {
  variant?: "light" | "dark";
  /** Classes de l'image (hauteur notamment) */
  className?: string;
  href?: string | null;
  /** Affiche le slogan sous le logo (texte net) */
  tagline?: boolean;
  taglineClassName?: string;
  priority?: boolean;
}) {
  const f = LOGO_FILES[variant];
  const content = (
    <span className="inline-flex flex-col items-center">
      <Image src={f.src} alt="Talent Bridge" width={f.w} height={f.h} unoptimized priority={priority} className={className ?? "h-10 w-auto"} />
      {tagline && <Tagline variant={variant} className={cn("mt-1.5 text-[10px]", taglineClassName)} />}
    </span>
  );
  return href ? (
    <Link href={href} aria-label="Talent Bridge — accueil" className="inline-flex shrink-0 items-center">
      {content}
    </Link>
  ) : (
    content
  );
}
