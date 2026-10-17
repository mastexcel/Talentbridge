/**
 * Montants en unités mineures entières (pas de flottants dans les calculs financiers).
 * XOF/XAF : 0 décimale ; EUR/USD : 2.
 */
export const MINOR_UNITS: Record<string, number> = { XOF: 0, XAF: 0, GNF: 0, RWF: 0, EUR: 2, USD: 2, GHS: 2, NGN: 2, KES: 2, MAD: 2, ZAR: 2 };

export function minorUnits(currency: string): number {
  return MINOR_UNITS[currency] ?? 2;
}

/** Montant mineur → texte localisé (« 1 250 000 FCFA », « 1 250,00 € »). */
export function formatMoney(amountMinor: number | null | undefined, currency: string, locale = "fr-FR"): string {
  if (amountMinor === null || amountMinor === undefined) return "—";
  const digits = minorUnits(currency);
  const value = amountMinor / 10 ** digits;
  if (currency === "XOF" || currency === "XAF") {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value).replace(/ /g, " ")} FCFA`;
  }
  return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value).replace(/ /g, " ");
}

/** Saisie utilisateur (unité principale) → mineur. */
export function toMinor(amount: number, currency: string): number {
  return Math.round(amount * 10 ** minorUnits(currency));
}

export function fromMinor(amountMinor: number, currency: string): number {
  return amountMinor / 10 ** minorUnits(currency);
}

/** Pourcentage en points de base, arrondi au plus proche (demi vers le haut). */
export function applyBps(amountMinor: number, bps: number): number {
  return Math.round((amountMinor * bps) / 10_000);
}

export interface LineInput {
  quantity: number;
  unitPriceMinor: number;
  taxRateBps: number;
}

/** Totaux de facture : HT ligne par ligne, TVA calculée par ligne puis sommée. */
export function invoiceTotals(lines: LineInput[]) {
  let subtotal = 0;
  let tax = 0;
  const computed = lines.map((l) => {
    const total = l.quantity * l.unitPriceMinor;
    subtotal += total;
    tax += applyBps(total, l.taxRateBps);
    return { ...l, totalMinor: total };
  });
  return { lines: computed, subtotalMinor: subtotal, taxMinor: tax, totalMinor: subtotal + tax };
}

/** Remise d'un coupon (pourcentage OU montant fixe), jamais supérieure au montant. */
export function couponDiscount(amountMinor: number, coupon: { percentOffBps?: number | null; amountOffMinor?: number | null }): number {
  if (coupon.percentOffBps) return Math.min(amountMinor, applyBps(amountMinor, coupon.percentOffBps));
  if (coupon.amountOffMinor) return Math.min(amountMinor, coupon.amountOffMinor);
  return 0;
}
