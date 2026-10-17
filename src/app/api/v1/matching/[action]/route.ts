import { z } from "zod";
import { actions, defineAction } from "@/infrastructure/http/actions";
import { analyzeNeed, quickMatch } from "@/application/matching.service";
import { needAnalysisSchema } from "@/application/schemas";

export const POST = actions<{ action: string }>({
  analyze: defineAction({ schema: needAnalysisSchema, rateLimit: { limit: 60, windowMs: 3600_000 }, run: async (_c, b) => ({ skills: await analyzeNeed(b.text) }) }),
  quick: defineAction({ schema: z.object({ skillIds: z.array(z.string()).min(1).max(10), countryCode: z.string().length(2).optional(), workMode: z.enum(["ONSITE", "REMOTE", "HYBRID"]).optional() }), run: async ({ user }, b) => ({ results: await quickMatch(user, b) }) }),
});
