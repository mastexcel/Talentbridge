import { z } from "zod";
import { actions, defineAction } from "@/infrastructure/http/actions";
import { requireActiveOrg } from "@/application/access";
import { attachOrgDocument, changeMemberRole, inviteMember, revokeInvitation, updateOrganization } from "@/application/organization.service";
import { removeFromShortlist } from "@/application/mission.service";
import { publishTender } from "@/application/tender.service";
import { inviteSchema, organizationSchema, ORG_ROLES, tenderSchema } from "@/application/schemas";

/** Actions sur l'organisation ACTIVE de la session (contrôle du rôle dans les services). */
export const POST = actions<{ action: string }>({
  update: defineAction({ schema: organizationSchema, run: async ({ user }, b) => updateOrganization(user, requireActiveOrg(user, "org.manage").organizationId, b) }),
  invite: defineAction({ schema: inviteSchema, rateLimit: { limit: 30, windowMs: 3600_000 }, run: async ({ user }, b) => { await inviteMember(user, requireActiveOrg(user, "members.manage").organizationId, b.email, b.role); } }),
  "revoke-invitation": defineAction({ schema: z.object({ invitationId: z.string().min(1) }), run: async ({ user }, b) => revokeInvitation(user, requireActiveOrg(user, "members.manage").organizationId, b.invitationId) }),
  "member-role": defineAction({ schema: z.object({ userId: z.string().min(1), role: z.enum(ORG_ROLES).nullable() }), run: async ({ user }, b) => changeMemberRole(user, requireActiveOrg(user, "members.manage").organizationId, b.userId, b.role) }),
  document: defineAction({ schema: z.object({ fileId: z.string().min(1), kind: z.string().trim().min(2).max(80) }), run: async ({ user }, b) => attachOrgDocument(user, requireActiveOrg(user, "org.manage").organizationId, b.fileId, b.kind) }),
  "shortlist-remove": defineAction({ schema: z.object({ shortlistId: z.string(), expertId: z.string() }), run: async ({ user }, b) => removeFromShortlist(user, requireActiveOrg(user, "shortlists.manage").organizationId, b.shortlistId, b.expertId) }),
  "tender-publish": defineAction({ schema: tenderSchema, run: async ({ user }, b) => ({ tender: await publishTender(user, b, false), redirectUrl: "/organisation/appels-offres" }) }),
});
