import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { adminNavigation } from "@/lib/navigation";
import { unreadCount } from "@/application/notification.service";
import { Shell } from "@/ui/Shell";

export const dynamic = "force-dynamic";

/** Cockpit d'administration et de direction : réservé aux comptes plateforme ADMIN. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/admin");
  if (user.platformRole !== "ADMIN") redirect("/");
  return (
    <Shell variant="admin" sections={adminNavigation(user)} user={user} orgs={[]} activeOrgId={null} unread={await unreadCount(user.id)}>
      {children}
    </Shell>
  );
}
