import { parseBody, route } from "@/infrastructure/http/handler";
import { submitContact } from "@/application/cms.service";
import { contactSchema } from "@/application/schemas";

export const POST = route({ rateLimit: { limit: 5, windowMs: 3600_000 } }, async ({ req }) => {
  await submitContact(await parseBody(req, contactSchema));
  return { ok: true };
});
