import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/db";
import { getMockProvider } from "@/infrastructure/payments/registry";
import { signPayload } from "@/infrastructure/payments/signature";
import { MOCK_SIGNATURE_HEADER } from "@/infrastructure/payments/mock-provider";
import { confirmBankTransfer, featureLimit, handlePaymentWebhook, processRenewals, subscribe } from "@/application/billing.service";
import { makeAdmin, makeUser, resetDb } from "./helpers";

async function priceOf(code: string, interval: "MONTH" | "YEAR" | "ONE_TIME") {
  return (await prisma.planPrice.findFirstOrThrow({ where: { plan: { code }, interval, currency: "XOF" } })).id;
}

describe("abonnements, factures et paiements", () => {
  beforeAll(resetDb);

  it("souscription en mode test : facture numérotée TTC, paiement confirmé uniquement par webhook signé", async () => {
    const org = await makeUser("COMPANY");
    const res = await subscribe(org, { priceId: await priceOf("ORG_STANDARD", "MONTH"), couponCode: null, method: "MOBILE_MONEY", payerPhone: null, forOrganization: true });
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: res.subscriptionId } });
    expect(sub.status).toBe("PENDING_PAYMENT");
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: res.invoiceId } });
    expect(inv.number).toMatch(/^FAC-\d{4}-\d{6}$/);
    expect(inv.taxMinor).toBe(Math.round(inv.subtotalMinor * 0.18)); // TVA CI 18 %
    const payment = await prisma.payment.findFirstOrThrow({ where: { invoiceId: inv.id } });
    expect(payment).toMatchObject({ status: "PENDING", isTest: true });

    // Webhook à la signature invalide : refusé, rien ne change
    const mock = getMockProvider();
    const forged = mock.buildWebhook({ reference: payment.providerRef!, status: "SUCCEEDED", amountMinor: payment.amountMinor, currency: "XOF" });
    await expect(handlePaymentWebhook("mock", forged.body, new Headers({ [MOCK_SIGNATURE_HEADER]: signPayload("mauvais-secret", forged.body) }))).rejects.toThrow();
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PENDING");

    // Webhook valide → paiement, facture payée, abonnement actif
    const hook = mock.buildWebhook({ reference: payment.providerRef!, status: "SUCCEEDED", amountMinor: payment.amountMinor, currency: "XOF" });
    await handlePaymentWebhook("mock", hook.body, hook.headers);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("SUCCEEDED");
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe("PAID");
    const active = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(active.status).toBe("ACTIVE");
    expect(active.currentPeriodEnd!.getTime()).toBeGreaterThan(Date.now());

    // Rejeu du même événement : idempotent
    await expect(handlePaymentWebhook("mock", hook.body, hook.headers)).resolves.toMatchObject({ duplicate: true });
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).paidMinor).toBe(inv.totalMinor);

    // Limites de l'offre
    expect(await featureLimit({ userId: null, organizationId: org.activeOrgId! }, "missions.active")).toBe(3);
    expect(await featureLimit({ userId: null, organizationId: org.activeOrgId! }, "crm.use")).toBe(0);
  });

  it("un montant falsifié dans le webhook ne valide pas le paiement", async () => {
    const org = await makeUser("NGO");
    const res = await subscribe(org, { priceId: await priceOf("ORG_STANDARD", "MONTH"), couponCode: null, method: "CARD", payerPhone: null, forOrganization: true });
    const payment = await prisma.payment.findFirstOrThrow({ where: { invoiceId: res.invoiceId } });
    const hook = getMockProvider().buildWebhook({ reference: payment.providerRef!, status: "SUCCEEDED", amountMinor: 1, currency: "XOF" });
    await expect(handlePaymentWebhook("mock", hook.body, hook.headers)).resolves.toMatchObject({ mismatch: true });
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("FAILED");
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id: res.subscriptionId } })).status).toBe("PENDING_PAYMENT");
  });

  it("virement : confirmé seulement par la finance, et journalisé", async () => {
    const org = await makeUser("INSTITUTION");
    const res = await subscribe(org, { priceId: await priceOf("SERVICE_SOURCING", "ONE_TIME"), couponCode: null, method: "BANK_TRANSFER", payerPhone: null, forOrganization: true });
    expect(res).toHaveProperty("instructions");
    const payment = await prisma.payment.findFirstOrThrow({ where: { invoiceId: res.invoiceId } });
    expect(payment.provider).toBe("bank_transfer");
    const notFinance = await makeAdmin(["EXPERTS_VERIFY"]);
    await expect(confirmBankTransfer(notFinance, payment.id, "VIR-1")).rejects.toThrow();
    const finance = await makeAdmin(["FINANCE_MANAGE"]);
    await confirmBankTransfer(finance, payment.id, "VIR-123");
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: res.invoiceId } })).status).toBe("PAID");
    expect(await prisma.auditLog.count({ where: { action: "payment.manual_confirm", entityId: payment.id } })).toBe(1);
  });

  it("numérotation continue et sans doublon sous concurrence", async () => {
    const users = await Promise.all([1, 2, 3, 4, 5].map(() => makeUser("EXPERT")));
    await Promise.all(users.map(async (u) => subscribe(u, { priceId: await priceOf("EXPERT_PREMIUM", "MONTH"), couponCode: null, method: "MOBILE_MONEY", payerPhone: null, forOrganization: false })));
    const numbers = (await prisma.invoice.findMany({ select: { number: true } })).map((i) => Number(i.number!.slice(-6))).sort((a, b) => a - b);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(numbers).toEqual(numbers.map((_, i) => i + 1));
  });

  it("renouvellement : facture émise à l'échéance, abonnement impayé puis expiré", async () => {
    const expert = await makeUser("EXPERT");
    const plan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { code: "EXPERT_PREMIUM" }, include: { prices: true } });
    const sub = await prisma.subscription.create({ data: { planId: plan.id, priceId: plan.prices.find((p) => p.interval === "MONTH")!.id, userId: expert.id, status: "ACTIVE", currentPeriodStart: new Date(Date.now() - 40 * 86_400_000), currentPeriodEnd: new Date(Date.now() - 86_400_000) } });
    const r = await processRenewals();
    expect(r.renewed).toBeGreaterThanOrEqual(1);
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe("PAST_DUE");
    expect(await prisma.invoice.count({ where: { subscriptionId: sub.id } })).toBe(1);
    await processRenewals(new Date(Date.now() + 20 * 86_400_000));
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe("EXPIRED");
  });

  it("coupon invalide refusé", async () => {
    const expert = await makeUser("EXPERT");
    await expect(subscribe(expert, { priceId: await priceOf("EXPERT_PREMIUM", "MONTH"), couponCode: "FAUX", method: "MOBILE_MONEY", payerPhone: null, forOrganization: false })).rejects.toThrow(/promotionnel/);
  });
});
