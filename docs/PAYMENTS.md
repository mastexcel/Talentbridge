# Paiements

## Principes (non négociables)

1. **Aucun paiement n'est marqué réussi sans confirmation** : soit un webhook du prestataire dont la **signature HMAC et l'horodatage (±5 min)** sont vérifiés, soit — pour un virement — la validation manuelle d'un administrateur `FINANCE_MANAGE`, tracée dans le journal d'audit.
2. **Montant et devise contrôlés** : un webhook « réussi » dont le montant ou la devise diffère du paiement attendu passe le paiement en échec et est journalisé (`payment.mismatch`).
3. **Idempotence** : chaque événement est enregistré dans `payment_events` (unicité prestataire + identifiant d'événement) ; un rejeu est ignoré. Côté client, la souscription et le paiement portent une clé `Idempotency-Key` (un double clic ne crée pas deux factures).
4. **Aucune donnée de carte** ne transite ni n'est stockée : la saisie est hébergée par le prestataire.
5. **Aucun tarif codé en dur** : offres, prix (multi-devises), limites, coupons et TVA sont en base, administrables dans `/admin/offres` (offres, prix, coupons) et `/admin/finances` (TVA, identité vendeur, échéances).

## Cycle

```
Souscription ─► facture numérotée (FAC-AAAA-NNNNNN, TVA du pays de facturation) ─► paiement PENDING
     │                                                              │
     │        prestataire (page hébergée) ──webhook signé──► SUCCEEDED → facture PAID → abonnement ACTIVE
     │                                                    └► FAILED   → facture reste due, relances
     └─ virement : instructions affichées ─► confirmation manuelle finance ─► SUCCEEDED
```

Renouvellements, relances d'échéance et expirations : tâche planifiée (`npm run jobs`). Remboursements : demande par le client, décision par la finance, appel au prestataire ; avoir comptable via la facture.

## Prestataires disponibles

| Nom (`PAYMENT_PROVIDER`) | Statut | Usage |
|---|---|---|
| `mock` | Opérationnel | Simulateur : page `/paiement/test/[id]` avec boutons « accepté / refusé » qui émettent un **vrai webhook signé**. Paiements marqués `isTest`, bandeau « Environnement de test ». **Refusé quand `NODE_ENV=production`**, sauf `ALLOW_MOCK_PAYMENTS=true` (démo hébergée). |
| `bank_transfer` | Opérationnel | Virement ; instructions (`BANK_TRANSFER_INSTRUCTIONS`) ; confirmation manuelle dans `/admin/finances`. |
| CinetPay, PayDunya, Flutterwave, Wave, Orange Money, Stripe… | **Non intégrés** | À implémenter (voir ci-dessous) avec les identifiants et la documentation officiels du prestataire retenu. |

## Brancher un prestataire réel

1. Créer `src/infrastructure/payments/<nom>-provider.ts` implémentant `PaymentProvider` (`src/infrastructure/payments/provider.ts`) :
   - `createCharge()` : appel API du prestataire, retourne `providerRef` + `redirectUrl` (page hébergée) ;
   - `parseWebhook(rawBody, headers)` : **vérifier la signature selon la documentation du prestataire** (lever `WebhookVerificationError` sinon), puis retourner `{ eventId, providerRef, status, amountMinor, currency, sanitized }` ;
   - `refund()`.
2. L'enregistrer dans `registry.ts` et définir `PAYMENT_PROVIDER=<nom>` + ses secrets (variables d'environnement, jamais dans le dépôt).
3. Déclarer l'URL de notification chez le prestataire : `https://<domaine>/api/v1/webhooks/payments/<nom>`.
4. Écrire les tests d'intégration (webhook valide, signature invalide, rejeu, montant non concordant) sur le modèle de `tests/integration/billing.test.ts`, puis tester en **mode sandbox du prestataire** avant toute mise en production.

## Commissions

Taux par défaut paramétrable (`commission.defaultBps`, 1000 = 10 %, **à valider**) ; une commission est calculée à la contractualisation et suivie (due → facturée → payée) dans `/admin/finances`.
