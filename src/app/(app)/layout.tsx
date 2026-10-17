import { requireUser } from "@/lib/session";
import { appNavigation } from "@/lib/navigation";
import { unreadCount } from "@/application/notification.service";
import { Shell } from "@/ui/Shell";
import { ResendVerification } from "@/ui/ResendVerification";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/espace");
  const unread = await unreadCount(user.id);
  const banner = !user.emailVerifiedAt && !user.isDemo ? (
    <div className="flex flex-wrap items-center justify-center gap-3 bg-orange-50 px-4 py-2 text-sm text-orange-900">
      Confirmez votre adresse email pour sécuriser votre compte et publier dans la communauté. <ResendVerification />
    </div>
  ) : null;
  return (
    <Shell sections={appNavigation(user)} user={user} orgs={user.memberships.map((m) => ({ id: m.organizationId, name: m.organization.name, role: m.role }))} activeOrgId={user.activeOrgId} unread={unread} banner={banner}>
      {children}
    </Shell>
  );
}
