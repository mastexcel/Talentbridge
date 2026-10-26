#!/bin/sh
# Démarrage de l'instance de démonstration hébergée (voir Dockerfile.demo et docs/DEMO_HEBERGEE.md).
set -e
cd "$(dirname "$0")/.."

if [ "$DEMO_SEED" != "true" ]; then
  echo "DEMO_SEED doit valoir true : ce script est réservé à l'instance de démonstration." >&2
  exit 1
fi

# Les comptes de démonstration (dont administrateurs) sont publics sur Internet : mot de passe propre obligatoire.
if [ -z "$DEMO_PASSWORD" ] || [ "$DEMO_PASSWORD" = "Demo2026!TB" ] || [ ${#DEMO_PASSWORD} -lt 12 ]; then
  echo "DEMO_PASSWORD doit être défini (12 caractères minimum) et différent du mot de passe de développement." >&2
  exit 1
fi

echo "→ Migrations"
npx prisma migrate deploy
# Données de démonstration : rechargées seulement si les scripts de seed ou DEMO_PASSWORD ont changé
# (le rechargement complet ralentissait chaque réveil de l'instance).
if node scripts/demo-seed-state.mjs check; then
  echo "→ Données de démonstration à jour"
  # Images de démonstration (stockage effacé au redémarrage) : régénérées en arrière-plan, serveur déjà lancé.
  ( sleep 20; npx tsx scripts/demo-restore-files.ts ) &
else
  echo "→ Référentiels et données de démonstration (idempotent)"
  npx prisma db seed
  node scripts/demo-seed-state.mjs mark || echo "Version des données non mémorisée (le prochain démarrage rechargera les données)"
fi

# Tâches planifiées (activation des inscriptions payées, relances, purge des sessions…).
( while true; do sleep 600; npm run --silent jobs || echo "Tâches planifiées : échec (nouvel essai dans 10 min)"; done ) &

echo "→ Serveur sur le port ${PORT:-3000}"
exec node .next/standalone/server.js
