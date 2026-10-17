import { parseQuery, route } from "@/infrastructure/http/handler";
import { searchExperts } from "@/application/expert.service";
import { expertSearchSchema } from "@/application/schemas";

/** Recherche d'experts (pagination serveur). Coordonnées jamais incluses. */
export const GET = route({ rateLimit: { limit: 120, windowMs: 60_000 } }, async ({ req, user }) => searchExperts(user, parseQuery(req, expertSearchSchema)));
