import { notFound } from "next/navigation";
import { Calendar, CheckCircle2, PlayCircle } from "lucide-react";
import { getCourse } from "@/application/academy.service";
import { currentUser } from "@/lib/session";
import { formatMoney } from "@/domain/money";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { Badge, DemoBadge } from "@/ui/Badge";
import { ButtonLink } from "@/ui/Button";
import { ActionButton } from "@/ui/ActionButton";
import { Progress } from "@/ui/Stat";
import { RichText } from "@/ui/Page";
import { LEVEL_LABELS } from "@/ui/labels";

export const dynamic = "force-dynamic";

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await currentUser();
  const data = await getCourse(slug, user);
  if (!data) notFound();
  const { course: c, enrollment: e } = data;
  const active = e && (e.status === "ACTIVE" || e.status === "COMPLETED");
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex gap-2"><Badge tone="olive">{LEVEL_LABELS[c.level] ?? c.level}</Badge><DemoBadge show={c.isDemo} />{c.status !== "PUBLISHED" && <Badge tone="orange">Brouillon</Badge>}</div>
      <h1 className="mt-3 text-3xl font-extrabold">{c.title}</h1>
      <p className="mt-2 max-w-3xl text-lg text-slate">{c.summary}</p>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {c.description && <Card><CardHeader title="Présentation" /><CardBody><RichText text={c.description} /></CardBody></Card>}
          <Card>
            <CardHeader title="Programme" description={`${c.modules.reduce((s, m) => s + m.lessons.length, 0)} leçons · ${c.durationHours} h · évaluation finale (seuil ${c.passingScore} %)`} />
            <CardBody className="space-y-4">
              {c.modules.map((m) => (
                <div key={m.id}>
                  <p className="font-semibold">{m.title}</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {m.lessons.map((l) => <li key={l.id} className="flex items-center gap-2 text-slate">{e?.lessons.some((p) => p.lessonId === l.id) ? <CheckCircle2 className="h-4 w-4 text-olive-600" /> : <PlayCircle className="h-4 w-4" />}{l.title}</li>)}
                  </ul>
                </div>
              ))}
            </CardBody>
          </Card>
          {c.liveSessions.length > 0 && <Card><CardHeader title="Sessions en direct" /><CardBody className="space-y-2 text-sm">{c.liveSessions.map((s) => <p key={s.id} className="flex gap-2"><Calendar className="h-4 w-4 text-orange-600" />{s.title} — {s.startsAt.toLocaleString("fr-FR")}</p>)}</CardBody></Card>}
        </div>
        <aside className="space-y-4">
          <Card>
            <CardBody className="space-y-3">
              <p className="font-display text-2xl font-extrabold">{c.priceMinor === 0 ? "Gratuit" : formatMoney(c.priceMinor, c.currency)}</p>
              <p className="text-sm text-slate">Formateur : {c.instructor.firstName} {c.instructor.lastName}</p>
              {active ? (
                <>
                  <Progress value={e.progressPct} />
                  <p className="text-sm text-slate">Progression : {e.progressPct} %</p>
                  {e.certificate ? <ButtonLink href={`/certificats/${e.certificate.code}`} variant="success" className="w-full">Voir mon certificat</ButtonLink> : <ButtonLink href={`/academy/${c.slug}/suivre`} className="w-full">Continuer la formation</ButtonLink>}
                </>
              ) : !user ? (
                <ButtonLink href={`/connexion?suite=/academy/${c.slug}`} className="w-full">Se connecter pour s'inscrire</ButtonLink>
              ) : c.priceMinor === 0 ? (
                <ActionButton action="/api/v1/academy/enroll" body={{ courseId: c.id }} variant="primary" size="md" className="w-full" successMessage="Inscription confirmée.">S'inscrire gratuitement</ActionButton>
              ) : (
                <>
                  <ActionButton action="/api/v1/academy/enroll" body={{ courseId: c.id, method: "MOBILE_MONEY" }} variant="primary" size="md" className="w-full" successMessage={null}>S'inscrire — Mobile Money</ActionButton>
                  <ActionButton action="/api/v1/academy/enroll" body={{ courseId: c.id, method: "CARD" }} className="w-full" successMessage={null}>Payer par carte</ActionButton>
                  {e?.status === "PENDING_PAYMENT" && <p className="text-xs text-orange-800">Inscription en attente de paiement.</p>}
                </>
              )}
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
