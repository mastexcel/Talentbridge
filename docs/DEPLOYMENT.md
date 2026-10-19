# Déploiement

> **Aucun déploiement en production n'a été effectué.** Toute mise en production doit être validée explicitement par le porteur du projet, après la liste de contrôle ci-dessous.

## Architecture cible

- Application : conteneur `Dockerfile` (cible `runner`, Next.js standalone, utilisateur non root, healthcheck `/api/v1/health`), 2 instances minimum derrière un équilibreur HTTPS.
- Base : PostgreSQL 16 managé, sauvegardes quotidiennes + PITR, chiffrement au repos.
- Fichiers : stockage objet S3 compatible (AWS S3, Scaleway, OVH, MinIO) — `STORAGE_DRIVER=s3`, bucket **privé**.
- Tâches planifiées : cron toutes les 15 minutes appelant `POST /api/v1/jobs` (en-tête `x-cron-secret`) ou exécutant la cible `tools` avec `npm run jobs`.
- Email / SMS : fournisseur transactionnel (Brevo, Mailjet, Twilio, Orange SMS…) via `EMAIL_PROVIDER=http` / `SMS_PROVIDER=http` (adaptateur à ajuster au format du fournisseur).
- Hébergement des données : à choisir en fonction des exigences ARTCI / transferts transfrontaliers.

## Procédure

```bash
docker build --target runner -t talentbridge:<version> .
docker build --target tools  -t talentbridge-tools:<version> .
# 1. Migrations (avant de basculer le trafic)
docker run --rm --env-file prod.env talentbridge-tools:<version> npx prisma migrate deploy
# 2. Référentiels (idempotent) — la démo n'est créée que si DEMO_SEED=true : NE PAS l'activer en production
docker run --rm --env-file prod.env -e DEMO_SEED=false talentbridge-tools:<version> npx prisma db seed
# 3. Application
docker run -d --env-file prod.env -p 3000:3000 talentbridge:<version>
```

La CI (`.github/workflows/ci.yml`) exécute lint, typecheck, migrations, tests unitaires/intégration, build, E2E et audit des dépendances à chaque push.

## Liste de contrôle avant production

- [ ] `NODE_ENV=production`, `APP_URL` en HTTPS, secrets générés aléatoirement et stockés dans un coffre (jamais dans le dépôt).
- [ ] `DEMO_SEED=false`, `ALLOW_MOCK_PAYMENTS` et `TB_HOSTED_DEMO` absents, image `Dockerfile` (jamais `Dockerfile.demo`) ; aucune donnée `isDemo` en base.
- [ ] Premier super-administrateur créé avec `ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run admin:create` (cible `tools`), puis permissions fines attribuées aux autres administrateurs dans `/admin/utilisateurs` ; aucun compte `@demo.talentbridge.africa`.
- [ ] Prestataire de paiement réel intégré, testé en sandbox, URL de webhook déclarée (`docs/PAYMENTS.md`).
- [ ] Fournisseur email configuré (SPF, DKIM, DMARC sur le domaine d'envoi).
- [ ] Identité vendeur et mentions fiscales renseignées (`/admin/finances`) ; taux de TVA vérifiés par un fiscaliste.
- [ ] Prix et offres validés (`/admin/offres`).
- [ ] CGU, politique de confidentialité, mentions légales validées par un juriste (`/admin/contenus`).
- [ ] Formalités ARTCI accomplies.
- [ ] Sauvegardes testées (restauration), supervision (logs JSON, alertes sur `/api/v1/health` et erreurs `api.unhandled`).
- [ ] Limiteur de débit partagé (Redis) si plusieurs instances — voir FEATURES.md.
- [ ] Test de charge et test d'intrusion.

## Image Docker

L'image n'a **pas pu être construite dans l'environnement de développement de la livraison** (limite de téléchargements Docker Hub). Le `Dockerfile` suit la procédure standard Next.js standalone ; à valider lors du premier build en CI ou sur poste.
