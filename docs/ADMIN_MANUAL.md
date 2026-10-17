# Manuel d'administration

Le back-office est accessible à `/admin` aux comptes administrateurs. Chaque rubrique exige une permission ; toute action est inscrite au **journal d'audit**.

| Rubrique | Permission | Usage |
|---|---|---|
| Accueil `/admin` | (tout admin) | Files d'attente : vérifications, organisations à valider, signalements, virements à confirmer |
| Utilisateurs `/admin/utilisateurs` | USERS_MANAGE | Rechercher, suspendre / réactiver un compte (révoque ses sessions), attribuer des permissions d'administration (SUPER_ADMIN requis) |
| Vérifications `/admin/verifications` | EXPERTS_VERIFY | Traiter les demandes : ouvrir chaque document (lien temporaire), cocher chaque contrôle requis (identité, diplômes, références, compétences), valider / refuser / demander un complément. Le badge n'est attribué **qu'après tous les contrôles requis** ; on ne peut pas traiter sa propre demande. Révocation possible avec motif |
| Experts `/admin/experts` | EXPERTS_VERIFY | Liste des profils, complétude, badges |
| Organisations `/admin/organisations` | ORGS_VALIDATE | Valider / refuser (motif) / suspendre une organisation. Une organisation non validée ne peut pas publier |
| Missions `/admin/missions` | MARKETPLACE_MODERATE | Modérer (dépublier avec motif) |
| Appels d'offres `/admin/appels-offres` | MARKETPLACE_MODERATE | Publier / retirer des appels d'offres de la veille |
| Modération `/admin/moderation` | COMMUNITY_MODERATE | Signalements de la communauté : masquer le contenu ou classer |
| Finances `/admin/finances` | FINANCE_MANAGE | Encaissements, créances, MRR, commissions ; **taux de TVA par pays**, **identité du vendeur** (raison sociale, RCCM, NCC, régime fiscal, adresse), préfixe et échéance des factures |
| Factures `/admin/factures` | FINANCE_MANAGE | Toutes les factures, PDF, export CSV/Excel ; **virements à rapprocher** (confirmation avec référence bancaire obligatoire) ; **demandes de remboursement** (accepter / refuser) |
| Offres `/admin/offres` | CONFIG_MANAGE | Créer / modifier les offres, **prix par devise et périodicité**, limites (missions actives, contacts, collaborateurs…), coupons. Aucun prix n'est codé en dur |
| Configuration `/admin/configuration` | CONFIG_MANAGE | Pondérations du matching (normalisées à 100 %), pays actifs, domaines, compétences et synonymes, modèles de notification |
| Contenus `/admin/contenus` | CONTENT_MANAGE | Textes du site (accueil, à propos, pages légales), FAQ, chiffres publics (calculés ou manuels signalés), témoignages, partenaires |
| Contacts `/admin/contacts` | CONTENT_MANAGE | Demandes reçues via le formulaire de contact |
| Audit `/admin/audit` | AUDIT_VIEW | Journal filtrable, export |
| Direction `/admin/direction` | ANALYTICS_VIEW | CEO Dashboard (voir KPI.md) : filtres période / pays / type / devise, inclusion explicite de la démo, exports PDF, CSV, Excel |

## Procédures

**Valider un expert** — Vérifications › ouvrir la demande › examiner chaque document › cocher les contrôles réalisés avec une note › « Valider ». En cas de doute : « Demander un complément » (l'expert est notifié).

**Confirmer un virement** — Factures › Virements à rapprocher › saisir la référence bancaire après réception effective des fonds › « Confirmer ». La facture passe à « Payée », l'abonnement est activé, l'action est journalisée.

**Changer un prix** — Offres › offre › « Ajouter un prix » (nouvelle devise ou nouveau montant), puis désactiver l'ancien. Les abonnements existants conservent leur prix jusqu'au renouvellement suivant le changement d'offre.

**Ajuster le matching** — Configuration › Pondérations : compétences, expérience, domaine, disponibilité, localisation/langues, vérification. Les recommandations suivantes utilisent les nouvelles valeurs ; le détail de chaque score reste consultable.

**Bonnes pratiques** — Attribuer à chacun la permission minimale ; ne pas partager les comptes ; vérifier régulièrement le journal d'audit.
