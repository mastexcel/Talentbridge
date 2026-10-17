/**
 * Abstraction des prestataires de paiement (adaptateurs).
 * Talent Bridge ne voit ni ne stocke JAMAIS de données de carte : le prestataire héberge
 * la saisie (redirection) et ne renvoie que des références. Un paiement n'est confirmé
 * QUE par un webhook signé vérifié côté serveur.
 *
 * Adaptateurs prévus (à brancher avec les identifiants officiels, cf. docs/PAYMENTS.md) :
 *  - mock           : simulateur local/test (refusé en production sauf démo explicite)
 *  - bank_transfer  : virement — confirmation manuelle par la finance, tracée dans l'audit
 *  - cinetpay, paydunya, flutterwave, wave, orange_money… : à implémenter sur cette interface
 */
export type ProviderPaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED";
export type PaymentMethod = "MOBILE_MONEY" | "CARD" | "BANK_TRANSFER";

export interface CreateChargeInput {
  paymentId: string;
  amountMinor: number;
  currency: string;
  method: PaymentMethod;
  payerPhone?: string | null;
  description: string;
  returnUrl: string;
  notifyUrl: string;
}

export interface CreateChargeResult {
  providerRef: string;
  /** Page de paiement hébergée par le prestataire (ou instructions de virement) */
  redirectUrl: string;
  instructions?: string;
}

export interface ProviderEvent {
  eventId: string;
  providerRef: string;
  status: ProviderPaymentStatus;
  amountMinor: number;
  currency: string;
  failureReason?: string;
  /** Charge utile assainie, conservée pour audit */
  sanitized: Record<string, unknown>;
}

export interface RefundInput {
  providerRef: string;
  amountMinor: number;
  refundId: string;
  reason: string;
}

export interface RefundResult {
  providerRefundRef: string;
  status: "SUCCEEDED" | "PENDING" | "FAILED";
}

export interface PaymentProvider {
  readonly name: string;
  readonly isTest: boolean;
  readonly methods: readonly PaymentMethod[];
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>;
  /** Vérifie la signature et l'horodatage puis décode l'événement. Lève une erreur si invalide. */
  parseWebhook(rawBody: string, headers: Headers): Promise<ProviderEvent>;
  refund(input: RefundInput): Promise<RefundResult>;
}

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookVerificationError";
  }
}
