import { DomainError } from "@/domain/errors";
import { env } from "../env";
import { MockPaymentProvider } from "./mock-provider";
import { BankTransferProvider } from "./bank-transfer";
import type { PaymentMethod, PaymentProvider } from "./provider";

const BANK_INSTRUCTIONS =
  process.env.BANK_TRANSFER_INSTRUCTIONS ??
  "Coordonnées bancaires à configurer (variable BANK_TRANSFER_INSTRUCTIONS) avant toute utilisation réelle.";

/** Le simulateur est interdit en production, sauf démo hébergée explicitement autorisée. */
export function mockAllowed(): boolean {
  return env().NODE_ENV !== "production" || process.env.ALLOW_MOCK_PAYMENTS === "true";
}

/**
 * Registre des prestataires. Pour brancher un prestataire réel (CinetPay, PayDunya,
 * Flutterwave, Wave…), implémenter PaymentProvider et l'ajouter ici.
 */
export function getPaymentProvider(name?: string): PaymentProvider {
  const selected = name ?? env().PAYMENT_PROVIDER;
  switch (selected) {
    case "mock":
      if (!mockAllowed()) throw new DomainError("NOT_AVAILABLE", "Le paiement en ligne n'est pas encore activé : aucun prestataire réel n'est configuré. Choisissez le virement bancaire ou contactez-nous.");
      return new MockPaymentProvider(env().PAYMENT_WEBHOOK_SECRET);
    case "bank_transfer":
      return new BankTransferProvider(BANK_INSTRUCTIONS);
    default:
      throw new DomainError("NOT_AVAILABLE", `Prestataire de paiement inconnu ou non configuré : ${selected}`);
  }
}

/** Prestataire à utiliser pour un moyen de paiement donné. */
export function providerForMethod(method: PaymentMethod): PaymentProvider {
  if (method === "BANK_TRANSFER") return getPaymentProvider("bank_transfer");
  return getPaymentProvider();
}

export function getMockProvider(): MockPaymentProvider {
  return getPaymentProvider("mock") as MockPaymentProvider;
}
