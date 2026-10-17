import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listNotifications, NOTIFICATION_TYPES } from "@/application/notification.service";
import { PageHeader } from "@/ui/Page";
import { Card } from "@/ui/Card";
import { ActionButton } from "@/ui/ActionButton";
import { EmptyState } from "@/ui/Feedback";
import { Badge } from "@/ui/Badge";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser("/notifications");
  const { items, unread } = await listNotifications(user.id);
  return (
    <>
      <PageHeader title="Notifications" description={`${unread} non lue(s)`} actions={unread > 0 ? <ActionButton action="/api/v1/me/notifications-read" body={{ ids: "all" }} successMessage="Toutes marquées comme lues.">Tout marquer comme lu</ActionButton> : undefined} />
      {items.length === 0 ? <EmptyState title="Aucune notification" /> : (
        <Card><ul className="divide-y divide-line">
          {items.map((n) => (
            <li key={n.id} className={`flex items-start justify-between gap-3 p-4 ${n.readAt ? "" : "bg-orange-50/60"}`}>
              <div><p className="flex items-center gap-2 font-semibold"><Badge tone="bordeaux">{NOTIFICATION_TYPES[n.type as keyof typeof NOTIFICATION_TYPES] ?? n.type}</Badge>{n.title}</p><p className="mt-1 text-sm text-slate">{n.body}</p><p className="mt-1 text-xs text-slate">{n.createdAt.toLocaleString("fr-FR")}</p></div>
              <div className="flex shrink-0 flex-col items-end gap-1">{n.link && <Link href={n.link} className="text-sm font-semibold text-orange-700">Ouvrir</Link>}{!n.readAt && <ActionButton action="/api/v1/me/notifications-read" body={{ ids: [n.id] }} variant="ghost" successMessage={null}>Lu</ActionButton>}</div>
            </li>
          ))}
        </ul></Card>
      )}
    </>
  );
}
