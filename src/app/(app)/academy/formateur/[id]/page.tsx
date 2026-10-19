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
import { isSessionBased } from "@/domain/academy";
import { Badge } from "@/ui/Badge";
import { KindBadge, fmtDay, fmtTime, formatLabel, sessionPlace } from "@/ui/academy";

export const metadata: Metadata = { title: "Gérer le cours" };

export default async function ManageCourse({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser("/academy/formateur");
  const c = await prisma.course.findUnique({ where: { id }, include: { modules: { orderBy: { position: "asc" }, include: { lessons: { orderBy: { position: "asc" } } } }, assessments: true, liveSessions: { orderBy: { startsAt: "asc" }, include: { country: { select: { nameFr: true } }, _count: { select: { enrollments: { where: { status: { not: "CANCELLED" } } } } } } }, enrollments: { orderBy: { createdAt: "asc" }, include: { user: { select: { firstName: true, lastName: true } }, certificate: true } } } });
  if (!c || (c.instructorId !== user.id && user.platformRole !== "ADMIN")) notFound();
  const finalA = c.assessments.find((a) => a.isFinal);
  const sessionBased = isSessionBased(c);
  const [countries] = await Promise.all([prisma.country.findMany({ where: { isActive: true }, orderBy: { nameFr: "asc" }, select: { code: true, nameFr: true } })]);
  const now = new Date();
  const [{ course: withCert, blockers }, issuers] = await Promise.all([courseCertificateState(c.id), issuersForUser(user)]);
  return (
    <>
      <PageHeader back={{ href: "/academy/formateur", label: "Espace formateur" }} title={c.title} description={<span className="inline-flex flex-wrap items-center gap-2"><KindBadge kind={c.kind} />{formatLabel(c.format)}</span>} actions={<>{c.status !== "PUBLISHED" && blockers.length === 0 && <ActionButton action="/api/v1/academy/course-status" body={{ courseId: c.id, status: "PUBLISHED" }} variant="primary" successMessage="Cours publié.">Publier</ActionButton>}{c.status === "PUBLISHED" && <ActionButton action="/api/v1/academy/course-status" body={{ courseId: c.id, status: "ARCHIVED" }} confirm="Archiver ce cours ?" successMessage="Cours archivé.">Archiver</ActionButton>}</>} />
      <div className="mb-6">
        <CertificateProtocolCard courseId={c.id} issuer={withCert.issuer} otherIssuers={issuers.filter((i) => i.id !== withCert.issuerId)} tbSignatory={withCert.tbSignatory} blockers={blockers} published={c.status === "PUBLISHED"} />
      </div>
      {sessionBased && (
        <Card className="mb-6">
          <CardHeader title="Sessions" description="Dates, lieux et places. Le lien de connexion n'est communiqué qu'aux inscrits de la session." />
          <CardBody className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3 text-sm">
              {c.liveSessions.length === 0 && <p className="text-slate">Aucune session : programmez-en au moins une avant la mise en ligne.</p>}
              {c.liveSessions.map((s) => (
                <div key={s.id} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-line p-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{s.title}</p>
                    <p className="text-slate first-letter:uppercase">{fmtDay(s.startsAt)} · {fmtTime(s.startsAt)} · {sessionPlace({ ...s, countryName: s.country?.nameFr ?? null })}</p>
                    <p className="text-xs text-slate">{s._count.enrollments} inscrit(s){s.capacity ? ` / ${s.capacity} places` : ""}{s.startsAt < now ? " · passée" : ""}</p>
                  </div>
                  {s._count.enrollments === 0 && <ActionButton action="/api/v1/academy/session-remove" body={{ sessionId: s.id }} confirm="Supprimer cette session ?" variant="ghost" size="sm" successMessage="Session supprimée.">Supprimer</ActionButton>}
                </div>
              ))}
            </div>
            <ApiForm action="/api/v1/academy/session-add" submitLabel="Programmer la session" successMessage="Session programmée." className="space-y-2" extra={{ courseId: c.id }}>
              <Field label="Intitulé" htmlFor="s-title" required><Input id="s-title" name="title" placeholder="Session de novembre — Abidjan" /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Début (GMT)" htmlFor="s-start" required><Input id="s-start" name="startsAt" type="datetime-local" /></Field>
                <Field label="Durée (minutes)" htmlFor="s-dur" required><Input id="s-dur" name="durationMin" type="number" defaultValue={180} data-type="number" /></Field>
                <Field label="Mode" htmlFor="s-mode"><Select id="s-mode" name="mode" defaultValue={c.format === "IN_PERSON" ? "IN_PERSON" : "VIRTUAL"}><option value="VIRTUAL">En ligne</option><option value="IN_PERSON">Présentiel</option></Select></Field>
                <Field label="Places (vide = illimité)" htmlFor="s-cap"><Input id="s-cap" name="capacity" type="number" min={1} data-type="number" /></Field>
              </div>
              <Field label="Lien de connexion (en ligne)" htmlFor="s-url"><Input id="s-url" name="joinUrl" type="url" /></Field>
              <Field label="Lieu (présentiel)" htmlFor="s-venue"><Input id="s-venue" name="venue" placeholder="Salle, établissement" /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Ville" htmlFor="s-city"><Input id="s-city" name="city" /></Field>
                <Field label="Pays" htmlFor="s-country"><Select id="s-country" name="countryCode"><option value="">—</option>{countries.map((k) => <option key={k.code} value={k.code}>{k.nameFr}</option>)}</Select></Field>
              </div>
            </ApiForm>
          </CardBody>
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Modules et leçons" description={sessionBased ? "Facultatif pour un séminaire : supports, exercices, ressources." : undefined} /><CardBody className="space-y-3 text-sm">
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
          <Card><CardHeader title={`Inscrits (${c.enrollments.length})`} description={sessionBased ? "Attestez la présence une fois la session commencée : elle conditionne le certificat." : undefined} /><CardBody className="space-y-3 text-sm">
            {c.enrollments.length === 0 && <p className="text-slate">Aucun inscrit.</p>}
            {c.enrollments.map((e) => {
              const s = c.liveSessions.find((x) => x.id === e.sessionId);
              const canMark = s && s.startsAt <= now && (e.status === "ACTIVE" || e.status === "COMPLETED");
              return (
                <div key={e.id} className="border-b border-line pb-3 last:border-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{e.user.firstName} {e.user.lastName}</span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-slate">
                      {e.status === "PENDING_PAYMENT" && <Badge tone="orange">Paiement en attente</Badge>}
                      {e.certificate ? `Certifié (${e.certificate.code})` : modulesHaveLessons(c) ? `${e.progressPct} %` : null}
                      {s && (e.attendedAt ? <Badge tone="olive">Présent</Badge> : <Badge tone="neutral">Présence non attestée</Badge>)}
                    </span>
                  </div>
                  {s && <p className="text-xs text-slate first-letter:uppercase">{fmtDay(s.startsAt)} · {sessionPlace({ ...s, countryName: s.country?.nameFr ?? null })}</p>}
                  {modulesHaveLessons(c) && <Progress value={e.progressPct} className="mt-1" />}
                  {canMark && !e.certificate && (
                    <div className="mt-2">
                      {e.attendedAt
                        ? <ActionButton action="/api/v1/academy/attendance" body={{ enrollmentId: e.id, attended: false }} variant="ghost" size="sm" successMessage="Présence retirée.">Retirer la présence</ActionButton>
                        : <ActionButton action="/api/v1/academy/attendance" body={{ enrollmentId: e.id, attended: true }} variant="success" size="sm" successMessage="Présence attestée.">Attester la présence</ActionButton>}
                    </div>
                  )}
                </div>
              );
            })}
          </CardBody></Card>
        </div>
      </div>
    </>
  );
}

const modulesHaveLessons = (c: { modules: { lessons: unknown[] }[] }) => c.modules.some((m) => m.lessons.length > 0);
