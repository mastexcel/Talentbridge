import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { getConversation } from "@/application/messaging.service";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody } from "@/ui/Card";
import { ApiForm } from "@/ui/ApiForm";
import { Textarea } from "@/ui/Field";
import { ActionButton } from "@/ui/ActionButton";

export const metadata: Metadata = { title: "Conversation" };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/messages/${id}`);
  const c = await getConversation(user.id, id);
  return (
    <>
      <PageHeader back={{ href: "/messages", label: "Messages" }} title={c.subject} description={`Avec ${c.participants.filter((p) => p.userId !== user.id).map((p) => `${p.user.firstName} ${p.user.lastName}`).join(", ")}`} />
      <Card><CardBody className="space-y-3">
        {c.messages.map((m) => {
          const mine = m.senderId === user.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${mine ? "bg-bordeaux-700 text-white" : "bg-mist text-ink"}`}>
                <p className="whitespace-pre-line">{m.body}</p>
                <p className={`mt-1 text-[11px] ${mine ? "text-white/70" : "text-slate"}`}>{mine ? "Vous" : m.sender.firstName} · {m.createdAt.toLocaleString("fr-FR")}</p>
              </div>
            </div>
          );
        })}
      </CardBody>
      <CardBody className="border-t border-line">
        <ApiForm action={`/api/v1/messages/${c.id}`} submitLabel="Envoyer" successMessage={null}><Textarea name="body" placeholder="Votre message…" aria-label="Message" /></ApiForm>
        <div className="mt-2 text-right"><ActionButton action="/api/v1/community/report" body={{ targetType: "MESSAGE", targetId: c.id }} prompt={{ key: "reason", label: "Motif du signalement", required: true }} variant="ghost" successMessage="Signalement transmis.">Signaler cette conversation</ActionButton></div>
      </CardBody></Card>
    </>
  );
}
