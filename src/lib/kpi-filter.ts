import type { KpiFilter } from "@/application/analytics.service";

/** Filtres du CEO Dashboard depuis les paramètres d'URL (période par défaut : 12 derniers mois). */
export function kpiFilterFrom(p: Record<string, string | undefined>): KpiFilter {
  const to = p.to ? new Date(`${p.to}T23:59:59Z`) : new Date();
  const from = p.from ? new Date(`${p.from}T00:00:00Z`) : new Date(to.getTime() - 365 * 86_400_000);
  return {
    from: isNaN(from.getTime()) ? new Date(Date.now() - 365 * 86_400_000) : from,
    to: isNaN(to.getTime()) ? new Date() : to,
    country: p.country && /^[A-Z]{2}$/.test(p.country) ? p.country : undefined,
    orgType: p.orgType || undefined,
    currency: p.currency && /^[A-Z]{3}$/.test(p.currency) ? p.currency : "XOF",
    includeDemo: p.demo === "1",
  };
}
