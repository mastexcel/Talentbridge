# Architecture — Talent Bridge

## 1. Résumé

Application **Next.js monolithique modulaire** : une seule base de code (pages serveur + API REST `/api/v1`), organisée en couches à la manière d'une architecture hexagonale légère.

```
Navigateur ──► Pages (Server Components) ──┐
          └──► API /api/v1 (route handlers) ─┼─► Application (services métier, transactions, audit)
                                             │        │
                                             │        ├─► Domaine (règles pures : permissions, workflows, matching, argent, fichiers)
                                             │        └─► Infrastructure (Prisma/PostgreSQL, stockage S3/local, paiements, email/SMS, journaux)
Cron ─────► npm run jobs / POST /api/v1/jobs ┘
Prestataire de paiement ─► POST /api/v1/webhooks/payments/:provider (signature HMAC vérifiée)
```

Principes :

- **Le domaine ne dépend de rien** (fonctions pures, testées unitairement : `src/domain`).
- **Toute écriture passe par un service applicatif** (`src/application`) qui vérifie l'autorisation (`access.ts`), valide les entrées (Zod, `schemas.ts`), écrit en transaction et journalise (`audit_logs`). Les pages ne font que des lectures via ces mêmes services.
- **Multi-tenant par organisation** : chaque requête organisationnelle est filtrée par `organizationId` issu de l'appartenance vérifiée de l'utilisateur (jamais d'un paramètre client). Tests dédiés : `tests/integration/tenancy.test.ts`.
- **Aucune donnée statique en production** : tous les contenus (CMS, FAQ, statistiques publiques, offres, prix, taxes, pondérations) sont en base et administrables.
- **Adaptateurs** pour tout service externe (paiement, stockage, email, SMS) : interface unique + implémentation de développement explicite (`mock`, `log`, `local`).

## 2. Arborescence

```
prisma/                 schéma (≈107 tables), migrations SQL (+ contraintes CHECK, index pg_trgm), seed
  reference-data.ts     référentiels : pays, devises, TVA, domaines, compétences, badges, offres, modèles, CMS
  seed-reference.ts     seed idempotent des référentiels (toujours)
  seed.ts               démonstration (fictive, isDemo) via les vrais services
scripts/run-jobs.ts     tâches planifiées
src/
  domain/               règles pures : permissions, workflows (machines à états), matching, money, billing, files, academy, tenders
  application/          services métier (auth, organisations, experts, vérification, missions, matching, projets,
                        messagerie, facturation, finance, CMS, appels d'offres, academy, communauté, CRM, admin,
                        analytics, reporting, notifications, confidentialité, jobs)
  infrastructure/       env, db, crypto, logger, rate-limit, http (route/actions/cookies), payments, storage, notifications
  lib/                  session (currentUser, requireUser…), navigation, filtres KPI
  i18n/                 messages fr/en
  ui/                   design system et composants (Button, Card, Field, Table, charts, Shell, formulaires…)
  app/
    (public)/           site public : accueil, experts, missions, appels d'offres, academy, certificats, tarifs, pages institutionnelles et légales
    (auth)/             connexion, inscription consultant / organisation, mot de passe, vérification email, invitation
    (app)/              espace connecté : espace consultant, organisation, projets, messages, notifications, paramètres, facturation, communauté, academy
    admin/              back-office central et CEO Dashboard
    api/v1/             API REST
tests/
  unit/                 domaine (matching, workflows, permissions, argent, sécurité…)
  integration/          services sur base réelle (multi-tenant, auth, vérification, facturation, marketplace)
  e2e/                  Playwright : 14 parcours critiques + mobile
docs/                   documentation
```

## 3. Modules

| # | Module | Pages | Services | Statut |
|---|---|---|---|---|
| 1 | Site public + CMS | `(public)/*`, `admin/contenus` | cms.service | Opérationnel |
| 2 | Authentification, onboarding | `(auth)/*`, `parametres` | auth.service | Opérationnel |
| 3 | Annuaire d'experts | `/experts`, `/experts/[slug]`, `/comparer`, `organisation/experts` | expert.service | Opérationnel |
| 4 | Vérification / certification | `espace/verification`, `admin/verifications` | verification.service | Opérationnel |
| 5 | Marketplace de missions | `/missions`, `organisation/missions/*`, `espace/missions`, `espace/candidatures` | mission.service | Opérationnel |
| 6 | Matching explicable + équipes | `organisation/missions/[id]` | matching.service, domain/matching | Opérationnel (déterministe) |
| 7 | Équipes projet | `projets/*` (Kanban, chronologie, livrables) | project.service | Opérationnel |
| 8 | Appels d'offres / AMI | `/appels-offres`, `organisation/appels-offres/*` | tender.service | Opérationnel (assistant = extraction déterministe, brouillons signalés) |
| 9 | Academy + certificats QR | `/academy`, `academy/formateur`, `/certificats/[code]`, `admin/certificats` | academy.service, certificate.service, certificate-pdf | Opérationnel : protocole de certification (institution délivrante validée + cosignataire Talent Bridge obligatoires avant mise en ligne), certificats de formation et « Consultant vérifié » à l'image des modèles, PDF (sessions live sans visio intégrée) |
| 10 | Communauté, mentorat, modération | `communaute/*`, `admin/moderation` | community.service | Opérationnel |
| 11 | CRM | `organisation/crm/*` | crm.service | Opérationnel |
| 12 | Abonnements / monétisation | `/tarifs`, `facturation`, `admin/offres` | billing.service | Opérationnel (paiement réel à brancher) |
| 13 | Facturation / finance | `facturation/factures/*`, `admin/finances`, `admin/factures` | billing.service, finance.service | Opérationnel |
| 14 | Espace consultant | `espace/*` | expert.service… | Opérationnel |
| 15 | Espace organisation + rôles | `organisation/*` | organization.service | Opérationnel |
| 16 | Administration centrale | `admin/*` | admin.service | Opérationnel |
| 17 | CEO Dashboard | `admin/direction` (+ exports PDF/CSV/Excel) | analytics.service, reporting.service | Opérationnel |
| 18 | Notifications | `notifications`, `parametres` | notification.service | In-app opérationnel ; email/SMS via adaptateur (fournisseur réel à configurer) |

## 4. Rôles et permissions

### 4.1 Rôles d'organisation (`src/domain/permissions.ts`)

| Permission | Propriétaire | Admin | Recruteur | Chef de projet | Collaborateur | Lecteur |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| org.view — voir l'organisation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| org.manage — paramètres, documents | ✓ | ✓ | | | | |
| members.manage — inviter, rôles | ✓ | ✓¹ | | | | |
| billing.manage — abonnement, factures | ✓ | ✓ | | | | |
| missions.manage — créer, publier | ✓ | ✓ | ✓ | | | |
| applications.review — candidatures | ✓ | ✓ | ✓ | | | |
| experts.search — annuaire, contact | ✓ | ✓ | ✓ | ✓ | ✓ | |
| shortlists.manage | ✓ | ✓ | ✓ | ✓ | | |
| contracts.manage | ✓ | ✓ | | | | |
| projects.manage | ✓ | ✓ | | ✓ | | |
| tenders.manage — appels d'offres | ✓ | ✓ | ✓ | ✓ | | |
| crm.use | ✓ | ✓ | | | ✓ | |
| reports.view | ✓ | ✓ | ✓ | ✓ | | ✓ |

¹ un Admin ne peut pas nommer de Propriétaire ; le dernier Propriétaire ne peut pas être rétrogradé.

### 4.2 Permissions plateforme (administrateurs Talent Bridge)

`SUPER_ADMIN` (toutes), `USERS_MANAGE`, `EXPERTS_VERIFY`, `ORGS_VALIDATE`, `MARKETPLACE_MODERATE`, `FINANCE_MANAGE`, `CONFIG_MANAGE`, `CONTENT_MANAGE`, `COMMUNITY_MODERATE`, `CRM_MANAGE`, `ANALYTICS_VIEW`, `AUDIT_VIEW`, `ACADEMY_MANAGE` (institutions délivrantes, cosignataires des formations). Un administrateur suspendu perd toutes ses permissions. Un vérificateur ne peut pas valider sa propre demande (`canApproveVerification`).

### 4.3 Experts

Un expert agit sur ses propres ressources (profil, candidatures, contrats, vérification). Ses coordonnées ne sont jamais publiques ; les documents justificatifs ne sont accessibles qu'à lui et aux vérificateurs, par liens signés temporaires.

## 5. Flux principaux (machines à états — `src/domain/workflows.ts`)

- **Mission** : DRAFT → PUBLISHED → SHORTLISTING → INTERVIEWS → SELECTION → CONTRACTING → IN_PROGRESS → CLOSED (CANCELLED possible jusqu'à la contractualisation). Publication soumise au quota `missions.active` de l'offre.
- **Candidature** : SUBMITTED → SHORTLISTED → INTERVIEW → SELECTED → CONTRACTED, ou REJECTED / WITHDRAWN.
- **Vérification** : NOT_SUBMITTED → PENDING → IN_REVIEW → VERIFIED / REJECTED / INFO_REQUESTED ; VERIFIED → EXPIRED (durée paramétrable). Badge attribué uniquement après les contrôles humains requis (`REQUIRED_CHECKS`).
- **Organisation** : PENDING → VERIFIED / REJECTED ; VERIFIED ↔ SUSPENDED.
- **Contrat** : DRAFT → SENT → SIGNED → ACTIVE → COMPLETED / TERMINATED, puis avis.
- **Paiement** : PENDING → SUCCEEDED / FAILED, **uniquement** sur webhook signé ou confirmation manuelle d'un administrateur finance (virement).

## 6. Plan de développement priorisé

1. Socle : schéma, auth, sessions, RBAC, multi-tenant, audit — **fait**
2. Profils, annuaire, vérification — **fait**
3. Missions, candidatures, matching, contrats — **fait**
4. Abonnements, facturation, paiements (adaptateurs), finance — **fait** (prestataire réel à brancher)
5. Projets, messagerie, notifications — **fait**
6. Appels d'offres, Academy, communauté, CRM — **fait**
7. Back-office, CEO Dashboard, exports — **fait**
8. Tests, CI, Docker, documentation — **fait**
9. Suite : prestataires réels (paiement, email, SMS), couche IA sémantique, visio, traduction anglaise complète, mode sombre, Redis — voir FEATURES.md

## 7. Critères de validation du MVP

- [x] Un consultant s'inscrit, vérifie son email, complète son profil (≥ 60 %), demande une vérification, candidate.
- [x] Une organisation s'inscrit, est validée, publie une mission (dans la limite de son offre), lance le matching, voit le détail du score, présélectionne, contractualise.
- [x] Un vérificateur traite une demande ; le badge n'apparaît qu'après validation humaine.
- [x] Une équipe projet est créée et suit ses tâches/livrables.
- [x] Une souscription génère une facture numérotée ; le paiement n'est « payé » qu'après confirmation (webhook signé / validation manuelle).
- [x] Le CEO Dashboard affiche des KPI calculés sur les données réelles, la démo étant exclue par défaut ; exports PDF/CSV/Excel.
- [x] Aucune fuite de données entre organisations (tests d'intégration).
- [x] Les 14 parcours Playwright passent sur build de production ; affichage mobile sans débordement.
- [ ] Validation juridique (CGU, confidentialité, mentions légales) et fiscale (identité vendeur, TVA) — **à faire par le client**.
- [ ] Prestataire de paiement réel et fournisseur email/SMS configurés — **à faire avant production**.
