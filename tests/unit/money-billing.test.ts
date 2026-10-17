import { describe, expect, it } from "vitest";
import { addInterval, formatInvoiceNumber, invoiceStatusAfterPayment, prorationCreditMinor, reminderDue } from "@/domain/billing";
import { applyBps, couponDiscount, formatMoney, invoiceTotals, toMinor } from "@/domain/money";

describe("montants", () => {
  it("formate FCFA sans décimales et EUR en centimes", () => {
    expect(formatMoney(1_250_000, "XOF")).toBe("1 250 000 FCFA");
    expect(formatMoney(124_900, "EUR")).toMatch(/1 249,00\s?€/);
    expect(toMinor(12.5, "EUR")).toBe(1250);
    expect(toMinor(5000, "XOF")).toBe(5000);
  });
  it("calcule la TVA ligne par ligne en entiers", () => {
    const t = invoiceTotals([{ quantity: 2, unitPriceMinor: 50_000, taxRateBps: 1800 }, { quantity: 1, unitPriceMinor: 333, taxRateBps: 1800 }]);
    expect(t.subtotalMinor).toBe(100_333);
    expect(t.taxMinor).toBe(18_000 + 60);
    expect(t.totalMinor).toBe(t.subtotalMinor + t.taxMinor);
    expect(applyBps(1000, 1925)).toBe(193);
  });
  it("borne la remise d'un coupon au montant", () => {
    expect(couponDiscount(10_000, { percentOffBps: 1000 })).toBe(1000);
    expect(couponDiscount(10_000, { amountOffMinor: 50_000 })).toBe(10_000);
  });
});

describe("facturation", () => {
  it("numérote en continu", () => expect(formatInvoiceNumber("FAC", 2026, 42)).toBe("FAC-2026-000042"));
  it("gère la fin de mois pour les périodes", () => {
    expect(addInterval(new Date("2026-01-31T00:00:00Z"), "MONTH")!.toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(addInterval(new Date("2026-03-15T00:00:00Z"), "YEAR")!.toISOString().slice(0, 10)).toBe("2027-03-15");
    expect(addInterval(new Date(), "ONE_TIME")).toBeNull();
  });
  it("détermine le statut après paiement", () => {
    expect(invoiceStatusAfterPayment(1000, 0)).toBe("ISSUED");
    expect(invoiceStatusAfterPayment(1000, 400)).toBe("PARTIALLY_PAID");
    expect(invoiceStatusAfterPayment(1000, 1000)).toBe("PAID");
  });
  it("calcule le crédit au prorata", () => {
    const s = new Date("2026-01-01"), e = new Date("2026-01-31");
    expect(prorationCreditMinor(30_000, s, e, new Date("2026-01-16"))).toBe(15_000);
    expect(prorationCreditMinor(30_000, s, e, new Date("2026-02-10"))).toBe(0);
  });
  it("planifie les relances J+3, J+10, J+20", () => {
    const due = new Date("2026-01-01");
    expect(reminderDue(due, 0, new Date("2026-01-03"))).toBe(false);
    expect(reminderDue(due, 0, new Date("2026-01-04"))).toBe(true);
    expect(reminderDue(due, 3, new Date("2027-01-01"))).toBe(false);
  });
});
