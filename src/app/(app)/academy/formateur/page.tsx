import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { instructorCourses } from "@/application/academy.service";
import { prisma } from "@/infrastructure/db";
import { KindBadge, formatLabel } from "@/ui/academy";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { ApiForm } from "@/ui/ApiForm";
import { Field, Input, Select, Textarea } from "@/ui/Field";
import { StatusBadge } from "@/ui/Badge";

export const metadata: Metadata = { title: "Espace formateur" };

export default async function TrainerSpace() {
  const user = await requireUser("/academy/formateur");
  const [courses, domains] = await Promise.all([instructorCourses(user.id), prisma.expertiseDomain.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, nameFr: true } })]);
  return (
    <>
      <PageHeader title="Espace formateur" description="Créez des formations et des séminaires, programmez les sessions, suivez vos apprenants, leur présence et leurs acquis." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {courses.length === 0 && <p className="text-sm text-slate">Aucun cours.</p>}
          {courses.map((c) => <Card key={c.id}><CardBody className="flex flex-wrap items-center justify-between gap-2"><div><Link href={`/academy/formateur/${c.id}`} className="font-display font-bold hover:text-bordeaux-700">{c.title}</Link><p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate"><KindBadge kind={c.kind} />{formatLabel(c.format)} · {c._count.modules} module(s) · {c._count.enrollments} inscrit(s)</p></div><StatusBadge status={c.status} label={c.status === "PUBLISHED" ? "Publié" : c.status === "DRAFT" ? "Brouillon" : "Archivé"} /></CardBody></Card>)}
        </div>
        <Card><CardHeader title="Nouvelle formation ou nouveau séminaire" /><CardBody>
          <ApiForm action="/api/v1/academy/course-create" submitLabel="Créer" successMessage="Créé (brouillon)." className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Type" htmlFor="c-kind"><Select id="c-kind" name="kind"><option value="TRAINING">Formation</option><option value="SEMINAR">Séminaire</option></Select></Field>
              <Field label="Format" htmlFor="c-format" hint="Hors « en ligne » : sessions datées."><Select id="c-format" name="format"><option value="ONLINE">En ligne, à son rythme</option><option value="VIRTUAL_CLASS">Classe virtuelle</option><option value="IN_PERSON">Présentiel</option><option value="BLENDED">Hybride</option></Select></Field>
            </div>
            <Field label="Titre" htmlFor="c-title" required><Input id="c-title" name="title" /></Field>
            <Field label="Résumé" htmlFor="c-sum" required><Textarea id="c-sum" name="summary" /></Field>
            <Field label="Public visé" htmlFor="c-aud" hint="Ex. : experts en suivi-évaluation, jeunes diplômés, agents de projets."><Input id="c-aud" name="audience" /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Thématique" htmlFor="c-dom"><Select id="c-dom" name="domainId"><option value="">—</option>{domains.map((d) => <option key={d.id} value={d.id}>{d.nameFr}</option>)}</Select></Field>
              <Field label="Langue" htmlFor="c-lang"><Select id="c-lang" name="language"><option value="fr">Français</option><option value="en">Anglais</option><option value="pt">Portugais</option><option value="ar">Arabe</option></Select></Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Niveau" htmlFor="c-level"><Select id="c-level" name="level"><option value="BEGINNER">Débutant</option><option value="INTERMEDIATE">Intermédiaire</option><option value="ADVANCED">Avancé</option></Select></Field>
              <Field label="Durée (h)" htmlFor="c-h"><Input id="c-h" name="durationHours" type="number" defaultValue={4} data-type="number" /></Field>
              <Field label="Prix (0 = gratuit)" htmlFor="c-p"><Input id="c-p" name="price" type="number" defaultValue={0} data-type="number" /></Field>
              <Field label="Devise" htmlFor="c-cur"><Select id="c-cur" name="currency"><option>XOF</option><option>XAF</option><option>EUR</option></Select></Field>
            </div>
            <Field label="Seuil de réussite (%)" htmlFor="c-pass"><Input id="c-pass" name="passingScore" type="number" defaultValue={70} data-type="number" /></Field>
          </ApiForm>
        </CardBody></Card>
      </div>
    </>
  );
}
