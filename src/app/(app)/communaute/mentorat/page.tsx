import type { Metadata } from "next";
import { prisma } from "@/infrastructure/db";
import { requireUser } from "@/lib/session";
import { myMentorships } from "@/application/community.service";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { ApiForm } from "@/ui/ApiForm";
import { ActionButton } from "@/ui/ActionButton";
import { Field, Input, Select, Textarea } from "@/ui/Field";
import { StatusBadge } from "@/ui/Badge";

export const metadata: Metadata = { title: "Mentorat" };
const L: Record<string, string> = { REQUESTED: "Demandé", ACCEPTED: "Accepté", DECLINED: "Décliné", COMPLETED: "Terminé" };

export default async function MentorshipPage() {
  const user = await requireUser("/communaute/mentorat");
  const [{ asMentor, asMentee }, mentors] = await Promise.all([
    myMentorships(user.id),
    prisma.expertProfile.findMany({ where: { userId: { not: user.id }, yearsExperience: { gte: 10 }, visibility: { in: ["PUBLIC", "MEMBERS"] }, badges: { some: { revokedAt: null } } }, select: { userId: true, headline: true, yearsExperience: true, user: { select: { firstName: true, lastName: true } } }, orderBy: { yearsExperience: "desc" }, take: 50 }),
  ]);
  return (
    <>
      <PageHeader back={{ href: "/communaute", label: "Communauté" }} title="Mentorat" description="Experts vérifiés de 10 ans d'expérience et plus, disponibles pour accompagner les profils émergents." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Demander un mentorat" /><CardBody>
          <ApiForm action="/api/v1/community/mentorship-request" submitLabel="Envoyer la demande" successMessage="Demande envoyée au mentor." className="space-y-3">
            <Field label="Mentor" htmlFor="mentorId"><Select id="mentorId" name="mentorId">{mentors.map((m) => <option key={m.userId} value={m.userId}>{m.user.firstName} {m.user.lastName} — {m.yearsExperience} ans — {m.headline?.slice(0, 50)}</option>)}</Select></Field>
            <Field label="Sujet" htmlFor="topic" required><Input id="topic" name="topic" /></Field>
            <Field label="Message" htmlFor="message"><Textarea id="message" name="message" /></Field>
          </ApiForm>
        </CardBody></Card>
        <div className="space-y-6">
          <Card><CardHeader title="Demandes reçues (en tant que mentor)" /><CardBody className="space-y-2 text-sm">
            {asMentor.length === 0 && <p className="text-slate">Aucune.</p>}
            {asMentor.map((m) => <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-2"><span>{m.mentee.firstName} {m.mentee.lastName} — {m.topic}</span><span className="flex gap-1"><StatusBadge status={m.status} label={L[m.status]} />{m.status === "REQUESTED" && <><ActionButton action="/api/v1/community/mentorship-respond" body={{ id: m.id, status: "ACCEPTED" }} variant="success" successMessage="Accepté.">Accepter</ActionButton><ActionButton action="/api/v1/community/mentorship-respond" body={{ id: m.id, status: "DECLINED" }} successMessage="Décliné.">Décliner</ActionButton></>}{m.status === "ACCEPTED" && <ActionButton action="/api/v1/community/mentorship-respond" body={{ id: m.id, status: "COMPLETED" }} successMessage="Terminé.">Terminer</ActionButton>}</span></div>)}
          </CardBody></Card>
          <Card><CardHeader title="Mes demandes" /><CardBody className="space-y-2 text-sm">{asMentee.length === 0 ? <p className="text-slate">Aucune.</p> : asMentee.map((m) => <p key={m.id} className="flex justify-between">{m.mentor.firstName} {m.mentor.lastName} — {m.topic} <StatusBadge status={m.status} label={L[m.status]} /></p>)}</CardBody></Card>
        </div>
      </div>
    </>
  );
}
