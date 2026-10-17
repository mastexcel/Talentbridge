/** Règles de facturation et d'abonnement (pures). */

export type BillingInterval = "MONTH" | "YEAR" | "ONE_TIME";

/** Fin de période : même jour du mois suivant (borné au dernier jour du mois). */
export function addInterval(start: Date, interval: BillingInterval): Date | null {
  if (interval === "ONE_TIME") return null;
  const d = new Date(start);
  const months = interval === "MONTH" ? 1 : 12;
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/** Numéro de facture continu : FAC-2026-000123 (préfixe configurable). */
export function formatInvoiceNumber(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(6, "0")}`;
}

export function invoiceStatusAfterPayment(totalMinor: number, paidMinor: number): "ISSUED" | "PARTIALLY_PAID" | "PAID" {
  if (paidMinor >= totalMinor) return "PAID";
  if (paidMinor > 0) return "PARTIALLY_PAID";
  return "ISSUED";
}

/** Crédit au prorata lors d'un changement de plan en cours de période. */
export function prorationCreditMinor(pricePaidMinor: number, periodStart: Date, periodEnd: Date, now: Date): number {
  const total = periodEnd.getTime() - periodStart.getTime();
  if (total <= 0) return 0;
  const remaining = Math.max(0, Math.min(total, periodEnd.getTime() - now.getTime()));
  return Math.floor((pricePaidMinor * remaining) / total);
}

/** Échéancier de relance : J+3, J+10, J+20 après l'échéance. */
export const REMINDER_DAYS = [3, 10, 20];

export function reminderDue(dueAt: Date, remindersSent: number, now: Date): boolean {
  if (remindersSent >= REMINDER_DAYS.length) return false;
  return now.getTime() >= dueAt.getTime() + REMINDER_DAYS[remindersSent] * 86_400_000;
}

export const SERVICE_LABELS: Record<string, string> = {
  SUBSCRIPTION: "Abonnements",
  CERTIFICATION: "Certification",
  TRAINING: "Formation",
  SOURCING: "Sourcing ponctuel",
  TENDER_SUPPORT: "Accompagnement appels d'offres",
  TEAM_BUILDING: "Constitution d'équipes",
  COMMISSION: "Commissions",
};
