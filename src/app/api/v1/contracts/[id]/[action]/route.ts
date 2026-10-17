import { z } from "zod";
import { actions, defineAction } from "@/infrastructure/http/actions";
import { reviewContract, transitionContract } from "@/application/project.service";

export const POST = actions<{ id: string; action: string }>({
  status: defineAction({ schema: z.object({ status: z.enum(["SENT", "SIGNED", "ACTIVE", "COMPLETED", "TERMINATED", "DRAFT"]) }), run: async ({ user, params }, b) => transitionContract(user, params.id, b.status) }),
  review: defineAction({ schema: z.object({ rating: z.coerce.number().int().min(1).max(5), comment: z.string().max(2000).optional().nullable() }), run: async ({ user, params }, b) => reviewContract(user, params.id, b.rating, b.comment ?? null) }),
});
