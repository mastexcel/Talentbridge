# Démo hébergée (Render)

Instance de **démonstration** accessible par un lien public : site complet, tous les espaces (consultant, organisation, formateur, apprenant, administration, CEO Dashboard), données **fictives**, paiements **simulés**, aucun email envoyé. Elle ne remplace pas la production et ne doit jamais recevoir de données réelles.

## Ce qui est fourni

| Fichier | Rôle |
|---|---|
| `render.yaml` | Blueprint Render : base PostgreSQL 16 + service web Docker, secrets générés par Render |
| `Dockerfile.demo` | Image de démo : `DEMO_SEED`, `TB_HOSTED_DEMO`, `ALLOW_MOCK_PAYMENTS` fixés dans l'image |
| `scripts/demo-start.sh` | Au démarrage : contrôle du mot de passe, migrations, référentiels et données fictives (idempotents), tâches planifiées toutes les 10 min, serveur |

Garde-fous : bandeau « Site de démonstration » sur toutes les pages, pages non indexées par les moteurs de recherche, démarrage refusé sans `DEMO_PASSWORD` propre à l'instance (12 caractères minimum, différent du mot de passe de développement). Les comptes administrateurs fictifs n'existent que dans cette image (`TB_HOSTED_DEMO=true`), jamais dans l'image de production (`Dockerfile`).

## Mise en ligne (une dizaine de minutes)

1. Créer un compte sur https://render.com (connexion avec GitHub).
2. Render › **New** › **Blueprint** › autoriser l'accès au dépôt `mastexcel/Talentbridge` › sélectionner le dépôt.
3. Render lit `render.yaml` et propose de créer `talentbridge-demo-db` et `talentbridge-demo` : **Apply**.
4. Attendre la fin du premier déploiement (construction de l'image puis chargement des données : 10 à 15 minutes).
5. Ouvrir le service `talentbridge-demo` : le lien est affiché en haut (`https://talentbridge-demo-xxxx.onrender.com`).
6. Onglet **Environment** : lire la valeur de `DEMO_PASSWORD` (générée par Render). C'est le mot de passe de tous les comptes de démonstration.

## Comptes de démonstration

Mot de passe : la valeur de `DEMO_PASSWORD` (étape 6).

| Espace | Email |
|---|---|
| Consultant | consultant@demo.talentbridge.africa |
| Cabinet de conseil | cabinet@demo.talentbridge.africa |
| Organisme de formation | formation@demo.talentbridge.africa |
| Super-administrateur | admin@demo.talentbridge.africa |
| Direction (CEO Dashboard) | ceo@demo.talentbridge.africa |
| Vérificateur | verificateur@demo.talentbridge.africa |

Les visiteurs peuvent aussi créer leur propre compte (consultant, organisation, apprenant) : aucun email n'est envoyé, l'adresse n'a pas besoin d'être réelle.

## Offres et limites

`render.yaml` utilise les offres **gratuites** :

- le service s'endort après 15 minutes sans visite ; la visite suivante attend environ une minute ;
- la base gratuite est supprimée par Render au bout de 30 jours ;
- pas de disque persistant : les fichiers déposés par les visiteurs disparaissent au redémarrage ; les images des certificats de démonstration sont régénérées automatiquement.

Pour une démo toujours disponible : passer le service en `starter` et la base en `basic-256mb` (dans `render.yaml` ou dans le tableau de bord Render ; offres payantes, voir les tarifs Render), et ajouter un disque monté sur `/app/storage` pour conserver les fichiers déposés.

## Mise à jour

Chaque push sur la branche indiquée dans `render.yaml` (`branch`) redéploie la démo. Les données existantes sont conservées ; seules les données de démonstration manquantes sont ajoutées.

## Arrêt

Render › service et base › **Settings** › **Delete**. Toutes les données de la démo sont alors supprimées.
