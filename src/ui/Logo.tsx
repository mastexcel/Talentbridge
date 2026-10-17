import Image from "next/image";
import Link from "next/link";

/** Logo officiel (fichiers fournis, non redessinés). */
export function Logo({ variant = "compact", className, href = "/" }: { variant?: "compact" | "dark" | "main" | "icon" | "vertical" | "mono"; className?: string; href?: string | null }) {
  const files = {
    compact: { src: "/brand/logo-wordmark.png", w: 1123, h: 207 },
    main: { src: "/brand/logo-main.png", w: 1123, h: 286 },
    dark: { src: "/brand/logo-dark.png", w: 674, h: 204 },
    icon: { src: "/brand/logo-icon.png", w: 320, h: 182 },
    vertical: { src: "/brand/logo-vertical.png", w: 375, h: 257 },
    mono: { src: "/brand/logo-mono.png", w: 579, h: 155 },
  } as const;
  const f = files[variant];
  const img = <Image src={f.src} alt="Talent Bridge" width={f.w} height={f.h} className={className ?? "h-9 w-auto"} priority />;
  return href ? (
    <Link href={href} aria-label="Talent Bridge — accueil" className="inline-flex shrink-0 items-center">
      {img}
    </Link>
  ) : (
    img
  );
}
