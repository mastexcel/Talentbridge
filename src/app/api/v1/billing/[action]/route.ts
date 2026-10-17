import { z } from "zod";
import { actions, defineAction } from "@/infrastructure/http/actions";
import { cancelSubscription, changePlan, requestRefund, simulateMockPayment, startPayment, subscribe } from "@/application/billing.service";
import { refundRequestSchema, subscribeSchema } from "@/application/schemas";
import { toMinor } from "@/domain/money";
import { prisma } from "@/infrastructure/db";

const method = z.enum(["MOBILE_MONEY", "CARD", "BANK_TRANSFER"]);

export const POST = actions<{ action: string }>({
  subscribe: defineAction({ schema: subscribeSchema, rateLimit: { limit: 20, windowMs: 3600_000 }, run: async ({ user }, b) => subscribe(user, b) }),
  pay: defineAction({ schema: z.object({ invoiceId: z.string().min(1), method, payerPhone: z.string().max(30).optional().nullable() }), run: async ({ user }, b) => startPayment(user, b.invoiceId, b.method, b.payerPhone ?? null) }),
  cancel: defineAction({ schema: z.object({ subscriptionId: z.string().min(1) }), run: async ({ user }, b) => cancelSubscription(user, b.subscriptionId) }),
  "change-plan": defineAction({ schema: z.object({ subscriptionId: z.string().min(1), priceId: z.string().min(1), method }), run: async ({ user }, b) => changePlan(user, b.subscriptionId, b.priceId, b.method) }),
  refund: defineAction({
    schema: refundRequestSchema.extend({ paymentId: z.string().min(1) }),
    run: async ({ user }, b) => {
      const p = await prisma.payment.findUniqueOrThrow({ where: { id: b.paymentId }, select: { currency: true } });
      return requestRefund(user, b.paymentId, toMinor(b.amount, p.currency), b.reason);
    },
  }),
  /** Simulateur de paiement : uniquement pour le prestataire « mock » (test), refusé sinon. */
  simulate: defineAction({ schema: z.object({ paymentId: z.string().min(1), outcome: z.enum(["SUCCEEDED", "FAILED"]) }), run: async ({ user }, b) => {
    const r = await simulateMockPayment(user, b.paymentId, b.outcome);
    const p = await prisma.payment.findUniqueOrThrow({ where: { id: b.paymentId }, select: { invoiceId: true } });
    return { ...r, redirectUrl: `/facturation/factures/${p.invoiceId}` };
  } }),
});
