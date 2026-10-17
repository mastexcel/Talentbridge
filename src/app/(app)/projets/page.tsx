import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/infrastructure/db";
import { requireUser } from "@/lib/session";
import { listProjects } from "@/application/project.service";
import { orgRoleCan, type OrgRole } from "@/domain/permissions";
import { PROJECT_STATUS_LABELS } from "@/ui/labels";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { StatusBadge } from "@/ui/Badge";
import { Progress } from "@/ui/Stat";
import { ApiForm } from "@/ui/ApiForm";
import { Field, Input, Select, Textarea } from "@/ui/Field";
import { EmptyState } from "@/ui/Feedback";

export const metadata: Metadata = { title: "Équipes projet" };

export default async function ProjectsPage() {
  const user = await requireUser("/projets");
  const projects = await listProjects(user);
  const m = user.memberships.find((x) => x.organizationId === user.activeOrgId);
  const canCreate = !!m && orgRoleCan(m.role as OrgRole, "projects.manage");
  const missions = canCreate ? await prisma.mission.findMany({ where: { organizationId: m!.organizationId, status: { notIn: ["CANCELLED"] } }, select: { id: true, title: true } }) : [];
  return (
    <>
      <PageHeader title="Équipes projet" description="Vous ne voyez que les projets dont vous êtes membre, ou ceux que vous gérez dans votre organisation." />
      {projects.length === 0 ? <EmptyState title="Aucun projet" /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const done = p.tasks.filter((t) => t.status === "DONE").length;
            return (
              <Link key={p.id} href={`/projets/${p.id}`} className="rounded-2xl border border-line bg-white p-5 shadow-card hover:shadow-lift">
                <div className="flex justify-between gap-2"><p className="font-display font-bold">{p.name}</p><StatusBadge status={p.status === "ACTIVE" ? "IN_PROGRESS" : p.status} label={PROJECT_STATUS_LABELS[p.status]} /></div>
                <p className="text-sm text-slate">{p.organization.name} · {p._count.members} membre(s)</p>
                <div className="mt-3 flex justify-between text-xs"><span>Avancement</span><span>{done}/{p._count.tasks} tâches</span></div>
                <Progress value={p._count.tasks ? (done * 100) / p._count.tasks : 0} className="mt-1" />
              </Link>
            );
          })}
        </div>
      )}
      {canCreate && (
        <Card className="mt-8 max-w-2xl"><CardHeader title="Nouveau projet" /><CardBody>
          <ApiForm action="/api/v1/projects" submitLabel="Créer le projet" successMessage="Projet créé." className="grid gap-3 sm:grid-cols-2">
            <Field label="Nom" htmlFor="p-name" required className="sm:col-span-2"><Input id="p-name" name="name" /></Field>
            <Field label="Mission liée" htmlFor="p-m"><Select id="p-m" name="missionId"><option value="">—</option>{missions.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</Select></Field>
            <div className="grid grid-cols-2 gap-2"><Field label="Début" htmlFor="p-s"><Input id="p-s" name="startDate" type="date" /></Field><Field label="Fin" htmlFor="p-e"><Input id="p-e" name="endDate" type="date" /></Field></div>
            <Field label="Description" htmlFor="p-d" className="sm:col-span-2"><Textarea id="p-d" name="description" /></Field>
          </ApiForm>
        </CardBody></Card>
      )}
    </>
  );
}
