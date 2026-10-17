import { z } from "zod";
import { actions, defineAction } from "@/infrastructure/http/actions";
import { requireExpert } from "@/application/access";
import { addDocument, getOrCreateRequest, submitRequest } from "@/application/verification.service";

/** Côté expert : ouverture d'une demande, dépôt des justificatifs, soumission. */
export const POST = actions<{ action: string }>({
  request: defineAction({ schema: z.object({ type: z.enum(["IDENTITY", "DOCUMENTS", "SKILLS"]) }), run: async ({ user }, b) => ({ request: await getOrCreateRequest(requireExpert(user).expertId, b.type) }) }),
  document: defineAction({
    schema: z.object({ requestId: z.string().min(1), fileId: z.string().min(1), kind: z.enum(["ID_CARD", "PASSPORT", "DIPLOMA", "CERTIFICATE", "REFERENCE_LETTER", "OTHER"]), label: z.string().max(160).optional().nullable() }),
    run: async ({ user }, b) => addDocument(user, requireExpert(user).expertId, b.requestId, b.fileId, b.kind, b.label ?? null),
  }),
  submit: defineAction({ schema: z.object({ requestId: z.string().min(1) }), run: async ({ user }, b) => submitRequest(user, requireExpert(user).expertId, b.requestId) }),
});
