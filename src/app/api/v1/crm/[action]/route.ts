import { z } from "zod";
import { optionalDate } from "@/application/schemas";
import { actions, defineAction } from "@/infrastructure/http/actions";
import { addActivity, completeActivity, convertLead, createContact, createLead, createOpportunity, createQuote, moveOpportunity } from "@/application/crm.service";
import { activitySchema, crmContactSchema, leadSchema, opportunitySchema } from "@/application/schemas";

const STAGES = ["PROSPECT", "QUALIFIED", "NEED_IDENTIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"] as const;

export const POST = actions<{ action: string }>({
  opportunity: defineAction({ schema: opportunitySchema, run: async ({ user }, b) => createOpportunity(user, b) }),
  move: defineAction({ schema: z.object({ id: z.string(), stage: z.enum(STAGES), lostReason: z.string().max(300).optional().nullable() }), run: async ({ user }, b) => moveOpportunity(user, b.id, b.stage, b.lostReason ?? null) }),
  lead: defineAction({ schema: leadSchema, run: async ({ user }, b) => createLead(user, b) }),
  convert: defineAction({ schema: z.object({ leadId: z.string(), title: z.string().trim().min(2).max(160), value: z.coerce.number().min(0), currency: z.string().length(3) }), run: async ({ user }, b) => convertLead(user, b.leadId, b) }),
  contact: defineAction({ schema: crmContactSchema, run: async ({ user }, b) => createContact(user, b) }),
  activity: defineAction({ schema: activitySchema, run: async ({ user }, b) => addActivity(user, b) }),
  "activity-done": defineAction({ schema: z.object({ id: z.string() }), run: async ({ user }, b) => completeActivity(user, b.id) }),
  quote: defineAction({ schema: z.object({ opportunityId: z.string(), title: z.string().trim().min(2).max(160), amount: z.coerce.number().min(0), currency: z.string().length(3), validUntil: optionalDate }), run: async ({ user }, b) => createQuote(user, b.opportunityId, { ...b, validUntil: b.validUntil ?? null }) }),
});
