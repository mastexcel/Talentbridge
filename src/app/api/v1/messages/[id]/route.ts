import { parseBody, route } from "@/infrastructure/http/handler";
import { sendMessage } from "@/application/messaging.service";
import { messageSchema } from "@/application/schemas";

export const POST = route<{ id: string }>({ auth: true, rateLimit: { limit: 120, windowMs: 3600_000, key: "user" } }, async ({ req, user, params }) => ({ message: await sendMessage(user!, params.id, (await parseBody(req, messageSchema)).body) }));
