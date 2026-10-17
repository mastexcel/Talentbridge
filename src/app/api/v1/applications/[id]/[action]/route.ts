import { z } from "zod";
import { actions, defineAction } from "@/infrastructure/http/actions";
import { decideApplication, scheduleInterview, withdraw } from "@/application/mission.service";
import { createContractFromApplication } from "@/application/project.service";
import { applicationDecisionSchema, interviewSchema } from "@/application/schemas";
import { toMinor } from "@/domain/money";
import { prisma } from "@/infrastructure/db";

type P = { id: string; action: string };

export const POST = actions<P>({
  decide: defineAction({ schema: applicationDecisionSchema, run: async ({ user, params }, b) => decideApplication(user, params.id, b.status, b.note) }),
  interview: defineAction({ schema: interviewSchema, run: async ({ user, params }, b) => scheduleInterview(user, params.id, b) }),
  withdraw: defineAction({ run: async ({ user, params }) => withdraw(user, params.id) }),
  contract: defineAction({
    schema: z.object({ amount: z.coerce.number().positive(), startDate: z.coerce.date().optional().nullable(), endDate: z.coerce.date().optional().nullable(), terms: z.string().max(10000).optional().nullable() }),
    run: async ({ user, params }, b) => {
      const app = await prisma.application.findUniqueOrThrow({ where: { id: params.id }, include: { mission: { select: { currency: true } } } });
      const c = await createContractFromApplication(user, params.id, { amountMinor: toMinor(b.amount, app.mission.currency), startDate: b.startDate ?? null, endDate: b.endDate ?? null, terms: b.terms ?? null });
      return { contract: c, redirectUrl: "/organisation/contrats" };
    },
  }),
});
