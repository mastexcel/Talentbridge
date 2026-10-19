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
echo "→ Référentiels et données de démonstration (idempotent)"
npx prisma db seed

# Tâches planifiées (activation des inscriptions payées, relances, purge des sessions…).
( while true; do sleep 600; npm run --silent jobs || echo "Tâches planifiées : échec (nouvel essai dans 10 min)"; done ) &

echo "→ Serveur sur le port ${PORT:-3000}"
exec node .next/standalone/server.js
