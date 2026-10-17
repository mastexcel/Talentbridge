import { z } from "zod";
import { actions, defineAction } from "@/infrastructure/http/actions";
import { decideMatch } from "@/application/matching.service";

export const POST = actions<{ id: string; action: string }>({
  decide: defineAction({ schema: z.object({ decision: z.enum(["ACCEPTED", "DISMISSED"]) }), run: async ({ user, params }, b) => decideMatch(user, params.id, b.decision) }),
});
