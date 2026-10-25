/**
 * Loader d'images du site (next.config.ts › images.loaderFile).
 * Les visuels (/visuels/*.png) sont servis depuis leurs déclinaisons WebP pré-calculées
 * (scripts/brand/optimize-visuals.mts) : la largeur demandée par le navigateur est arrondie
 * à la déclinaison supérieure. Les autres images sont servies telles quelles.
 */
export const OPTIMIZED_WIDTHS = [640, 1080, 1920] as const;

export default function imageLoader({ src, width }: { src: string; width: number; quality?: number }): string {
  const m = /^\/visuels\/([\w-]+)\.png$/.exec(src);
  if (!m) return src;
  const w = OPTIMIZED_WIDTHS.find((x) => x >= width) ?? OPTIMIZED_WIDTHS[OPTIMIZED_WIDTHS.length - 1];
  return `/optimized/visuels/${m[1]}-${w}.webp`;
}
