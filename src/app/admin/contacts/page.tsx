import type { Metadata } from "next";
import { requireAdminUser } from "@/lib/session";
import { contactRequests } from "@/application/admin.service";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody } from "@/ui/Card";
import { ActionButton } from "@/ui/ActionButton";
import { Badge } from "@/ui/Badge";
import { EmptyState } from "@/ui/Feedback";

export const metadata: Metadata = { title: "Demandes de contact" };

export default async function ContactsAdmin() {
  const admin = await requireAdminUser("CONTENT_MANAGE");
  const items = await contactRequests(admin);
  return (
    <>
      <PageHeader title="Demandes de contact" />
      {items.length === 0 ? <EmptyState title="Aucune demande" /> : <div className="space-y-3">{items.map((c) => <Card key={c.id}><CardBody className="text-sm"><div className="flex justify-between gap-2"><p className="font-semibold">{c.subject} — {c.name} &lt;{c.email}&gt; {c.company && `(${c.company})`}</p>{c.status === "NEW" ? <ActionButton action="/api/v1/admin/contact-handled" body={{ id: c.id }} successMessage="Marquée traitée.">Traitée</ActionButton> : <Badge tone="olive">Traitée</Badge>}</div><p className="mt-2 whitespace-pre-line text-slate">{c.message}</p><p className="mt-1 text-xs text-slate">{c.createdAt.toLocaleString("fr-FR")}</p></CardBody></Card>)}</div>}
    </>
  );
}
