# Modèle de données

Source de vérité : [`prisma/schema.prisma`](../prisma/schema.prisma) — **107 tables, 53 énumérations**, PostgreSQL 16.
Migration initiale : `prisma/migrations/20261017100413_init/migration.sql` (générée par Prisma, complétée de contraintes `CHECK` et d'index trigrammes).

## Conventions

- Identifiants `cuid` (texte) ; tables en `snake_case` (`@@map`), colonnes en camelCase.
- **Montants en unités mineures entières** (`amountMinor`, `Int`/`BigInt`) + code devise ISO 4217 ; les devises sans décimales (XOF, XAF, RWF, GNF) ont `minorUnits = 0`. Aucun flottant pour l'argent (`src/domain/money.ts`).
- **Taux en points de base** (`vatBps = 1800` = 18 %).
- `isDemo` sur toutes les entités pouvant contenir des données de démonstration ; exclues des KPI par défaut.
- `createdAt` / `updatedAt` partout ; suppression logique pour les comptes (`status = DELETED`, données personnelles anonymisées).
- `audit_logs` : append-only (aucune mise à jour applicative), acteur, action, cible, organisation, IP, métadonnées.

## Domaines de tables

| Domaine | Tables principales |
|---|---|
| Référentiels | countries, currencies, tax_rates, expertise_domains, skills (synonymes), badges, features, system_settings |
| Identité | users, sessions (jeton haché SHA-256), user_tokens (vérification email, réinitialisation), consents |
| Organisations | organizations, organization_members (rôle), invitations, organization_documents |
| Fichiers | stored_files (clé de stockage, type détecté par signature, taille, propriétaire, visibilité) |
| Experts | expert_profiles, expert_domains, expert_skills (niveau 1–5), qualifications, experiences, references, portfolio_items, availability_slots, favorites |
| Vérification | verification_requests, verification_documents, verification_checks, verification_events, expert_badges |
| Marketplace | missions, mission_requirements, mission_attachments, mission_events, saved_missions, mission_invitations, applications, application_events, interviews, shortlists, shortlist_entries, match_scores (score + détail JSON), contracts, reviews |
| Projets | projects, project_members, project_tasks (Kanban, livrables), task_comments |
| Messagerie | conversations, conversation_participants, messages |
| Appels d'offres | tenders, tender_documents, tender_alerts, tender_bids, bid_requirements (matrice de conformité), tender_bid_experts, consortiums, consortium_members |
| Academy | courses, course_modules, lessons, enrollments, lesson_progress, assessments, assessment_attempts, learning_certificates (code de vérification), live_sessions, mentorships |
| Communauté | community_groups, posts, comments, reactions, follows, content_reports, community_events |
| CRM | leads, crm_contacts, opportunities (étape, probabilité), crm_activities, quotes |
| Monétisation | subscription_plans, plan_prices (multi-devises), plan_features (limites), coupons, subscriptions, invoice_sequences, invoices, invoice_lines, payments, payment_events (webhooks, idempotence), refunds, commissions |
| Notifications | notifications, notification_templates, notification_preferences, outbound_messages (file email/SMS) |
| CMS | content_blocks, public_stats, testimonials, partners, faq_items, contact_requests |
| Technique | audit_logs, idempotency_keys |

## Règles d'intégrité en base (en plus des clés étrangères et contraintes d'unicité)

- Abonnement et facture : **exactement un titulaire** (utilisateur XOR organisation).
- Montants de factures, lignes, paiements, remboursements, prix ≥ 0 (paiements et remboursements > 0).
- Note d'avis 1–5, niveau de compétence 1–5, score de matching 0–100, complétude 0–100.
- Budget min ≤ max ; disponibilité : fin ≥ début.
- Numérotation de factures : `invoice_sequences` (préfixe + année + compteur), incrémentée en transaction → pas de trou ni de doublon.
- Unicités métier : une candidature par expert et par mission, une adhésion par utilisateur et organisation, un seul événement par identifiant d'événement de prestataire (`payment_events`).
- Recherche plein texte approximative : index GIN `pg_trgm` sur titres de missions, d'appels d'offres et accroches d'experts.

## Migrations

```bash
npx prisma migrate dev --name <changement>   # développement (crée la migration)
npx prisma migrate deploy                    # CI / production (applique sans interaction)
```

Ne jamais exécuter `prisma migrate reset` sur une base contenant des données réelles.
