# Installation

## Prérequis

- Node.js 22 et npm 10
- PostgreSQL 16 (extension `pg_trgm`, créée par la migration)
- Facultatif : Docker + Docker Compose (PostgreSQL, Redis, MinIO prêts à l'emploi)

## Option A — Docker Compose (tout-en-un)

```bash
cp .env.example .env
# Renseigner SESSION_SECRET, FILE_SIGNING_SECRET, CRON_SECRET, PAYMENT_WEBHOOK_SECRET, DEMO_PASSWORD
# (openssl rand -base64 32). Pour MinIO : STORAGE_DRIVER=s3, S3_BUCKET=talentbridge,
# S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY identiques à ceux de docker-compose.yml.
docker compose up --build
```

Le service `migrate` applique les migrations puis le seed (référentiels + démo si `DEMO_SEED=true`) avant le démarrage de `app` sur http://localhost:3000. Console MinIO : http://localhost:9001.

## Option B — Installation locale

```bash
cp .env.example .env               # renseigner les secrets et DATABASE_URL
npm ci
createdb talentbridge               # ou via psql
npx prisma migrate deploy
npx prisma db seed
npm run dev                         # http://localhost:3000
```

Stockage par défaut : dossier local `./storage` (`STORAGE_DRIVER=local`). Emails et SMS : journalisés dans la console (`EMAIL_PROVIDER=log`) — aucun envoi réel ; les liens de vérification d'email apparaissent dans les journaux.

## Tests

```bash
createdb talentbridge_test
DATABASE_URL=postgresql://…/talentbridge_test npx prisma migrate deploy
npm test                 # unitaires + intégration (la base de test est vidée à chaque fichier)
npm run build
npm run test:e2e         # Playwright (démarre le serveur de production sur le port 3100 ; base = DATABASE_URL avec démo)
```

Les tests E2E utilisent la base `DATABASE_URL` seedée avec la démo et y créent des comptes de test (`@test.local`). Ne jamais les lancer contre une base de production.

## Tâches planifiées

```bash
npm run jobs             # à planifier toutes les 15 minutes (cron)
# ou : curl -X POST -H "x-cron-secret: $CRON_SECRET" https://<domaine>/api/v1/jobs
```

## Problèmes courants

| Symptôme | Cause / solution |
|---|---|
| `Configuration invalide : SESSION_SECRET…` au démarrage | Variable manquante ou trop courte — compléter `.env` |
| « Le paiement en ligne n'est pas encore activé » en production | Normal : simulateur interdit en production. Configurer un prestataire réel ou `ALLOW_MOCK_PAYMENTS=true` pour une démo |
| Une organisation ne peut pas publier de mission | Organisation non validée, ou quota `missions.active` de son offre atteint |
| Profil expert absent de l'annuaire | Profil privé par défaut ou complétude < 60 % |
