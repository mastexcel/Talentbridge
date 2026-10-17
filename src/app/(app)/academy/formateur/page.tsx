import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { instructorCourses } from "@/application/academy.service";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { ApiForm } from "@/ui/ApiForm";
import { Field, Input, Select, Textarea } from "@/ui/Field";
import { StatusBadge } from "@/ui/Badge";

export const metadata: Metadata = { title: "Espace formateur" };

export default async function TrainerSpace() {
  const user = await requireUser("/academy/formateur");
  const courses = await instructorCourses(user.id);
  return (
    <>
      <PageHeader title="Espace formateur" description="Créez des cours, organisez les modules, suivez vos apprenants et évaluez leurs acquis." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {courses.length === 0 && <p className="text-sm text-slate">Aucun cours.</p>}
          {courses.map((c) => <Card key={c.id}><CardBody className="flex flex-wrap items-center justify-between gap-2"><div><Link href={`/academy/formateur/${c.id}`} className="font-display font-bold hover:text-bordeaux-700">{c.title}</Link><p className="text-xs text-slate">{c._count.modules} module(s) · {c._count.enrollments} apprenant(s)</p></div><StatusBadge status={c.status} label={c.status === "PUBLISHED" ? "Publié" : c.status === "DRAFT" ? "Brouillon" : "Archivé"} /></CardBody></Card>)}
        </div>
        <Card><CardHeader title="Nouveau cours" /><CardBody>
          <ApiForm action="/api/v1/academy/course-create" submitLabel="Créer" successMessage="Cours créé (brouillon)." className="space-y-3">
            <Field label="Titre" htmlFor="c-title" required><Input id="c-title" name="title" /></Field>
            <Field label="Résumé" htmlFor="c-sum" required><Textarea id="c-sum" name="summary" /></Field>
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
