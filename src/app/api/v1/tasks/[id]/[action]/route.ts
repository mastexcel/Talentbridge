import { z } from "zod";
import { actions, defineAction } from "@/infrastructure/http/actions";
import { commentTask, moveTask, reviewDeliverable, submitDeliverable } from "@/application/project.service";

export const POST = actions<{ id: string; action: string }>({
  move: defineAction({ schema: z.object({ status: z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE"]) }), run: async ({ user, params }, b) => moveTask(user, params.id, b.status) }),
  deliverable: defineAction({ schema: z.object({ fileId: z.string().min(1) }), run: async ({ user, params }, b) => submitDeliverable(user, params.id, b.fileId) }),
  review: defineAction({ schema: z.object({ approve: z.boolean(), comment: z.string().max(2000).optional().nullable() }), run: async ({ user, params }, b) => reviewDeliverable(user, params.id, b.approve, b.comment ?? null) }),
  comment: defineAction({ schema: z.object({ body: z.string().trim().min(1).max(2000) }), run: async ({ user, params }, b) => commentTask(user, params.id, b.body) }),
});
