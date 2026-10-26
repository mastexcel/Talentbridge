/**
 * Démo hébergée : faut-il recharger les données de démonstration au démarrage ?
 * La version attendue combine l'empreinte des scripts de seed (calculée à la construction de l'image,
 * fichier .seed-version) et celle de DEMO_PASSWORD. Elle est mémorisée dans system_settings.
 *   node scripts/demo-seed-state.mjs check  → code 0 si à jour, 1 si un seed est nécessaire
 *   node scripts/demo-seed-state.mjs mark   → mémorise la version après un seed réussi
 * Script Node pur (sans tsx) pour rester rapide au démarrage.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const KEY = "demo_seed_version";
const files = readFileSync(new URL("../.seed-version", import.meta.url), "utf8").trim();
const expected = createHash("sha256").update(files).update(process.env.DEMO_PASSWORD ?? "").digest("hex");

const prisma = new PrismaClient();
try {
  if (process.argv[2] === "mark") {
    await prisma.systemSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: expected, description: "Démo hébergée : version des données de démonstration chargées" }, update: { value: expected } });
    process.exitCode = 0;
  } else {
    const row = await prisma.systemSetting.findUnique({ where: { key: KEY } }).catch(() => null);
    process.exitCode = row?.value === expected ? 0 : 1;
  }
} finally {
  await prisma.$disconnect();
}
