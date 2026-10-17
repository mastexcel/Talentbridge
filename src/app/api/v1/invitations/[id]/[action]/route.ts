import { z } from "zod";
import { actions, defineAction } from "@/infrastructure/http/actions";
import { respondInvitation } from "@/application/mission.service";

export const POST = actions<{ id: string; action: string }>({
  respond: defineAction({ schema: z.object({ accept: z.boolean() }), run: async ({ user, params }, b) => respondInvitation(user, params.id, b.accept) }),
});
