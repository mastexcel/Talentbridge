/**
 * Prestataire SIMULÉ (développement, tests, démo). La « page de paiement » est
 * /paiement/test/[paymentId] dans l'application ; le résultat revient par un webhook
 * signé, exactement comme avec un prestataire réel. Aucun argent ne circule.
 */
import { z } from "zod";
import { randomToken } from "../crypto";
import { signPayload, verifySignature } from "./signature";
import { WebhookVerificationError, type CreateChargeInput, type CreateChargeResult, type PaymentProvider, type ProviderEvent, type RefundInput, type RefundResult } from "./provider";

export const MOCK_SIGNATURE_HEADER = "x-talentbridge-signature";

const eventSchema = z.object({
  id: z.string().min(1),
  reference: z.string().min(1),
  status: z.enum(["PENDING", "SUCCEEDED", "FAILED"]),
  amount: z.number().int().nonnegative(),
  currency: z.string().length(3),
  failure_reason: z.string().optional(),
});

export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";
  readonly isTest = true;
  readonly methods = ["MOBILE_MONEY", "CARD"] as const;
  constructor(private readonly secret: string) {}

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    return { providerRef: `mock_${input.paymentId}`, redirectUrl: `/paiement/test/${input.paymentId}` };
  }

  async parseWebhook(rawBody: string, headers: Headers): Promise<ProviderEvent> {
    verifySignature(this.secret, rawBody, headers.get(MOCK_SIGNATURE_HEADER));
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      throw new WebhookVerificationError("Corps JSON invalide.");
    }
    const e = eventSchema.parse(json);
    return {
      eventId: e.id,
      providerRef: e.reference,
      status: e.status,
      amountMinor: e.amount,
      currency: e.currency,
      failureReason: e.failure_reason,
      sanitized: { id: e.id, reference: e.reference, status: e.status, amount: e.amount, currency: e.currency },
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    return { providerRefundRef: `mockrf_${input.refundId}`, status: "SUCCEEDED" };
  }

  /** Construit un webhook signé (utilisé par le simulateur et les tests). */
  buildWebhook(event: { reference: string; status: "SUCCEEDED" | "FAILED"; amountMinor: number; currency: string; failureReason?: string }) {
    const body = JSON.stringify({
      id: `evt_${randomToken(12)}`,
      reference: event.reference,
      status: event.status,
      amount: event.amountMinor,
      currency: event.currency,
      ...(event.failureReason ? { failure_reason: event.failureReason } : {}),
    });
    return { body, headers: new Headers({ [MOCK_SIGNATURE_HEADER]: signPayload(this.secret, body), "content-type": "application/json" }) };
  }
}
