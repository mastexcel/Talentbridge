/**
 * Pré-optimisation des visuels (public/visuels/*.png, fichiers d'origine non modifiés) :
 * déclinaisons WebP aux largeurs servies par le site, dans public/optimized/visuels.
 * Le site les sert directement (src/lib/image-loader.ts) : aucun calcul d'image à chaque visite,
 * ce qui garde le site rapide même sur un hébergement modeste.
 *
 * À relancer après l'ajout ou le remplacement d'un visuel : npx tsx scripts/brand/optimize-visuals.mts
 */
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { OPTIMIZED_WIDTHS } from "../../src/lib/image-loader";

const SRC = path.resolve("public/visuels");
const OUT = path.resolve("public/optimized/visuels");

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let total = 0;
for (const file of readdirSync(SRC).filter((f) => f.endsWith(".png")).sort()) {
  const name = file.replace(/\.png$/, "");
  const meta = await sharp(path.join(SRC, file)).metadata();
  for (const w of OPTIMIZED_WIDTHS) {
    const info = await sharp(path.join(SRC, file))
      .resize({ width: Math.min(w, meta.width!), kernel: "lanczos3", withoutEnlargement: true })
      .webp({ quality: 90, effort: 6, smartSubsample: true })
      .toFile(path.join(OUT, `${name}-${w}.webp`));
    total += info.size;
  }
  console.log(`✔ ${file}`);
}
console.log(`Total : ${(total / 1024 / 1024).toFixed(1)} Mo`);
