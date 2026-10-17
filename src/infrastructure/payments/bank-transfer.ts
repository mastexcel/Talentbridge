/**
 * Virement bancaire : pas de webhook. Le paiement reste PENDING jusqu'au rapprochement
 * manuel par un administrateur FINANCE_MANAGE (action journalisée), cf. payment.service.
 */
import { WebhookVerificationError, type CreateChargeInput, type CreateChargeResult, type PaymentProvider, type ProviderEvent, type RefundInput, type RefundResult } from "./provider";

export class BankTransferProvider implements PaymentProvider {
  readonly name = "bank_transfer";
  readonly isTest = false;
  readonly methods = ["BANK_TRANSFER"] as const;
  constructor(private readonly instructions: string) {}

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    return {
      providerRef: `vir_${input.paymentId}`,
      redirectUrl: input.returnUrl,
      instructions: `${this.instructions}\nRéférence à indiquer sur le virement : ${input.paymentId}`,
    };
  }

  async parseWebhook(): Promise<ProviderEvent> {
    throw new WebhookVerificationError("Le virement bancaire ne reçoit pas de webhook.");
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    return { providerRefundRef: `virrf_${input.refundId}`, status: "PENDING" };
  }
}
