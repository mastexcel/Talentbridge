# Manuel utilisateur

## Consultant / expert

1. **Inscription** — « Inscription » › Consultant. Confirmez votre email (lien reçu).
2. **Profil** (`/espace/profil`) — Accroche, biographie, domaines, compétences avec niveau, langues, tarif indicatif, mobilité, diplômes, expériences, références, portfolio, CV. La jauge de complétude indique ce qui manque ; à **60 %** votre profil peut apparaître dans l'annuaire. Votre profil est **privé par défaut** : passez-le en « Public » ou « Organisations inscrites » pour être trouvé. Vos coordonnées ne sont jamais affichées.
3. **Disponibilités** (`/espace/disponibilites`) — Statut et périodes.
4. **Vérification** (`/espace/verification`) — Déposez pièce d'identité, diplômes, références, puis « Soumettre ». Un vérificateur Talent Bridge contrôle chaque pièce ; les badges n'apparaissent qu'après validation.
5. **Missions** (`/espace/missions`) — Missions recommandées (avec score expliqué) et recherche ; « Candidater » avec proposition technique, tarif et disponibilité. Suivi dans **Candidatures**, invitations reçues, entretiens.
6. **Contrats et projets** — Contrats, puis espace projet : tâches, livrables à déposer, commentaires. Avis échangés en fin de contrat.
7. **Certificat « Consultant vérifié »** (`/espace/verification`) — Dès que votre identité ET vos diplômes et références sont vérifiés, cliquez sur « Obtenir mon certificat » : certificat numéroté (TB-CV-AAAA-NNNNNN), signé par Talent Bridge, avec date de validité et QR code, téléchargeable en PDF. Il n'atteste que les contrôles réellement effectués.
8. **Formations** — Academy : suivre un cours, passer l'évaluation, obtenir un **certificat vérifiable par QR code** (`/certificats/<code>`).
9. **Alertes** — Recevoir les nouvelles missions / appels d'offres correspondant à vos critères.
10. **Communauté** — Publications, groupes, mentorat ; signaler un contenu inapproprié.

## Organisation (cabinet, entreprise, ONG, institution, bailleur, formation)

1. **Inscription** — « Inscription » › Organisation. L'organisation est **validée par Talent Bridge** avant de pouvoir publier.
2. **Équipe** (`/organisation/equipe`) — Inviter des collaborateurs et attribuer un rôle : Propriétaire, Administrateur, Recruteur, Chef de projet, Collaborateur, Lecteur (droits détaillés dans ARCHITECTURE.md). Un utilisateur membre de plusieurs organisations change d'organisation active depuis le menu.
3. **Missions** (`/organisation/missions`) — « Nouvelle mission » : description, exigences (compétence, niveau, obligatoire ou non), budget, lieu, dates. Enregistrée en brouillon, puis « Publier » (dans la limite de votre offre).
4. **Matching** — Sur la mission : « Lancer le matching ». Chaque expert recommandé a un score sur 100 détaillé par critère (compétences, expérience, domaine, disponibilité, localisation/langues, vérification) et les raisons. « Proposer une équipe » compose une équipe couvrant toutes les exigences. Inviter, présélectionner (shortlists), comparer.
5. **Candidatures** — Présélectionner, planifier un entretien, retenir ou refuser (motif), puis **créer le contrat**.
6. **Projets** (`/projets`) — Tableau Kanban, chronologie, livrables à valider, messagerie.
7. **Appels d'offres** (`/organisation/appels-offres`) — Veille, alertes, dossier de réponse : extraction assistée des exigences (brouillon à relire), matrice de conformité, experts clés, consortium.
8. **CRM** (`/organisation/crm`) — Prospects, contacts, opportunités par étape, activités, devis.
9. **Rapports** (`/organisation/rapports`) — Indicateurs de votre organisation (missions, candidatures, contrats, dépenses). Export CSV/Excel des opportunités depuis la page CRM ; factures téléchargeables une à une en PDF depuis Facturation.
10. **Facturation** (`/facturation`) — Choisir une offre, payer (Mobile Money, carte, virement), télécharger les factures PDF. Un paiement n'est « Payé » qu'après confirmation du prestataire ou réception du virement.

## Apprenant (toute personne souhaitant se former)

1. **Catalogue** (`/academy`) — Formations et séminaires, filtrables par type, format, thématique, niveau et prix ; agenda des prochaines sessions avec lieu et places restantes.
2. **Compte** — « Créer un compte apprenant » (`/inscription/apprenant`) : gratuit, sans profil d'expert ni organisation (un profil d'expert peut être créé plus tard).
3. **Inscription** — Formation en ligne : accès immédiat. Classe virtuelle, présentiel, hybride ou séminaire : choisir une session ; la place est réservée à l'inscription (confirmée au paiement pour une formation payante). Le lien de connexion d'une session en ligne n'est visible que des inscrits.
4. **Suivi** (`/espace/formations`) — Inscriptions, session choisie, progression, présence, certificats.
5. **Certificat** — En ligne : leçons terminées et évaluation réussie. Sessions : présence attestée par le formateur (plus leçons et évaluation s'il y en a). Séminaires : certificat de participation.

## Formateur / organisme de formation

1. **Créer une formation ou un séminaire** (`/academy/formateur`) : type, format, thématique, public visé, langue ; leçons, évaluation finale, seuil de réussite. Pour les formats en sessions : **programmer les sessions** (date et heure GMT, durée, mode, lien ou lieu, places) et, une fois la session commencée, **attester la présence** de chaque inscrit.
2. **Certificat de la formation** (même page) : renseigner l'institution qui délivre la formation — nom, devise, **logo**, **cachet**, **nom et fonction du signataire**, **signature** (PNG ou JPEG) — cocher l'attestation d'autorisation, puis « Soumettre à la validation de Talent Bridge ». Une institution déjà validée peut être réutilisée pour d'autres formations.
3. **Aperçu** : « Aperçu du certificat (spécimen) » montre le rendu exact avec vos éléments.
4. **Mise en ligne** : possible lorsque l'institution est validée, que Talent Bridge a désigné son cosignataire et, pour les formats en sessions, qu'au moins une session à venir est programmée ; la liste de ce qui manque est affichée tant que ce n'est pas le cas.

## Application mobile

Talent Bridge s'installe comme une application, gratuitement et sans magasin d'applications (page `/application`) :
- **Android (Chrome)** : bannière « Installer », ou menu ⋮ › « Installer l'application » ;
- **iPhone / iPad (Safari)** : Partager › « Sur l'écran d'accueil » ;
- **Ordinateur (Chrome, Edge)** : icône d'installation dans la barre d'adresse.

L'application s'ouvre en plein écran, se met à jour automatiquement et affiche un message clair hors connexion. Aucune donnée personnelle n'est conservée sur l'appareil.

## Affichage

Toutes les interfaces s'adaptent à l'ordinateur, à la tablette (portrait et paysage) et au téléphone. Les certificats conservent leur mise en page sur tous les écrans ; sur téléphone, les informations clés sont affichées en clair au-dessus du certificat et le PDF est téléchargeable.

## Paramètres (tous)

`/parametres` : mot de passe, préférences de notification (in-app, email, SMS par type), consentements, **export de mes données**, suppression du compte. Langue : sélecteur FR / EN dans l'en-tête du site public (traduction anglaise partielle).
