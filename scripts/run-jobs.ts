/**
 * Exécution ponctuelle des tâches planifiées (renouvellements, relances, expirations,
 * rappels d'échéance, purge des sessions, envoi de la file email/SMS).
 * Usage : `npm run jobs` (cron système). En hébergement sans accès shell, appeler
 * POST /api/v1/jobs avec l'en-tête x-cron-secret.
 */
import "dotenv/config";
import { runJobs } from "../src/application/jobs.service";
import { prisma } from "../src/infrastructure/db";

runJobs()
  .then((r) => console.log(JSON.stringify(r)))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
