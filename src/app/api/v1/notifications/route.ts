import { route } from "@/infrastructure/http/handler";
import { listNotifications } from "@/application/notification.service";

export const GET = route({ auth: true }, async ({ user }) => listNotifications(user!.id));
