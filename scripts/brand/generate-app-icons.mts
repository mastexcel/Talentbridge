/**
 * Icônes de l'application installable (PWA) : pont du logo officiel (tb-pictogramme.png, dessin
 * inchangé) centré sur fond blanc. Déclinaison « maskable » avec la marge de sécurité Android (zone
 * utile de 60 %). Usage : npx tsx scripts/brand/generate-app-icons.mts
 */
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const SRC = "public/brand/tb-pictogramme.png";
const OUT = "public/app";
mkdirSync(OUT, { recursive: true });

async function icon(size: number, ratio: number, file: string) {
  const w = Math.round(size * ratio);
  const picto = await sharp(SRC).resize({ width: w, kernel: "lanczos3" }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: "#ffffff" } })
    .composite([{ input: picto, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(`${OUT}/${file}`);
  console.log(`✔ ${OUT}/${file}`);
}

await icon(192, 0.8, "icon-192.png");
await icon(512, 0.8, "icon-512.png");
await icon(512, 0.6, "icon-maskable-512.png");
// src/app/favicon.ico (16, 32, 48 px) est dérivé de icon-512.png :
// python3 -c "from PIL import Image; Image.open('public/app/icon-512.png').save('src/app/favicon.ico', sizes=[(16,16),(32,32),(48,48)])"
