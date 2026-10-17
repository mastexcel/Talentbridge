import { parseBody, route } from "@/infrastructure/http/handler";
import { startConversation } from "@/application/messaging.service";
import { newConversationSchema } from "@/application/schemas";

export const POST = route({ auth: true, rateLimit: { limit: 30, windowMs: 3600_000, key: "user" } }, async ({ req, user }) => {
  const c = await startConversation(user!, await parseBody(req, newConversationSchema));
  return { conversation: c, redirectUrl: `/messages/${c.id}` };
});
