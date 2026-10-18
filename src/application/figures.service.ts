/**
 * Chiffres affichés sur les visuels du site (bandeaux « experts vérifiés », « organisations »,
 * « missions réalisées », « pays couverts », appels d'offres…). Calculés en direct sur la base :
 * aucun chiffre n'est saisi à la main. Hors production (ou démo hébergée explicite), les données
 * fictives sont comptées et `isDemo` le signale pour que l'interface affiche le marqueur « Démo ».
 */
import { prisma, type Db } from "@/infrastructure/db";
import { demoAllowed } from "@/infrastructure/env";

export interface PublicFigures {
  expertsVerified: number;
  organizations: number;
  missionsCompleted: number;
  countries: number;
  tenders: number;
  tenderBuyers: number;
  tenderCountries: number;
  isDemo: boolean;
}

export async function publicFigures(includeDemo = demoAllowed(), db: Db = prisma): Promise<PublicFigures> {
  const real = includeDemo ? {} : { isDemo: false };
  const now = new Date();
  const [expertsVerified, organizations, missionsCompleted, expertCountries, orgCountries, tenders, buyers, tenderCountries] = await Promise.all([
    db.expertProfile.count({ where: { ...real, badges: { some: { revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } } } }),
    db.organization.count({ where: { ...real, status: "VERIFIED" } }),
    db.contract.count({ where: { status: "COMPLETED", mission: real } }),
    db.expertProfile.groupBy({ by: ["countryCode"], where: { ...real, countryCode: { not: null } } }),
    db.organization.groupBy({ by: ["countryCode"], where: { ...real, status: "VERIFIED" } }),
    db.tender.count({ where: { ...real, status: { not: "CANCELLED" } } }),
    db.tender.groupBy({ by: ["buyerName"], where: { ...real, status: { not: "CANCELLED" } } }),
    db.tender.groupBy({ by: ["countryCode"], where: { ...real, status: { not: "CANCELLED" } } }),
  ]);
  const countries = new Set([...expertCountries.map((r) => r.countryCode), ...orgCountries.map((r) => r.countryCode)].filter(Boolean));
  return {
    expertsVerified,
    organizations,
    missionsCompleted,
    countries: countries.size,
    tenders,
    tenderBuyers: buyers.length,
    tenderCountries: tenderCountries.length,
    isDemo: includeDemo,
  };
}
