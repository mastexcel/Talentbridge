# Inventaire des fonctionnalités

État à la livraison. « Terminé » = implémenté de bout en bout (base, service, API, interface) **et** couvert par des tests (unitaires, intégration et/ou parcours E2E).

## Tests

| Suite | Contenu | Résultat |
|---|---|---|
| Unitaires (`tests/unit`, 43) | Matching (pondérations, critères, équipe, extraction de compétences), workflows, permissions, argent/TVA, fichiers, signatures webhook, S3 SigV4, sécurité | ✅ 43/43 |
| Intégration (`tests/integration`, 30) | Étanchéité multi-tenant, authentification, vérification et badges, facturation/paiements/webhooks/renouvellements, marketplace (quota d'offre, candidatures, contrats), API (idempotence, CSRF, session, simulateur refusé en production), chiffres publics | ✅ 30/30 |
| E2E Playwright (`tests/e2e`, 16) | 14 parcours critiques (inscription consultant, profil, vérification, inscription organisation + validation, publication, matching, candidature, sélection et contrat, projet, appel d'offres, Academy + certificat, souscription en mode test, facture PDF, CEO Dashboard) + 2 tests mobiles | ✅ 16/16 (une exécution précédente a vu un échec isolé du test « tiroir mobile », non reproduit sur les 3 exécutions suivantes) |
| Qualité | ESLint, TypeScript strict, build de production, `npm audit --omit=dev` | ✅ 0 erreur, 0 vulnérabilité |

## Terminé

- **Site public** : accueil, annuaire, profils publics, comparateur, missions, appels d'offres, Academy, vérification de certificats, tarifs (depuis la base), pages institutionnelles, pages par public (cabinets, entreprises, ONG/institutions), contact, FAQ, pages légales (projets), sitemap, robots, pages d'erreur. Contenus administrables (CMS).
- **Comptes** : inscription consultant / organisation, vérification email, connexion, mot de passe oublié, invitations, multi-organisation avec changement d'organisation active, consentements, export et suppression des données.
- **Annuaire** : recherche multicritère paginée côté serveur, visibilité du profil, favoris, comparaison, coordonnées jamais exposées.
- **Vérification** : demandes, dépôt sécurisé, contrôles humains par type, badges avec expiration et révocation, journal.
- **Marketplace** : missions (machine à états, quota d'offre), invitations, candidatures, entretiens, shortlists, contrats, avis.
- **Matching** déterministe explicable (pondérations 30/20/15/15/10/10 configurables, normalisées) + constitution d'équipe couvrant les exigences + recommandations de missions pour les experts.
- **Projets** : membres, Kanban, chronologie, livrables, validation, commentaires.
- **Appels d'offres** : veille, alertes, dossiers de réponse, extraction assistée des exigences (marquée brouillon), matrice de conformité, experts clés, consortium.
- **Academy** : cours, modules, leçons, évaluations, progression, certificats à code + QR vérifiables publiquement, espace formateur.
- **Communauté** : publications, commentaires, réactions, abonnements, groupes, événements, mentorat, signalements et modération.
- **CRM** : prospects, conversion, contacts, opportunités par étape (probabilités), activités, devis, export.
- **Monétisation** : offres, prix multi-devises, limites, coupons, souscription, changement d'offre, résiliation, renouvellement, relances, remboursements, commissions.
- **Facturation** : numérotation continue, TVA par pays, mentions vendeur paramétrables, PDF, exports CSV/Excel.
- **Paiements** : adaptateurs, simulateur de test avec webhooks signés, virement avec confirmation manuelle, idempotence.
- **Back-office** : 16 rubriques avec permissions fines et journal d'audit.
- **CEO Dashboard** : KPI documentés (KPI.md) sur données réelles, démo exclue par défaut, filtres, graphiques, exports PDF/CSV/Excel.
- **Notifications** : in-app, modèles administrables, préférences par type et canal, file d'envoi email/SMS avec reprise.
- **Infrastructure** : Docker / Compose, CI GitHub Actions, `.env.example`, tâches planifiées, script de création du premier administrateur, stockage local ou S3.

## Restant / limites connues

| Sujet | État | Proposition |
|---|---|---|
| Prestataire de paiement réel (CinetPay, PayDunya, Wave, Orange Money, Flutterwave, Stripe) | Non intégré — l'interface est prête | Choisir le prestataire, obtenir les accès sandbox, implémenter l'adaptateur (PAYMENTS.md) |
| Envoi réel d'emails / SMS | Adaptateur HTTP générique, non testé avec un fournisseur | Choisir le fournisseur, adapter le format de requête |
| IA sémantique (rédaction d'offres, analyse de TDR par LLM, matching sémantique) | Non implémentée ; matching et extraction **déterministes** | Ajouter une couche optionnelle, résultats toujours marqués « suggestion IA » et relus |
| Visioconférence (sessions live Academy, entretiens) | Lien externe saisi manuellement | Intégration Jitsi / Zoom / Teams |
| Traduction anglaise | Partielle (navigation, site public principal) | Compléter `src/i18n/messages.ts` et les contenus CMS `locale = en` |
| Mode sombre | Non fait | Tokens à dupliquer sous `prefers-color-scheme` |
| Limiteur de débit | En mémoire (par instance) ; Redis prévu mais non branché | Implémenter l'adaptateur Redis avant un déploiement multi-instances |
| Filtres CEO Dashboard | Période, pays, type d'organisation, devise ; **pas encore** par service / offre / statut | Ajouter ces dimensions aux requêtes `ceoKpis` |
| Purge automatique (documents de vérification expirés, contacts anciens) | Non automatisée | Ajouter aux tâches planifiées une fois les durées validées |
| Signature électronique des contrats | Statuts « envoyé / signé » déclaratifs | Intégration d'un service de signature |
| Image Docker | Non construite dans l'environnement de livraison (limite Docker Hub) | Valider au premier build CI |
| Déploiement | **Aucun** (conformément aux consignes) | Après validation explicite et liste de contrôle DEPLOYMENT.md |

## Décisions à valider par Talent Bridge

1. **Prix et offres** du seed (Expert Premium, Organisation Standard / Business / Enterprise, services) : valeurs de départ modifiables dans `/admin/offres`.
2. **Offre « Organisation Découverte » gratuite** (1 mission active, 5 contacts, 2 collaborateurs) ajoutée pour qu'une nouvelle organisation puisse essayer la plateforme ; à conserver, modifier ou désactiver.
3. **Commission** par défaut de 10 % (`commission.defaultBps`).
4. **Taux de TVA** des 16 pays du référentiel (à faire confirmer par un fiscaliste) et régime fiscal du vendeur.
5. **Identité du vendeur** (raison sociale, RCCM, NCC, adresse) pour les factures.
6. **Textes juridiques** (CGU, confidentialité, mentions légales) — projets à faire valider ; formalités ARTCI.
7. **Durées de conservation** (SECURITY.md).
8. **Profil expert privé par défaut** (choix de confidentialité) — l'expert doit le rendre visible.
9. **Seuil de complétude** de 60 % pour apparaître dans l'annuaire, et validité des badges de 730 jours.
10. **Objectif « 72 h »** présenté comme objectif de service, non comme garantie.
