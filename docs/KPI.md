# Indicateurs (CEO Dashboard)

Implémentation : `src/application/analytics.service.ts` (`ceoKpis`) et `src/application/finance.service.ts` (`financeDashboard`). Page : `/admin/direction` (permission `ANALYTICS_VIEW`). Exports : `/api/v1/exports/direction?format=pdf|csv|xlsx`.

## Règles

- **Données réelles uniquement.** Les enregistrements de démonstration (`isDemo = true`) et les paiements de test (`isTest = true`) sont **exclus par défaut** ; ils ne sont inclus que si le filtre « Inclure la démo » est coché, et un bandeau le signale alors sur la page et dans les exports.
- Un indicateur sans données affiche « — » (jamais 0 % ni valeur inventée), avec la taille d'échantillon quand elle est pertinente.
- Filtres : période (`from`, `to`), pays, type d'organisation, devise. Les montants ne sont jamais additionnés entre devises : la devise est un filtre.

## Définitions

| KPI | Définition | Requête (Prisma) |
|---|---|---|
| Utilisateurs | Comptes non supprimés, hors administrateurs | `user.count({ status ≠ DELETED, platformRole = USER })` |
| Experts | Profils experts (filtre pays) | `expertProfile.count` |
| Experts vérifiés | Experts avec au moins un badge non révoqué et non expiré | `expertProfile.count({ badges: some { revokedAt null, expiresAt null ou futur } })` |
| Organisations | Organisations (filtres pays, type) | `organization.count` |
| Clients payants | Organisations + experts ayant un abonnement ACTIVE à prix > 0 | 2 `count` sur `subscriptions` |
| Abonnements actifs | `subscription.status = ACTIVE` | `subscription.count` |
| Missions publiées | Missions dont `publishedAt` ∈ période | `mission.count` |
| Missions attribuées | Contrats créés dans la période | `contract.count` |
| Nouveaux inscrits | Utilisateurs créés dans la période | `user.count({ createdAt ∈ période })` |
| Taux de conversion | Clients payants ÷ (organisations + experts) | calcul, 1 décimale |
| Taux de sélection | Candidatures de la période au statut SELECTED/CONTRACTED ÷ candidatures de la période | calcul |
| Taux de renouvellement | Abonnements récurrents renouvelés (`renewalCount > 0`) ÷ abonnements arrivés à échéance (renouvelés, ou expirés/annulés avec fin de période dans la période) | calcul |
| Satisfaction | Moyenne des notes d'avis (1–5) de la période + nombre d'avis | `review.aggregate(_avg.rating)` |
| Délai moyen de matching | Moyenne, par mission, des heures entre la publication et la **première** candidature passée à SELECTED dans la période | `applicationEvent(toStatus = SELECTED)` |
| Chiffre d'affaires encaissé | Paiements SUCCEEDED de la période − remboursements effectués | `payment`, `refund` |
| Créances | Σ (total TTC − payé) des factures émises non soldées | `invoice` |
| MRR | Σ abonnements actifs : prix mensuel, ou prix annuel ÷ 12 | `subscription` + `plan_price` |
| ARR | MRR × 12 | calcul |
| Commissions | Commissions par statut (dues, facturées, payées) | `commission.groupBy(status)` |
| Inscriptions par mois | Inscriptions de la période, ventilées experts / organisations | `user.findMany` + regroupement |
| Experts par pays, organisations par type | Répartitions | `groupBy` |
| Entonnoir consultants | Inscrits → profil ≥ 60 % → ont candidaté → ont obtenu un contrat (cohorte inscrite dans la période) | 4 `count` |

## Statistiques publiques (site)

Chaque chiffre de la page d'accueil (`public_stats`) a une source : `LIVE` (calculé sur les données réelles, démo exclue) ou `MANUAL` (valeur saisie par un administrateur `CONTENT_MANAGE` dans `/admin/contenus`, à réserver aux chiffres sourcés hors plateforme). Une valeur manuelle marquée démo, ou un calcul incluant la démo, est affiché avec le badge « Démo ». Toute modification est journalisée.
