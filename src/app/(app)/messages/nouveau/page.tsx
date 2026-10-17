import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/infrastructure/db";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody } from "@/ui/Card";
import { ApiForm } from "@/ui/ApiForm";
import { Field, Input, Textarea } from "@/ui/Field";

export const metadata: Metadata = { title: "Nouveau message" };

export default async function NewMessage({ searchParams }: { searchParams: Promise<{ expert?: string; sujet?: string }> }) {
  const sp = await searchParams;
  await requireUser("/messages");
  const expert = sp.expert ? await prisma.expertProfile.findUnique({ where: { id: sp.expert }, select: { id: true, user: { select: { firstName: true, lastName: true } } } }) : null;
  if (!expert) notFound();
  return (
    <>
      <PageHeader back={{ href: "/messages", label: "Messages" }} title={`Écrire à ${expert.user.firstName} ${expert.user.lastName}`} />
      <Card className="max-w-2xl"><CardBody>
        <ApiForm action="/api/v1/messages" submitLabel="Envoyer" successMessage="Message envoyé." className="space-y-3">
          <input type="hidden" name="expertId" value={expert.id} />
          <Field label="Objet" htmlFor="subject" required><Input id="subject" name="subject" defaultValue={sp.sujet ?? ""} /></Field>
          <Field label="Message" htmlFor="body" required><Textarea id="body" name="body" rows={6} /></Field>
        </ApiForm>
      </CardBody></Card>
    </>
  );
}
