/**
 * Répartiteur d'actions : POST /api/v1/<ressource>/[id]/<action>.
 * Chaque action déclare son schéma zod (validation systématique) et son éventuelle limite de débit.
 * Les permissions (organisation, administration, propriété) sont contrôlées par les services.
 */
import type { NextRequest } from "next/server";
import type { ZodType, ZodTypeDef } from "zod";
import { DomainError } from "@/domain/errors";
import type { SessionUser } from "@/application/auth.service";
import { rateLimiter } from "../rate-limit";
import { parseBody, route, withIdempotency, type HandlerOptions } from "./handler";

export interface ActionCtx<P> {
  req: NextRequest;
  user: SessionUser;
  params: P;
  ip: string;
}

export interface ActionDef<P, B> {
  schema?: ZodType<B, ZodTypeDef, unknown>;
  rateLimit?: { limit: number; windowMs: number };
  /** Rejoue la réponse d'une requête déjà traitée portant la même clé Idempotency-Key. */
  idempotent?: boolean;
  run: (ctx: ActionCtx<P>, body: B) => Promise<unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function defineAction<P, B>(def: ActionDef<P, B>): ActionDef<P, any> {
  return def;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function actions<P extends { action: string }>(defs: Record<string, ActionDef<P, any>>, opts: HandlerOptions = { auth: true }) {
  return route<P>(opts, async ({ req, user, params, ip }) => {
    const def = defs[params.action];
    if (!def) throw new DomainError("NOT_FOUND", "Action inconnue.");
    if (!user) throw new DomainError("UNAUTHENTICATED", "Connectez-vous pour continuer.");
    if (def.rateLimit) {
      const r = rateLimiter.hit(`${params.action}:${user.id}`, def.rateLimit.limit, def.rateLimit.windowMs);
      if (!r.allowed) throw new DomainError("RATE_LIMITED", "Trop de requêtes. Patientez un instant.");
    }
    const body = def.schema ? await parseBody(req, def.schema) : await req.json().catch(() => ({}));
    const run = async () => (await def.run({ req, user, params, ip }, body)) ?? { ok: true };
    return def.idempotent ? withIdempotency(req, user.id, `${req.nextUrl.pathname}`, run) : run();
  });
}
