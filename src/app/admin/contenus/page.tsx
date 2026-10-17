import type { Metadata } from "next";
import { prisma } from "@/infrastructure/db";
import { requireAdminUser } from "@/lib/session";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { ApiForm } from "@/ui/ApiForm";
import { ActionButton } from "@/ui/ActionButton";
import { Checkbox, Field, Input, Select, Textarea } from "@/ui/Field";
import { Badge } from "@/ui/Badge";

export const metadata: Metadata = { title: "Contenus du site" };
const KEYS: [string, string][] = [["home.hero", "Accueil — accroche"], ["home.promise", "Accueil — promesse 72 h"], ["home.about", "Accueil — présentation"], ["about.mission", "Notre mission"], ["about.vision", "Ambition"], ["about.values", "Engagements"], ["legal.terms", "Conditions générales"], ["legal.privacy", "Confidentialité"], ["legal.notice", "Mentions légales"]];

/** CMS : contenus éditoriaux modifiables sans intervention dans le code (français ; anglais préparé). */
export default async function ContentAdmin({ searchParams }: { searchParams: Promise<{ langue?: string }> }) {
  const { langue = "fr" } = await searchParams;
  const locale = langue === "en" ? "en" : "fr";
  await requireAdminUser("CONTENT_MANAGE");
  const [blocks, stats, testimonials, faq] = await Promise.all([prisma.contentBlock.findMany({ where: { locale } }), prisma.publicStat.findMany({ orderBy: { sortOrder: "asc" } }), prisma.testimonial.findMany({ orderBy: { sortOrder: "asc" } }), prisma.faqItem.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }] })]);
  const byKey = new Map(blocks.map((b) => [b.key, b]));
  return (
    <>
      <PageHeader title="Contenus du site public" description="Texte simple : paragraphes séparés par une ligne vide, listes avec « - », gras avec **texte**." actions={<><a href="?langue=fr" className={`rounded-full px-3 py-1 text-sm ${locale === "fr" ? "bg-bordeaux-700 text-white" : "border border-line"}`}>Français</a><a href="?langue=en" className={`rounded-full px-3 py-1 text-sm ${locale === "en" ? "bg-bordeaux-700 text-white" : "border border-line"}`}>English</a></>} />
      <div className="grid gap-6 xl:grid-cols-2">
        {KEYS.map(([key, label]) => {
          const b = byKey.get(key);
          return (
            <Card key={key}><CardHeader title={label} description={b ? `Modifié le ${b.updatedAt.toLocaleDateString("fr-FR")}` : "Non rédigé dans cette langue"} /><CardBody>
              <ApiForm action="/api/v1/admin/cms-block" successMessage="Contenu publié." className="space-y-2" extra={{ key, locale }}>
                <Input name="title" defaultValue={b?.title ?? ""} placeholder="Titre" aria-label="Titre" />
                <Textarea name="body" defaultValue={b?.body ?? ""} rows={key.startsWith("legal") ? 10 : 4} aria-label="Texte" />
              </ApiForm>
            </CardBody></Card>
          );
        })}
        <Card><CardHeader title="Chiffres clés de l'accueil" description="« Calculé » = requête sur les données réelles. « Saisi » = valeur manuelle, à marquer « Démo » si non réelle." /><CardBody className="space-y-3">
          {stats.map((s) => (
            <ApiForm key={s.id} action="/api/v1/admin/stat-update" submitLabel="OK" successMessage="Chiffre mis à jour." className="grid grid-cols-2 gap-2 rounded-xl border border-line p-2 text-sm" extra={{ id: s.id }}>
              <Input name="label" defaultValue={s.label} aria-label="Libellé" />
              <Select name="source" defaultValue={s.source} aria-label="Source"><option value="LIVE">Calculé ({s.metric})</option><option value="MANUAL">Saisi</option></Select>
              <Input name="manualValue" defaultValue={s.manualValue ?? ""} placeholder="Valeur saisie" aria-label="Valeur" />
              <div className="flex gap-2"><Checkbox name="isDemo" defaultChecked={s.isDemo} label="Démo" /><Checkbox name="isVisible" defaultChecked={s.isVisible} label="Visible" /></div>
            </ApiForm>
          ))}
        </CardBody></Card>
        <Card><CardHeader title="Témoignages" description="« Vérifié » uniquement avec l'accord écrit de l'auteur." /><CardBody className="space-y-3">
          {testimonials.map((t) => (
            <ApiForm key={t.id} action="/api/v1/admin/testimonial-save" submitLabel="OK" successMessage="Témoignage enregistré." className="space-y-1 rounded-xl border border-line p-2 text-sm" extra={{ id: t.id }}>
              <div className="grid grid-cols-2 gap-1"><Input name="authorName" defaultValue={t.authorName} aria-label="Auteur" /><Input name="authorRole" defaultValue={t.authorRole} aria-label="Fonction" /></div>
              <Input name="organization" defaultValue={t.organization ?? ""} aria-label="Organisation" />
              <Textarea name="quote" defaultValue={t.quote} aria-label="Citation" />
              <div className="flex gap-3"><Checkbox name="isVerified" defaultChecked={t.isVerified} label="Vérifié" /><Checkbox name="isVisible" defaultChecked={t.isVisible} label="Visible" />{t.isDemo && <Badge tone="demo">Démo</Badge>}</div>
            </ApiForm>
          ))}
          <ApiForm action="/api/v1/admin/testimonial-save" submitLabel="Ajouter" successMessage="Témoignage ajouté." className="space-y-1 border-t border-line pt-3 text-sm">
            <div className="grid grid-cols-2 gap-1"><Input name="authorName" placeholder="Auteur" aria-label="Auteur" /><Input name="authorRole" placeholder="Fonction" aria-label="Fonction" /></div>
            <Textarea name="quote" placeholder="Citation" aria-label="Citation" />
            <div className="flex gap-3"><Checkbox name="isVerified" label="Vérifié (accord écrit)" /><Checkbox name="isVisible" defaultChecked label="Visible" /></div>
          </ApiForm>
        </CardBody></Card>
        <Card className="xl:col-span-2"><CardHeader title="FAQ" /><CardBody className="space-y-2 text-sm">
          {faq.map((f) => <div key={f.id} className="flex items-start justify-between gap-2"><span><Badge>{f.category}</Badge> <strong>{f.question}</strong></span><ActionButton action="/api/v1/admin/faq-toggle" body={{ id: f.id, isVisible: !f.isVisible }} variant="ghost" successMessage="FAQ mise à jour.">{f.isVisible ? "Masquer" : "Afficher"}</ActionButton></div>)}
          <ApiForm action="/api/v1/admin/faq-create" submitLabel="Ajouter la question" successMessage="Question ajoutée." className="grid gap-2 border-t border-line pt-3 sm:grid-cols-[160px_1fr]">
            <Select name="category" aria-label="Catégorie"><option value="GENERAL">Général</option><option value="EXPERTS">Experts</option><option value="ORGANISATIONS">Organisations</option></Select>
            <Input name="question" placeholder="Question" aria-label="Question" />
            <Field label="Réponse" htmlFor="faq-a" className="sm:col-span-2"><Textarea id="faq-a" name="answer" /></Field>
          </ApiForm>
        </CardBody></Card>
      </div>
    </>
  );
}
