/**
 * CEO Dashboard — indicateurs stratégiques.
 * Chaque KPI est calculé par une requête documentée sur les données réelles (cf. docs/KPI.md).
 * Les données de démonstration (`isDemo`) sont EXCLUES par défaut et ne sont incluses que
 * si le filtre « inclure la démo » est activé explicitement (bandeau affiché).
 */
import type { Prisma } from "@prisma/client";
import { prisma, type Db } from "@/infrastructure/db";
import { financeDashboard } from "./finance.service";

export interface KpiFilter {
  from: Date;
  to: Date;
  country?: string;
  orgType?: string;
  currency: string;
  includeDemo: boolean;
}

const demo = (f: KpiFilter) => (f.includeDemo ? {} : { isDemo: false });

export async function ceoKpis(f: KpiFilter, db: Db = prisma) {
  const period = { gte: f.from, lte: f.to };
  const userWhere: Prisma.UserWhereInput = { status: { not: "DELETED" }, platformRole: "USER", ...demo(f) };
  const expertWhere: Prisma.ExpertProfileWhereInput = { ...demo(f), ...(f.country ? { countryCode: f.country } : {}) };
  const orgWhere: Prisma.OrganizationWhereInput = { ...demo(f), ...(f.country ? { countryCode: f.country } : {}), ...(f.orgType ? { type: f.orgType as "NGO" } : {}) };
  const missionWhere: Prisma.MissionWhereInput = { ...demo(f), ...(f.country ? { countryCode: f.country } : {}), ...(f.orgType ? { organization: { type: f.orgType as "NGO" } } : {}) };
  const now = new Date();

  const [
    totalUsers, experts, verifiedExperts, organizations, payingOrgs, payingExperts, activeSubs,
    missionsPublished, missionsAwarded, newUsersPeriod, reviewsAgg, subsDueInPeriod, subsRenewed, appsInPeriod, signupsByMonthRaw,
    expertsByCountry, orgsByType, funnelSignups, funnelProfiles, funnelApplied, funnelContracted,
  ] = await Promise.all([
    db.user.count({ where: userWhere }),
    db.expertProfile.count({ where: expertWhere }),
    db.expertProfile.count({ where: { ...expertWhere, badges: { some: { revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } } } }),
    db.organization.count({ where: orgWhere }),
    db.organization.count({ where: { ...orgWhere, subscriptions: { some: { status: "ACTIVE", price: { amountMinor: { gt: 0 } } } } } }),
    db.user.count({ where: { ...userWhere, subscriptions: { some: { status: "ACTIVE", price: { amountMinor: { gt: 0 } } } } } }),
    db.subscription.count({ where: { status: "ACTIVE", ...demo(f) } }),
    db.mission.count({ where: { ...missionWhere, publishedAt: period } }),
    db.contract.count({ where: { createdAt: period, mission: missionWhere } }),
    db.user.count({ where: { ...userWhere, createdAt: period } }),
    db.review.aggregate({ where: { createdAt: period, expert: demo(f) }, _avg: { rating: true }, _count: true }),
    db.subscription.count({ where: { ...demo(f), plan: { isRecurring: true }, OR: [{ renewalCount: { gt: 0 } }, { status: { in: ["EXPIRED", "CANCELLED"] }, currentPeriodEnd: period }] } }),
    db.subscription.count({ where: { ...demo(f), renewalCount: { gt: 0 } } }),
    db.application.findMany({ where: { createdAt: period, mission: missionWhere }, select: { status: true } }),
    db.user.findMany({ where: { ...userWhere, createdAt: period }, select: { createdAt: true, expertProfile: { select: { id: true } } } }),
    db.expertProfile.groupBy({ by: ["countryCode"], where: expertWhere, _count: true }),
    db.organization.groupBy({ by: ["type"], where: orgWhere, _count: true }),
    db.user.count({ where: { ...userWhere, createdAt: period, expertProfile: { isNot: null } } }),
    db.expertProfile.count({ where: { ...expertWhere, createdAt: period, completeness: { gte: 60 } } }),
    db.expertProfile.count({ where: { ...expertWhere, createdAt: period, applications: { some: {} } } }),
    db.expertProfile.count({ where: { ...expertWhere, createdAt: period, contracts: { some: {} } } }),
  ]);

  // Délai moyen de matching : publication de la mission → première candidature retenue (heures).
  const selectedEvents = await db.applicationEvent.findMany({
    where: { toStatus: "SELECTED", createdAt: period, application: { mission: { ...missionWhere, publishedAt: { not: null } } } },
    select: { createdAt: true, application: { select: { missionId: true, mission: { select: { publishedAt: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  const firstByMission = new Map<string, number>();
  for (const e of selectedEvents) {
    if (!firstByMission.has(e.application.missionId)) firstByMission.set(e.application.missionId, (e.createdAt.getTime() - e.application.mission.publishedAt!.getTime()) / 3_600_000);
  }
  const delays = [...firstByMission.values()].filter((h) => h >= 0);
  const avgMatchingHours = delays.length ? Math.round(delays.reduce((s, h) => s + h, 0) / delays.length) : null;

  const byMonth = new Map<string, { experts: number; organizations: number }>();
  for (const u of signupsByMonthRaw) {
    const m = u.createdAt.toISOString().slice(0, 7);
    const row = byMonth.get(m) ?? { experts: 0, organizations: 0 };
    if (u.expertProfile) row.experts++;
    else row.organizations++;
    byMonth.set(m, row);
  }

  const finance = await financeDashboard({ from: f.from, to: f.to, currency: f.currency, includeTest: f.includeDemo }, db);
  const appCount = appsInPeriod.length;
  const selected = appsInPeriod.filter((a) => a.status === "SELECTED" || a.status === "CONTRACTED").length;
  const payingClients = payingOrgs + payingExperts;

  return {
    totals: { totalUsers, experts, verifiedExperts, organizations, payingClients, activeSubs, missionsPublished, missionsAwarded, newUsersPeriod },
    rates: {
      // Conversion : clients payants / organisations + experts inscrits.
      conversionPct: organizations + experts ? Math.round((payingClients * 1000) / (organizations + experts)) / 10 : null,
      applicationSelectionPct: appCount ? Math.round((selected * 1000) / appCount) / 10 : null,
      renewalPct: subsDueInPeriod ? Math.round((subsRenewed * 1000) / subsDueInPeriod) / 10 : null,
      satisfaction: reviewsAgg._count ? Math.round((reviewsAgg._avg.rating ?? 0) * 10) / 10 : null,
      satisfactionCount: reviewsAgg._count,
      avgMatchingHours,
      matchingSample: delays.length,
    },
    finance,
    signupsByMonth: [...byMonth].sort().map(([month, v]) => ({ month, ...v })),
    expertsByCountry: expertsByCountry.map((r) => ({ code: r.countryCode ?? "—", count: r._count })).sort((a, b) => b.count - a.count),
    orgsByType: orgsByType.map((r) => ({ type: r.type, count: r._count })),
    funnel: [
      { step: "Inscriptions consultants", value: funnelSignups },
      { step: "Profils complétés (≥ 60 %)", value: funnelProfiles },
      { step: "Ont candidaté", value: funnelApplied },
      { step: "Ont obtenu un contrat", value: funnelContracted },
    ],
    includeDemo: f.includeDemo,
  };
}

/** Classement des organisations par missions publiées (tableau de classement). */
export async function topOrganizations(f: KpiFilter, db: Db = prisma) {
  const rows = await db.organization.findMany({
    where: { ...demo(f), ...(f.country ? { countryCode: f.country } : {}) },
    select: { name: true, type: true, countryCode: true, _count: { select: { missions: { where: { publishedAt: { gte: f.from, lte: f.to } } }, contracts: true } } },
  });
  return rows.filter((r) => r._count.missions > 0).sort((a, b) => b._count.missions - a._count.missions).slice(0, 10);
}
