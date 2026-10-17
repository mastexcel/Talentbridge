import { z } from "zod";
import { actions, defineAction } from "@/infrastructure/http/actions";
import { deleteAlert, saveAlert, startBid } from "@/application/tender.service";
import { tenderAlertSchema } from "@/application/schemas";

export const POST = actions<{ action: string }>({
  "alert-create": defineAction({ schema: tenderAlertSchema, run: async ({ user }, b) => saveAlert(user, b) }),
  "alert-delete": defineAction({ schema: z.object({ id: z.string() }), run: async ({ user }, b) => deleteAlert(user.id, b.id) }),
  "bid-start": defineAction({ schema: z.object({ tenderId: z.string() }), run: async ({ user }, b) => { const bid = await startBid(user, b.tenderId); return { bid, redirectUrl: `/organisation/appels-offres/${bid.id}` }; } }),
});
