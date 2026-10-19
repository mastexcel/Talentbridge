# Talent Bridge

Plateforme SaaS panafricaine de mise en relation entre **experts / consultants** et **cabinets, entreprises, ONG, institutions, bailleurs et organismes de formation** : annuaire vérifié, marketplace de missions, matching explicable, équipes projet, appels d'offres, Academy, communauté, CRM, abonnements, facturation et tableau de bord direction.

> Multi-organisation, multi-pays, multi-devises. Les données de démonstration sont **fictives** et marquées « Démo » partout.

## Démarrage rapide (développement)

```bash
cp .env.example .env            # puis renseigner les secrets (openssl rand -base64 32)
npm ci
npx prisma migrate deploy       # PostgreSQL 16 requis (ou : docker compose up db)
npx prisma db seed              # référentiels + démo si DEMO_SEED=true
npm run dev                     # http://localhost:3000
```

Comptes de démonstration (hors production uniquement, mot de passe = `DEMO_PASSWORD`) :

| Rôle | Email |
|---|---|
| Super-administrateur | admin@demo.talentbridge.africa |
| Direction (CEO Dashboard, finances, audit) | ceo@demo.talentbridge.africa |
| Vérificateur | verificateur@demo.talentbridge.africa |
| Consultant | consultant@demo.talentbridge.africa |
| Cabinet / Entreprise / ONG / Institution / Formation | cabinet@, entreprise@, ong@, institution@, formation@demo.talentbridge.africa |
| Recruteur multi-organisation | recruteur@demo.talentbridge.africa |

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` / `build` / `start` | Développement, build de production, serveur |
| `npm run lint` / `typecheck` | ESLint, TypeScript strict |
| `npm test` | Vitest : tests unitaires + intégration (base `TEST_DATABASE_URL`, vidée à chaque test) |
| `npm run test:e2e` | Playwright : 14 parcours critiques + affichage mobile (après `npm run build`) |
| `npm run db:deploy` / `db:seed` | Migrations, seed |
| `npm run jobs` | Tâches planifiées (renouvellements, relances, expirations, file email/SMS) |
| `docker compose up --build` | PostgreSQL + Redis + MinIO + migrations + application |

## Documentation

| Document | Contenu |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architecture, arborescence, modules, matrice des rôles, plan, critères MVP |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Modèle de données, migrations, règles d'intégrité |
| [docs/API.md](docs/API.md) | API REST `/api/v1` |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Charte, tokens, composants |
| [docs/KPI.md](docs/KPI.md) | Définition et requête de chaque indicateur |
| [docs/PAYMENTS.md](docs/PAYMENTS.md) | Paiements, webhooks, brancher un prestataire réel |
| [docs/SECURITY.md](docs/SECURITY.md) | Sécurité, données personnelles, conservation |
| [docs/INSTALL.md](docs/INSTALL.md) / [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Installation, déploiement |
| [docs/DEMO_HEBERGEE.md](docs/DEMO_HEBERGEE.md) | Démo hébergée (Render) : lien public, données fictives |
| [docs/ADMIN_MANUAL.md](docs/ADMIN_MANUAL.md) / [docs/USER_MANUAL.md](docs/USER_MANUAL.md) | Manuels |
| [docs/FEATURES.md](docs/FEATURES.md) | Fonctionnalités terminées, restantes, décisions à valider |

## Stack

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind CSS 4 · composants maison (style shadcn) · Lucide · Recharts · React Hook Form + Zod · PostgreSQL 16 + Prisma 6 · stockage local ou S3 (MinIO, AWS, Scaleway…) · pdf-lib · exceljs · Vitest · Playwright · Docker · GitHub Actions.
