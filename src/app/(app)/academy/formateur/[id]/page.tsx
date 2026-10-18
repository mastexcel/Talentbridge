import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/infrastructure/db";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { ApiForm } from "@/ui/ApiForm";
import { ActionButton } from "@/ui/ActionButton";
import { Field, Input, Select, Textarea } from "@/ui/Field";
import { Progress } from "@/ui/Stat";
import { courseCertificateState, issuersForUser } from "@/application/certificate.service";
import { CertificateProtocolCard } from "@/ui/certificates/IssuerEditor";

export const metadata: Metadata = { title: "Gérer le cours" };

export default async function ManageCourse({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser("/academy/formateur");
  const c = await prisma.course.findUnique({ where: { id }, include: { modules: { orderBy: { position: "asc" }, include: { lessons: { orderBy: { position: "asc" } } } }, assessments: true, enrollments: { include: { user: { select: { firstName: true, lastName: true } }, certificate: true } } } });
  if (!c || (c.instructorId !== user.id && user.platformRole !== "ADMIN")) notFound();
  const finalA = c.assessments.find((a) => a.isFinal);
  const [{ course: withCert, blockers }, issuers] = await Promise.all([courseCertificateState(c.id), issuersForUser(user)]);
  return (
    <>
      <PageHeader back={{ href: "/academy/formateur", label: "Espace formateur" }} title={c.title} actions={<>{c.status !== "PUBLISHED" && blockers.length === 0 && <ActionButton action="/api/v1/academy/course-status" body={{ courseId: c.id, status: "PUBLISHED" }} variant="primary" successMessage="Cours publié.">Publier</ActionButton>}{c.status === "PUBLISHED" && <ActionButton action="/api/v1/academy/course-status" body={{ courseId: c.id, status: "ARCHIVED" }} confirm="Archiver ce cours ?" successMessage="Cours archivé.">Archiver</ActionButton>}</>} />
      <div className="mb-6">
        <CertificateProtocolCard courseId={c.id} issuer={withCert.issuer} otherIssuers={issuers.filter((i) => i.id !== withCert.issuerId)} tbSignatory={withCert.tbSignatory} blockers={blockers} published={c.status === "PUBLISHED"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Modules et leçons" /><CardBody className="space-y-3 text-sm">
          {c.modules.map((m) => <div key={m.id}><p className="font-semibold">{m.title}</p><ul className="ml-4 list-disc text-slate">{m.lessons.map((l) => <li key={l.id}>{l.title} ({l.kind})</li>)}</ul></div>)}
          <ApiForm action="/api/v1/academy/lesson-add" submitLabel="Ajouter la leçon" successMessage="Leçon ajoutée." className="space-y-2 border-t border-line pt-3" extra={{ courseId: c.id }}>
            <Field label="Module" htmlFor="l-mod" required><Input id="l-mod" name="moduleTitle" list="modules" /><datalist id="modules">{c.modules.map((m) => <option key={m.id} value={m.title} />)}</datalist></Field>
            <Field label="Titre de la leçon" htmlFor="l-title" required><Input id="l-title" name="title" /></Field>
            <Field label="Type" htmlFor="l-kind"><Select id="l-kind" name="kind"><option value="TEXT">Texte</option><option value="VIDEO">Vidéo</option><option value="DOCUMENT">Document</option><option value="EXERCISE">Exercice</option></Select></Field>
            <Field label="Lien vidéo" htmlFor="l-video"><Input id="l-video" name="videoUrl" type="url" /></Field>
            <Field label="Contenu" htmlFor="l-content"><Textarea id="l-content" name="content" rows={6} /></Field>
          </ApiForm>
        </CardBody></Card>
        <div className="space-y-6">
          <Card><CardHeader title="Évaluation finale" description={finalA ? `${(finalA.questions as unknown[]).length} question(s)` : "Aucune évaluation"} /><CardBody>
            <ApiForm action="/api/v1/academy/assessment" submitLabel="Enregistrer l'évaluation" successMessage="Évaluation enregistrée." className="space-y-2" extra={{ courseId: c.id }}>
              <Field label="Titre" htmlFor="a-title"><Input id="a-title" name="title" defaultValue={finalA?.title ?? "Évaluation finale"} /></Field>
              <Field label="Questions (JSON)" htmlFor="a-q" hint='[{"id":"q1","prompt":"…","options":["A","B"],"answer":0}]'><Textarea id="a-q" name="questions" data-type="json" rows={8} defaultValue={JSON.stringify(finalA?.questions ?? [], null, 1)} className="font-mono text-xs" /></Field>
            </ApiForm>
          </CardBody></Card>
          <Card><CardHeader title={`Apprenants (${c.enrollments.length})`} /><CardBody className="space-y-2 text-sm">{c.enrollments.map((e) => <div key={e.id}><div className="flex justify-between"><span>{e.user.firstName} {e.user.lastName}</span><span className="text-xs text-slate">{e.certificate ? `Certifié (${e.certificate.code})` : `${e.progressPct} %`}</span></div><Progress value={e.progressPct} className="mt-1" /></div>)}</CardBody></Card>
        </div>
      </div>
    </>
  );
}
