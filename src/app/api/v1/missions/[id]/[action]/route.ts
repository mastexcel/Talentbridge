import { z } from "zod";
import { actions, defineAction } from "@/infrastructure/http/actions";
import { addToShortlist, apply, changeMissionStatus, inviteExpert, updateMission } from "@/application/mission.service";
import { proposeTeamForMission, runMatching } from "@/application/matching.service";
import { applicationSchema, missionSchema, teamRequestSchema } from "@/application/schemas";
import { prisma } from "@/infrastructure/db";

type P = { id: string; action: string };
const STATUSES = ["DRAFT", "PUBLISHED", "SHORTLISTING", "INTERVIEWS", "SELECTION", "CONTRACTING", "IN_PROGRESS", "CLOSED", "CANCELLED"] as const;

export const POST = actions<P>({
  update: defineAction({ schema: missionSchema, run: async ({ user, params }, b) => updateMission(user, params.id, b) }),
  status: defineAction({ schema: z.object({ status: z.enum(STATUSES), note: z.string().max(500).optional().nullable() }), run: async ({ user, params }, b) => changeMissionStatus(user, params.id, b.status, b.note ?? null) }),
  apply: defineAction({ schema: applicationSchema, rateLimit: { limit: 20, windowMs: 3600_000 }, run: async ({ user, params }, b) => ({ application: await apply(user, params.id, b), redirectUrl: "/espace/candidatures" }) }),
  invite: defineAction({ schema: z.object({ expertId: z.string().min(1), message: z.string().max(1000).optional().nullable() }), run: async ({ user, params }, b) => inviteExpert(user, params.id, b.expertId, b.message ?? null) }),
  "run-matching": defineAction({ rateLimit: { limit: 20, windowMs: 3600_000 }, run: async ({ user, params }) => runMatching(user, params.id) }),
  team: defineAction({ schema: teamRequestSchema.omit({ missionId: true }), run: async ({ user, params }, b) => proposeTeamForMission(user, { ...b, missionId: params.id }) }),
  shortlist: defineAction({
    schema: z.object({ expertId: z.string().min(1), note: z.string().max(300).optional().nullable() }),
    run: async ({ user, params }, b) => {
      const m = await prisma.mission.findUniqueOrThrow({ where: { id: params.id }, select: { organizationId: true, title: true } });
      return addToShortlist(user, m.organizationId, { missionId: params.id, name: `Shortlist — ${m.title}`.slice(0, 160), expertId: b.expertId, note: b.note ?? null, shortlistId: (await prisma.shortlist.findFirst({ where: { missionId: params.id, organizationId: m.organizationId } }))?.id });
    },
  }),
});
