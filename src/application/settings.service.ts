/** Paramètres administrables (table system_settings), avec valeurs par défaut documentées. */
import type { Prisma } from "@prisma/client";
import { prisma, type Db } from "@/infrastructure/db";
import { DEFAULT_WEIGHTS, normalizeWeights, type MatchingWeights } from "@/domain/matching";

export const SETTING_DEFAULTS = {
  "matching.weights": DEFAULT_WEIGHTS as MatchingWeights,
  "service.targetHours": 72,
  "invoice.prefix": "FAC",
  "invoice.paymentTermDays": 30,
  "commission.defaultBps": 1000,
  "seller.identity": {
    name: "Talent Bridge (raison sociale à compléter)",
    address: "Adresse à compléter",
    countryCode: "CI",
    registrationNumber: "RCCM à compléter",
    taxId: "NCC à compléter",
    taxRegime: "Régime fiscal à confirmer",
  },
  "verification.validityDays": 730,
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export async function getSetting<K extends SettingKey>(key: K, db: Db = prisma): Promise<(typeof SETTING_DEFAULTS)[K]> {
  const row = await db.systemSetting.findUnique({ where: { key } });
  return (row?.value as (typeof SETTING_DEFAULTS)[K]) ?? SETTING_DEFAULTS[key];
}

export async function setSetting(key: SettingKey, value: unknown, actorId: string | null, db: Db = prisma) {
  await db.systemSetting.upsert({
    where: { key },
    create: { key, value: value as Prisma.InputJsonValue, updatedById: actorId },
    update: { value: value as Prisma.InputJsonValue, updatedById: actorId },
  });
}

export async function getMatchingWeights(db: Db = prisma): Promise<MatchingWeights> {
  return normalizeWeights(await getSetting("matching.weights", db));
}
