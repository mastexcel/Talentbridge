import { DomainError } from "@/domain/errors";
import { safeEqual } from "@/infrastructure/crypto";
import { env } from "@/infrastructure/env";
import { route } from "@/infrastructure/http/handler";
import { runJobs } from "@/application/jobs.service";

/** Déclenchement des tâches planifiées par un cron externe (en-tête x-cron-secret). */
export const POST = route({ external: true }, async ({ req }) => {
  if (!safeEqual(req.headers.get("x-cron-secret") ?? "", env().CRON_SECRET)) throw new DomainError("FORBIDDEN", "Secret invalide.");
  return runJobs();
});
