import Image from "next/image";
import Link from "next/link";

/**
 * Logos officiels, utilisés tels que fournis (fichiers non modifiés) :
 *  - light : fond blanc, pour les fonds clairs ;
 *  - dark  : cartouche bordeaux, pour les fonds sombres.
 */
export const LOGO_FILES = {
  light: { src: "/brand/logo-talent-bridge.png", w: 2172, h: 724 },
  dark: { src: "/brand/logo-talent-bridge-bordeaux.png", w: 2172, h: 724 },
} as const;

export function Logo({ variant = "light", className, href = "/" }: { variant?: keyof typeof LOGO_FILES; className?: string; href?: string | null }) {
  const f = LOGO_FILES[variant];
  const img = <Image src={f.src} alt="Talent Bridge" width={f.w} height={f.h} className={className ?? "h-12 w-auto"} priority />;
  return href ? (
    <Link href={href} aria-label="Talent Bridge — accueil" className="inline-flex shrink-0 items-center">
      {img}
    </Link>
  ) : (
    img
  );
}
