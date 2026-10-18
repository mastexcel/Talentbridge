# API REST — `/api/v1`

Toutes les routes répondent en JSON. Implémentation : `src/app/api/v1/**/route.ts` ; validation : `src/application/schemas.ts` (Zod) — **le schéma Zod est la référence exacte des champs**.

## Conventions

| Sujet | Règle |
|---|---|
| Authentification | Cookie de session `tb_session` (HttpOnly, SameSite=Lax, Secure en production) **ou** en-tête `Authorization: Bearer <jeton>`. Sessions opaques stockées hachées (SHA-256), expiration glissante. |
| CSRF | Les mutations authentifiées par cookie exigent une origine identique (`Origin` / `Sec-Fetch-Site`). |
| Organisation active | Les actions d'organisation s'appliquent à l'organisation active de la session (`auth/switch-org`) ; le rôle est vérifié à chaque appel. |
| Idempotence | En-tête `Idempotency-Key` accepté sur les mutations sensibles (souscription, paiement) : une même clé renvoie la même réponse. |
| Limitation de débit | Par IP et par utilisateur (connexion, inscription, contact, recherche, souscription…) → `429 RATE_LIMITED`. |
| Erreurs | `{ "error": { "code", "message", "details?", "issues?" } }` — codes : `VALIDATION` 400, `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409, `INVALID_STATE` 409, `PLAN_LIMIT` 402, `RATE_LIMITED` 429, `NOT_AVAILABLE` 501, `INTERNAL` 500. Messages en français. |
| Pagination | `?page=` (≥ 1), réponse `{ items, total, page, pageSize }`. |
| Routes à actions | Beaucoup de ressources exposent `POST /ressource/[action]` : l'action est un segment d'URL, chaque action a son propre schéma et sa propre permission. |

## Référence

| Route | Méthode | Actions / description | Accès |
|---|---|---|---|
| `/health` | GET | État du service | Public |
| `/auth/[action]` | POST | `signup`, `login`, `logout`, `forgot`, `reset`, `verify-email`, `resend-verification`, `change-password`, `switch-org`, `accept-invitation` | Public / connecté |
| `/me/[action]` | POST | `profile`, `skills`, `item-add`, `item-remove` (qualifications, expériences, références, portfolio, disponibilités — discriminant `itemKind`), `profile-file`, `favorite`, `save-mission`, `notifications-read`, `notification-pref`, `consent`, `organization-create`, `delete-account` | Connecté |
| `/me/export` | GET | Export JSON de toutes mes données (droit d'accès) | Connecté |
| `/experts` | GET | Recherche : `q, country, city, domain, skill, language, minYears, certified, availability, mobility, minRate, maxRate, page…` — sans coordonnées | Public |
| `/missions` | GET / POST | Recherche publique (`q, country, domain, workMode, page`) / création d'un brouillon | Public / `missions.manage` |
| `/missions/[id]/[action]` | POST | `update`, `status` (machine à états + quota d'offre), `apply` (expert), `invite`, `run-matching`, `team` (équipe proposée), `shortlist` | Selon action |
| `/applications/[id]/[action]` | POST | `decide`, `interview`, `withdraw` (expert), `contract` | `applications.review` / expert |
| `/invitations/[id]/[action]` | POST | `respond` (expert invité à une mission) | Expert |
| `/matches/[id]/[action]` | POST | `decide` (retenir / écarter une recommandation) | `shortlists.manage` |
| `/matching/[action]` | POST | `analyze` (extraction de compétences d'un texte), `quick` (classement instantané) | `experts.search` |
| `/contracts/[id]/[action]` | POST | `status`, `review` (avis après contrat terminé) | Parties au contrat |
| `/projects` · `/projects/[id]/[action]` | POST | Création ; `member`, `task`, `status` | `projects.manage` / membres |
| `/tasks/[id]/[action]` | POST | `move` (Kanban), `deliverable` (dépôt), `review` (validation), `comment` | Membres du projet |
| `/messages` · `/messages/[id]` | POST | Nouvelle conversation ; nouveau message | Participants |
| `/notifications` | GET | Notifications in-app | Connecté |
| `/verification/[action]` | POST | `request`, `document`, `submit` | Expert |
| `/org/[action]` | POST | `update`, `invite`, `revoke-invitation`, `member-role`, `document`, `shortlist-remove`, `tender-publish` | Rôle d'organisation |
| `/billing/[action]` | POST | `subscribe`, `pay`, `cancel`, `change-plan`, `refund` (demande), `simulate` (prestataire de test uniquement) | Titulaire / `billing.manage` |
| `/invoices/[id]/pdf` | GET | Facture PDF | Titulaire, admin finance |
| `/webhooks/payments/[provider]` | POST | Notification du prestataire — **signature HMAC vérifiée**, horodatage ±5 min, idempotence par identifiant d'événement | Prestataire |
| `/tenders/[action]` | POST | `alert-create`, `alert-delete`, `bid-start` | `tenders.manage` |
| `/bids/[id]/[action]` | POST | `extract` (exigences depuis le texte du dossier, marquées « brouillon assisté »), `requirement-add/update/delete`, `expert`, `consortium`, `status` | `tenders.manage` |
| `/academy/[action]` | POST | `enroll`, `lesson-complete`, `attempt`, `certificate`, `course-create`, `lesson-add`, `assessment`, `course-status` | Apprenant / formateur |
| `/community/[action]` | POST | `post`, `comment`, `react`, `follow`, `group`, `report`, `mentorship-request`, `mentorship-respond` | Connecté |
| `/crm/[action]` | POST | `opportunity`, `move`, `lead`, `convert`, `contact`, `activity`, `activity-done`, `quote` | `crm.use` |
| `/certificates/[action]` | POST | `issuer-save`, `issuer-file` (logo, cachet, signature), `issuer-submit`, `issuer-attach`, `issuer-review` (ACADEMY_MANAGE, autre personne que le déclarant), `tb-signatory-save` (SUPER_ADMIN), `course-cosigner` (ACADEMY_MANAGE), `consultant-claim`, `consultant-revoke` (EXPERTS_VERIFY) | Selon action |
| `/certificate-pdf/[code]` | GET | Certificat en PDF (formation ou consultant) | Public |
| `/files` · `/files/[id]` | POST / GET | Dépôt (type vérifié par signature binaire, taille limitée) ; lecture par lien signé temporaire | Propriétaire / habilités |
| `/exports/[kind]` | GET | `factures`, `crm`, `audit`, `direction` — `?format=csv|xlsx|pdf` + filtres KPI | Permission correspondante |
| `/contact` | POST | Formulaire de contact | Public (limité) |
| `/jobs` | POST | Tâches planifiées — en-tête `x-cron-secret` | Cron |
| `/admin/[action]` | POST | Utilisateurs (`user-status`, `admin-role`), organisations (`org-decide`), modération (`mission-moderate`, `report-resolve`, `tender-publish`), vérification (`verification-check`, `verification-decide`, `verify-item`, `badge-revoke`), finance (`transfer-confirm`, `refund-decide`), configuration (`matching-weights`, `seller-identity`, `billing-settings`, `tax-rate`, `country-toggle`, `skill`, `domain`), offres (`plan-save`, `price-add`, `price-toggle`, `plan-feature`, `coupon-create`, `coupon-toggle`), contenus (`cms-block`, `faq-create`, `faq-toggle`, `stat-update`, `testimonial-save`, `template-save`, `contact-handled`) | Permission plateforme dédiée par action |

## Exemple

```bash
# Connexion (renvoie le cookie de session)
curl -c jar -H 'content-type: application/json' -H 'origin: http://localhost:3000' \
  -d '{"email":"cabinet@demo.talentbridge.africa","password":"…"}' http://localhost:3000/api/v1/auth/login

# Lancer le matching d'une mission
curl -b jar -H 'origin: http://localhost:3000' -X POST http://localhost:3000/api/v1/missions/<id>/run-matching
```
