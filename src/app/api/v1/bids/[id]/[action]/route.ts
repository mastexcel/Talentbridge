import { z } from "zod";
import { actions, defineAction } from "@/infrastructure/http/actions";
import { addBidExpert, addRequirement, deleteRequirement, extractBidRequirements, setBidStatus, setConsortium, updateRequirement } from "@/application/tender.service";
import { bidRequirementSchema } from "@/application/schemas";

export const POST = actions<{ id: string; action: string }>({
  extract: defineAction({ schema: z.object({ tdrText: z.string().max(50000).optional().nullable() }), run: async ({ user, params }, b) => extractBidRequirements(user, params.id, b.tdrText ?? null) }),
  "requirement-add": defineAction({ schema: bidRequirementSchema, run: async ({ user, params }, b) => addRequirement(user, params.id, b) }),
  "requirement-update": defineAction({ schema: z.object({ requirementId: z.string(), status: z.enum(["MISSING", "IN_PROGRESS", "READY"]).optional(), fileId: z.string().nullable().optional(), confirm: z.boolean().optional() }), run: async ({ user }, b) => updateRequirement(user, b.requirementId, b) }),
  "requirement-delete": defineAction({ schema: z.object({ requirementId: z.string() }), run: async ({ user }, b) => deleteRequirement(user, b.requirementId) }),
  expert: defineAction({ schema: z.object({ expertId: z.string().min(1), role: z.string().trim().min(2).max(120) }), run: async ({ user, params }, b) => addBidExpert(user, params.id, b.expertId, b.role) }),
  consortium: defineAction({ schema: z.object({ name: z.string().trim().min(2).max(160), partnerOrgIds: z.array(z.string()).max(10) }), run: async ({ user, params }, b) => setConsortium(user, params.id, b.name, b.partnerOrgIds) }),
  status: defineAction({ schema: z.object({ status: z.enum(["WATCHING", "PREPARING", "SUBMITTED", "WON", "LOST", "WITHDRAWN"]) }), run: async ({ user, params }, b) => setBidStatus(user, params.id, b.status) }),
});
