# Sécurité et données personnelles

## Mesures en place

| Domaine | Mesure | Code |
|---|---|---|
| Mots de passe | bcrypt (coût 11) ; 10 caractères minimum dont une minuscule, une majuscule et un chiffre | `infrastructure/auth/password.ts`, `schemas.ts` |
| Sessions | Jeton opaque aléatoire (256 bits), **stocké haché SHA-256**, cookie HttpOnly + SameSite=Lax + Secure (production), durée 14 jours, révocation à la déconnexion, au changement de mot de passe et à la suspension | `auth.service.ts` |
| Comptes | Vérification email obligatoire ; liens de réinitialisation à usage unique et expirants ; réponse identique que l'email existe ou non | `auth.service.ts` |
| Force brute | Limites par IP sur connexion (20 / 15 min), inscription (10 / 15 min), mot de passe oublié, contact ; par utilisateur sur actions sensibles | `rate-limit.ts`, routes |
| CSRF | Vérification d'origine sur toute mutation authentifiée par cookie | `http/handler.ts` |
| Autorisations | Contrôle systématique côté serveur (rôle d'organisation, permission plateforme, propriété) ; organisation déduite de l'appartenance, jamais d'un paramètre client | `application/access.ts`, `domain/permissions.ts` |
| Isolation multi-tenant | Requêtes filtrées par organisation ; tests d'intégration d'étanchéité | `tests/integration/tenancy.test.ts` |
| Validation | Zod sur toutes les entrées ; messages d'erreur en français sans fuite technique | `schemas.ts` |
| Fichiers | Type vérifié par **signature binaire** (PDF, PNG, JPEG, WebP, DOCX/XLSX), 10 Mo max, noms aléatoires, hors du dossier public ; lecture par **lien signé de 10 minutes** et contrôle d'accès | `domain/files.ts`, `file.service.ts` |
| En-têtes HTTP | CSP stricte, HSTS (production), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy | `next.config.ts` |
| Paiements | Webhooks signés HMAC + horodatage, idempotence, contrôle du montant ; aucune donnée de carte | `docs/PAYMENTS.md` |
| Traçabilité | Journal d'audit des actions sensibles (connexion, rôles, validations, finances, configuration, contenus) ; consultable `AUDIT_VIEW`, exportable | `audit.service.ts` |
| Secrets | Uniquement par variables d'environnement validées au démarrage ; `.env` ignoré par git ; `.env.example` sans valeur | `infrastructure/env.ts` |
| Démo | Données fictives marquées ; comptes administrateurs de démo **jamais créés en production** ; simulateur de paiement refusé en production | `prisma/seed.ts`, `payments/registry.ts` |
| Dépendances | `npm audit --omit=dev` : 0 vulnérabilité au moment de la livraison ; contrôlé en CI | `.github/workflows/ci.yml` |

## Données personnelles

Cadre principal : **loi ivoirienne n° 2013-450 du 19 juin 2013** relative à la protection des données à caractère personnel (autorité : ARTCI), et lois équivalentes des pays d'opération (Sénégal loi 2008-12, etc.). **La conformité doit être validée par un juriste** ; les formalités (déclaration / autorisation ARTCI, transferts hors du pays) sont à accomplir par l'exploitant.

Droits implémentés :

- **Accès / portabilité** : Paramètres › Mes données → export JSON complet (`/api/v1/me/export`).
- **Rectification** : édition du profil.
- **Suppression** : Paramètres › Supprimer mon compte → anonymisation des données personnelles, révocation des sessions ; les pièces comptables (factures) sont conservées comme l'exige la loi.
- **Consentements** : CGU, confidentialité, communications marketing — horodatés et versionnés (`consents`), modifiables.
- **Visibilité** : profil expert privé par défaut ; coordonnées jamais publiques ; documents justificatifs réservés aux vérificateurs.

## Durées de conservation proposées (à valider)

| Données | Durée proposée |
|---|---|
| Compte et profil | Durée de vie du compte, puis anonymisation |
| Documents de vérification | Durée de validité du badge (730 jours, paramétrable) + 1 an, puis suppression |
| Factures, paiements | 10 ans (obligations comptables — à confirmer selon le droit OHADA / fiscal local) |
| Journaux d'audit | 5 ans |
| Sessions expirées | Purgées par la tâche planifiée |
| Demandes de contact | 3 ans |

La purge automatique des documents de vérification et des demandes de contact au-delà de ces durées **n'est pas encore automatisée** (voir FEATURES.md).

## Signaler une vulnérabilité

Prévoir une adresse dédiée (ex. security@…) avant la mise en production.
