import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listConversations } from "@/application/messaging.service";
import { PageHeader } from "@/ui/Page";
import { Card } from "@/ui/Card";
import { EmptyState } from "@/ui/Feedback";
import { Badge } from "@/ui/Badge";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const user = await requireUser("/messages");
  const convs = await listConversations(user.id);
  return (
    <>
      <PageHeader title="Messages" description="Échanges sécurisés : vos coordonnées personnelles ne sont jamais transmises par la plateforme." />
      {convs.length === 0 ? <EmptyState title="Aucune conversation" description="Contactez un expert depuis son profil ou répondez à une organisation." /> : (
        <Card><ul className="divide-y divide-line">
          {convs.map((c) => {
            const others = c.participants.filter((p) => p.userId !== user.id).map((p) => `${p.user.firstName} ${p.user.lastName}`).join(", ");
            return (
              <li key={c.id}><Link href={`/messages/${c.id}`} className="flex items-start justify-between gap-3 p-4 hover:bg-mist">
                <div className="min-w-0"><p className={`truncate ${c.unread ? "font-bold" : "font-semibold"}`}>{c.subject}</p><p className="truncate text-sm text-slate">{others} — {c.messages[0]?.body}</p></div>
                <div className="shrink-0 text-right text-xs text-slate">{c.lastMessageAt.toLocaleDateString("fr-FR")}{c.unread && <Badge tone="orange" className="ml-2">Nouveau</Badge>}</div>
              </Link></li>
            );
          })}
        </ul></Card>
      )}
    </>
  );
}
