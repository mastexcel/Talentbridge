import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/infrastructure/db";
import { requireUser } from "@/lib/session";
import { getProject } from "@/application/project.service";
import { DELIVERABLE_LABELS, PROJECT_ROLE_LABELS, PROJECT_STATUS_LABELS, TASK_STATUS_LABELS } from "@/ui/labels";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { Badge, StatusBadge } from "@/ui/Badge";
import { ApiForm } from "@/ui/ApiForm";
import { ActionButton } from "@/ui/ActionButton";
import { Checkbox, Field, Input, Select, Textarea } from "@/ui/Field";
import { FileUpload } from "@/ui/FileUpload";
import { TaskMove } from "@/ui/TaskMove";
import { Progress } from "@/ui/Stat";

export const metadata: Metadata = { title: "Projet" };
const COLUMNS = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const;

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ vue?: string }> }) {
  const { id } = await params;
  const { vue = "kanban" } = await searchParams;
  const user = await requireUser(`/projets/${id}`);
  const { project: p, canManage } = await getProject(user, id);
  const candidates = canManage
    ? await prisma.expertProfile.findMany({ where: { OR: [{ contracts: { some: { organizationId: p.organization.id, status: { notIn: ["TERMINATED"] } } } }, { applications: { some: { mission: { organizationId: p.organization.id }, status: { in: ["SELECTED", "CONTRACTED"] } } } }], userId: { notIn: p.members.map((m) => m.userId) } }, select: { id: true, user: { select: { firstName: true, lastName: true } } } })
    : [];
  const done = p.tasks.filter((t) => t.status === "DONE").length;
  const dated = p.tasks.filter((t) => t.startDate || t.dueDate);
  const start = Math.min(...dated.map((t) => (t.startDate ?? t.dueDate)!.getTime()), p.startDate?.getTime() ?? Infinity);
  const end = Math.max(...dated.map((t) => (t.dueDate ?? t.startDate)!.getTime()), p.endDate?.getTime() ?? -Infinity);
  const span = Math.max(1, end - start);
  return (
    <>
      <PageHeader back={{ href: "/projets", label: "Projets" }} title={p.name} description={<>{p.organization.name}{p.mission ? ` · mission ${p.mission.reference}` : ""} · <StatusBadge status={p.status === "ACTIVE" ? "IN_PROGRESS" : p.status} label={PROJECT_STATUS_LABELS[p.status]} /></>}
        actions={canManage ? <>{(["ACTIVE", "ON_HOLD", "COMPLETED"] as const).filter((s) => s !== p.status).map((s) => <ActionButton key={s} action={`/api/v1/projects/${p.id}/status`} body={{ status: s }} successMessage="Statut du projet mis à jour." confirm={s === "COMPLETED" ? "Clôturer le projet ?" : undefined}>{PROJECT_STATUS_LABELS[s]}</ActionButton>)}</> : undefined} />
      <div className="mb-6 grid gap-4 md:grid-cols-[1fr_auto]">
        <div><div className="flex justify-between text-sm"><span>Avancement</span><span>{done}/{p.tasks.length} tâches terminées</span></div><Progress value={p.tasks.length ? (done * 100) / p.tasks.length : 0} className="mt-1" /></div>
        <nav className="flex gap-2 text-sm">{[["kanban", "Kanban"], ["chronologie", "Chronologie"], ["equipe", "Équipe"]].map(([k, l]) => <Link key={k} href={`?vue=${k}`} className={`rounded-full px-3 py-1 ${vue === k ? "bg-bordeaux-700 text-white" : "border border-line bg-white"}`}>{l}</Link>)}</nav>
      </div>

      {vue === "kanban" && (
        <div className="grid gap-4 lg:grid-cols-4">
          {COLUMNS.map((col) => (
            <section key={col} className="rounded-2xl bg-white/70 p-3 ring-1 ring-line" aria-label={TASK_STATUS_LABELS[col]}>
              <p className="mb-3 flex justify-between text-sm font-bold"><span>{TASK_STATUS_LABELS[col]}</span><span className="text-slate">{p.tasks.filter((t) => t.status === col).length}</span></p>
              <div className="space-y-3">
                {p.tasks.filter((t) => t.status === col).map((t) => {
                  const mine = t.assigneeId === user.id;
                  return (
                    <article key={t.id} className="rounded-xl border border-line bg-white p-3 text-sm shadow-sm">
                      <p className="font-semibold">{t.title}</p>
                      <p className="text-xs text-slate">{t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : "Non assignée"}{t.dueDate ? ` · échéance ${t.dueDate.toLocaleDateString("fr-FR")}` : ""}</p>
                      {t.deliverableStatus !== "NOT_DELIVERABLE" && <Badge tone={t.deliverableStatus === "APPROVED" ? "olive" : t.deliverableStatus === "CHANGES_REQUESTED" ? "red" : "orange"} className="mt-1">{DELIVERABLE_LABELS[t.deliverableStatus]}</Badge>}
                      {t.fileId && <a href={`/api/v1/files/${t.fileId}`} className="mt-1 block text-xs text-orange-700 underline">Livrable déposé</a>}
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {(canManage || mine) && <TaskMove id={t.id} status={t.status} />}
                        {mine && ["PENDING", "CHANGES_REQUESTED"].includes(t.deliverableStatus) && <FileUpload purpose="DELIVERABLE" label="Déposer" attach={{ action: `/api/v1/tasks/${t.id}/deliverable` }} />}
                        {canManage && t.deliverableStatus === "SUBMITTED" && <>
                          <ActionButton action={`/api/v1/tasks/${t.id}/review`} body={{ approve: true }} variant="success" successMessage="Livrable validé.">Valider</ActionButton>
                          <ActionButton action={`/api/v1/tasks/${t.id}/review`} body={{ approve: false }} prompt={{ key: "comment", label: "Modifications demandées", required: true }} successMessage="Retour envoyé.">Demander des modifs</ActionButton>
                        </>}
                      </div>
                      <details className="mt-2"><summary className="cursor-pointer text-xs text-slate">Commentaires ({t.comments.length})</summary>
                        <ul className="mt-1 space-y-1 text-xs">{t.comments.map((c) => <li key={c.id}><strong>{c.author.firstName}</strong> : {c.body}</li>)}</ul>
                        <ApiForm action={`/api/v1/tasks/${t.id}/comment`} submitLabel="Envoyer" successMessage={null} className="mt-1"><Input name="body" placeholder="Votre commentaire" aria-label="Commentaire" className="h-8 text-xs" /></ApiForm>
                      </details>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {vue === "chronologie" && (
        <Card><CardHeader title="Vue chronologique" description={dated.length ? `${new Date(start).toLocaleDateString("fr-FR")} → ${new Date(end).toLocaleDateString("fr-FR")}` : undefined} /><CardBody className="space-y-2">
          {dated.length === 0 && <p className="text-sm text-slate">Aucune tâche datée.</p>}
          {dated.sort((a, b) => ((a.startDate ?? a.dueDate)!.getTime() - (b.startDate ?? b.dueDate)!.getTime())).map((t) => {
            const s = (t.startDate ?? t.dueDate)!.getTime();
            const e = (t.dueDate ?? t.startDate)!.getTime();
            const late = t.dueDate && t.dueDate < new Date() && t.status !== "DONE";
            return (
              <div key={t.id} className="grid grid-cols-[minmax(120px,220px)_1fr] items-center gap-3 text-sm">
                <span className="truncate" title={t.title}>{t.title}</span>
                <div className="relative h-6 rounded bg-mist">
                  <div className={`absolute h-6 rounded ${t.status === "DONE" ? "bg-olive-600" : late ? "bg-red-600" : "bg-orange-500"}`} style={{ left: `${((s - start) * 100) / span}%`, width: `${Math.max(2, ((e - s) * 100) / span)}%` }} title={`${TASK_STATUS_LABELS[t.status]} — échéance ${t.dueDate?.toLocaleDateString("fr-FR") ?? "—"}`} />
                </div>
              </div>
            );
          })}
          <p className="pt-2 text-xs text-slate"><span className="mr-3"><span className="mr-1 inline-block h-2 w-3 rounded bg-olive-600" />Terminé</span><span className="mr-3"><span className="mr-1 inline-block h-2 w-3 rounded bg-orange-500" />Planifié / en cours</span><span><span className="mr-1 inline-block h-2 w-3 rounded bg-red-600" />En retard</span></p>
        </CardBody></Card>
      )}

      {vue === "equipe" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card><CardHeader title="Membres" /><CardBody className="divide-y divide-line text-sm">{p.members.map((m) => <div key={m.userId} className="py-2"><p><strong>{m.user.firstName} {m.user.lastName}</strong> — {PROJECT_ROLE_LABELS[m.role]}{m.user.expertProfile && <Link href={`/experts/${m.user.expertProfile.slug}`} className="ml-2 text-xs text-orange-700 underline">profil</Link>}</p>{m.responsibilities && <p className="text-xs text-slate">{m.responsibilities}</p>}</div>)}</CardBody></Card>
          {canManage && (
            <div className="space-y-6">
              <Card><CardHeader title="Ajouter un consultant" description="Consultants retenus ou sous contrat avec l'organisation." /><CardBody>
                {candidates.length === 0 ? <p className="text-sm text-slate">Aucun consultant éligible.</p> : (
                  <ApiForm action={`/api/v1/projects/${p.id}/member`} submitLabel="Ajouter" successMessage="Membre ajouté." className="space-y-2">
                    <Select name="expertId" aria-label="Consultant">{candidates.map((c) => <option key={c.id} value={c.id}>{c.user.firstName} {c.user.lastName}</option>)}</Select>
                    <Select name="role" aria-label="Rôle"><option value="CONSULTANT">Consultant</option><option value="LEAD">Chef de mission</option><option value="OBSERVER">Observateur</option></Select>
                    <Input name="responsibilities" placeholder="Responsabilités" aria-label="Responsabilités" />
                  </ApiForm>
                )}
              </CardBody></Card>
              <Card><CardHeader title="Nouvelle tâche / livrable" /><CardBody>
                <ApiForm action={`/api/v1/projects/${p.id}/task`} submitLabel="Créer" successMessage="Tâche créée." className="space-y-2">
                  <Field label="Titre" htmlFor="t-title" required><Input id="t-title" name="title" /></Field>
                  <Field label="Assignée à" htmlFor="t-as"><Select id="t-as" name="assigneeId"><option value="">—</option>{p.members.map((m) => <option key={m.userId} value={m.userId}>{m.user.firstName} {m.user.lastName}</option>)}</Select></Field>
                  <div className="grid grid-cols-2 gap-2"><Field label="Début" htmlFor="t-s"><Input id="t-s" name="startDate" type="date" /></Field><Field label="Échéance" htmlFor="t-d"><Input id="t-d" name="dueDate" type="date" /></Field></div>
                  <Field label="Description" htmlFor="t-desc"><Textarea id="t-desc" name="description" /></Field>
                  <Checkbox name="isDeliverable" label="C'est un livrable (validation requise)" />
                </ApiForm>
              </CardBody></Card>
            </div>
          )}
        </div>
      )}
    </>
  );
}
