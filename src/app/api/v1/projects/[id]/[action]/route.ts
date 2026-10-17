import { z } from "zod";
import { actions, defineAction } from "@/infrastructure/http/actions";
import { addProjectMember, createTask, updateProjectStatus } from "@/application/project.service";
import { taskSchema } from "@/application/schemas";

export const POST = actions<{ id: string; action: string }>({
  member: defineAction({
    schema: z.object({ expertId: z.string().optional(), userId: z.string().optional(), role: z.enum(["LEAD", "CONSULTANT", "CLIENT_REVIEWER", "OBSERVER"]), responsibilities: z.string().max(500).optional().nullable() }),
    run: async ({ user, params }, b) => addProjectMember(user, params.id, { ...b, expertId: b.expertId || undefined, userId: b.userId || undefined, responsibilities: b.responsibilities ?? null }),
  }),
  task: defineAction({ schema: taskSchema, run: async ({ user, params }, b) => createTask(user, params.id, b) }),
  status: defineAction({ schema: z.object({ status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]) }), run: async ({ user, params }, b) => updateProjectStatus(user, params.id, b.status) }),
});
