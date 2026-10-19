import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, CalendarDays, CheckCircle2, ChevronLeft, Clock, Globe2, MapPin, MonitorPlay, PlayCircle, Users } from "lucide-react";
import { getCourse } from "@/application/academy.service";
import { currentUser } from "@/lib/session";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { Badge, DemoBadge } from "@/ui/Badge";
import { ButtonLink } from "@/ui/Button";
import { ActionButton } from "@/ui/ActionButton";
import { ApiForm } from "@/ui/ApiForm";
import { Progress } from "@/ui/Stat";
import { RichText } from "@/ui/Page";
import { LEVEL_LABELS } from "@/ui/labels";
import { DateBlock, KindBadge, fmtDay, fmtTime, formatLabel, priceLabel, seatsText, sessionPlace } from "@/ui/academy";
import { cn } from "@/ui/cn";

export const dynamic = "force-dynamic";

const LANGUAGES: Record<string, string> = { fr: "Français", en: "Anglais", pt: "Portugais", ar: "Arabe" };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCourse(slug, null);
  return data ? { title: data.course.title, description: data.course.summary } : {};
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await currentUser();
  const data = await getCourse(slug, user);
  if (!data) notFound();
  const { course: c, enrollment: e } = data;
  const active = e && (e.status === "ACTIVE" || e.status === "COMPLETED");
  const enrolled = e && e.status !== "CANCELLED";
  const upcoming = c.sessions.filter((s) => s.startsAt > new Date());
  const mySession = c.sessions.find((s) => s.id === e?.sessionId) ?? null;
  const lessons = c.modules.reduce((n, m) => n + m.lessons.length, 0);
  const seminar = c.kind === "SEMINAR";
  const paid = c.priceMinor > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href="/academy#catalogue" className="mb-4 inline-flex items-center gap-1 text-sm text-slate hover:text-bordeaux-700"><ChevronLeft className="h-4 w-4" aria-hidden />Catalogue de l&apos;Academy</Link>
      <div className="flex flex-wrap gap-2">
        <KindBadge kind={c.kind} />
        <Badge tone="neutral">{formatLabel(c.format)}</Badge>
        <Badge tone="olive">{LEVEL_LABELS[c.level] ?? c.level}</Badge>
        {c.domain && <Badge tone="neutral">{c.domain.nameFr}</Badge>}
        <DemoBadge show={c.isDemo} />
        {c.status !== "PUBLISHED" && <Badge tone="orange">Brouillon</Badge>}
      </div>
      <h1 className="mt-3 text-3xl font-extrabold">{c.title}</h1>
      <p className="mt-2 max-w-3xl text-lg text-slate">{c.summary}</p>
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate">
        <li className="flex items-center gap-1.5"><Clock className="h-4 w-4" aria-hidden />{c.durationHours} heure{c.durationHours > 1 ? "s" : ""}</li>
        <li className="flex items-center gap-1.5"><Globe2 className="h-4 w-4" aria-hidden />{LANGUAGES[c.language] ?? c.language}</li>
        <li className="flex items-center gap-1.5"><Users className="h-4 w-4" aria-hidden />{c.providerOrg?.name ?? `${c.instructor.firstName} ${c.instructor.lastName}`}</li>
        {c.issuer?.status === "VALIDATED" && <li className="flex items-center gap-1.5"><Award className="h-4 w-4" aria-hidden />Certificat délivré avec {c.issuer.name}</li>}
      </ul>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {(c.audience || c.description) && (
            <Card>
              <CardHeader title="Présentation" />
              <CardBody className="space-y-4">
                {c.audience && <p className="rounded-xl bg-mist px-4 py-3 text-sm"><span className="font-semibold">Public visé : </span>{c.audience}</p>}
                {c.description && <RichText text={c.description} />}
              </CardBody>
            </Card>
          )}

          {c.sessionBased && (
            <Card>
              <CardHeader title={seminar ? "Dates du séminaire" : "Sessions"} description="Horaires en GMT. Le lien de connexion des sessions en ligne est communiqué aux inscrits." />
              <CardBody>
                {c.sessions.length === 0 ? <p className="text-sm text-slate">Aucune date programmée pour le moment.</p> : (
                  <ul className="space-y-3">
                    {c.sessions.map((s) => (
                      <li key={s.id} className={cn("flex gap-4 rounded-2xl border p-4", s.id === e?.sessionId ? "border-olive-500 bg-olive-50/50" : "border-line")}>
                        <DateBlock date={s.startsAt} />
                        <div className="min-w-0 flex-1 text-sm">
                          <p className="font-semibold text-ink">{s.title}</p>
                          <p className="text-slate first-letter:uppercase">{fmtDay(s.startsAt)} · {fmtTime(s.startsAt)} · {Math.round(s.durationMin / 60 * 10) / 10} h</p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-slate">
                            <span className="flex items-center gap-1">{s.mode === "VIRTUAL" ? <MonitorPlay className="h-3.5 w-3.5" aria-hidden /> : <MapPin className="h-3.5 w-3.5" aria-hidden />}{sessionPlace(s)}</span>
                            <span className={cn(s.seatsLeft === 0 && "font-semibold text-red-700")}>{seatsText(s.seatsLeft)}</span>
                          </p>
                          {s.id === e?.sessionId && <p className="mt-2 text-xs font-semibold text-olive-800">Votre session{e.attendedAt ? " · présence confirmée" : ""}</p>}
                          {s.joinUrl && <a href={s.joinUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-semibold text-orange-700 underline">Lien de connexion à la session</a>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          )}

          {lessons > 0 && (
            <Card>
              <CardHeader title="Programme" description={`${lessons} leçon${lessons > 1 ? "s" : ""}${c.assessments.some((a) => a.isFinal) ? ` · évaluation finale (seuil ${c.passingScore} %)` : ""}`} />
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
          )}

          <Card>
            <CardHeader title="Certificat" />
            <CardBody className="text-sm text-slate">
              {seminar
                ? "Un certificat de participation est délivré lorsque le formateur a attesté votre présence (et, s'il y en a une, après réussite de l'évaluation finale)."
                : c.sessionBased
                  ? `Un certificat est délivré lorsque le formateur a attesté votre présence${lessons ? ", que toutes les leçons sont terminées" : ""}${c.assessments.some((a) => a.isFinal) ? ` et que l'évaluation finale est réussie (${c.passingScore} %)` : ""}.`
                  : `Un certificat est délivré lorsque toutes les leçons sont terminées${c.assessments.some((a) => a.isFinal) ? ` et que l'évaluation finale est réussie (${c.passingScore} %)` : ""}.`}{" "}
              Il est numéroté, cosigné par l&apos;institution et par Talent Bridge, et vérifiable par QR code.
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardBody className="space-y-3">
              <p className="font-display text-2xl font-extrabold">{priceLabel(c.priceMinor, c.currency)}</p>
              {active ? (
                <>
                  {mySession && <p className="flex items-start gap-2 text-sm"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" /><span className="first-letter:uppercase">{fmtDay(mySession.startsAt)} · {sessionPlace(mySession)}</span></p>}
                  {lessons > 0 && <><Progress value={e.progressPct} /><p className="text-sm text-slate">Progression : {e.progressPct} %</p></>}
                  {e.certificate ? <ButtonLink href={`/certificats/${e.certificate.code}`} variant="success" className="w-full">Voir mon certificat</ButtonLink> : <ButtonLink href={`/academy/${c.slug}/suivre`} className="w-full">{lessons > 0 ? "Continuer la formation" : "Mon inscription"}</ButtonLink>}
                </>
              ) : enrolled && e.status === "PENDING_PAYMENT" ? (
                <>
                  <p className="rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-900">Inscription en attente de paiement{mySession ? " : votre place est réservée" : ""}.</p>
                  <ButtonLink href="/facturation" variant="outline" className="w-full">Régler ma facture</ButtonLink>
                </>
              ) : !user ? (
                <>
                  <ButtonLink href={`/connexion?suite=/academy/${c.slug}`} className="w-full">Se connecter pour s&apos;inscrire</ButtonLink>
                  <ButtonLink href="/inscription/apprenant" variant="outline" className="w-full">Créer un compte apprenant</ButtonLink>
                </>
              ) : c.status !== "PUBLISHED" ? (
                <p className="text-sm text-slate">Inscriptions ouvertes après la mise en ligne.</p>
              ) : c.sessionBased ? (
                upcoming.length === 0 ? <p className="text-sm text-slate">Aucune session ouverte aux inscriptions pour le moment.</p> : (
                  <ApiForm action="/api/v1/academy/enroll" extra={{ courseId: c.id }} submitLabel={paid ? "Réserver et payer" : "S'inscrire gratuitement"} successMessage={paid ? null : "Inscription confirmée."} className="space-y-3">
                    <fieldset className="space-y-2">
                      <legend className="mb-1 text-sm font-semibold">Choisissez votre session</legend>
                      {upcoming.map((s, i) => (
                        <label key={s.id} className={cn("flex cursor-pointer items-start gap-2 rounded-xl border border-line p-3 text-sm has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50", s.seatsLeft === 0 && "cursor-not-allowed opacity-60")}>
                          <input type="radio" name="sessionId" value={s.id} defaultChecked={i === upcoming.findIndex((x) => x.seatsLeft !== 0)} disabled={s.seatsLeft === 0} className="mt-1 accent-orange-600" required />
                          <span><span className="block font-semibold first-letter:uppercase">{fmtDay(s.startsAt)}</span><span className="block text-xs text-slate">{sessionPlace(s)} · {seatsText(s.seatsLeft)}</span></span>
                        </label>
                      ))}
                    </fieldset>
                    {paid && <PaymentSelect />}
                  </ApiForm>
                )
              ) : paid ? (
                <ApiForm action="/api/v1/academy/enroll" extra={{ courseId: c.id }} submitLabel="S'inscrire et payer" successMessage={null} className="space-y-3"><PaymentSelect /></ApiForm>
              ) : (
                <ActionButton action="/api/v1/academy/enroll" body={{ courseId: c.id }} variant="primary" size="md" className="w-full" successMessage="Inscription confirmée.">S&apos;inscrire gratuitement</ActionButton>
              )}
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function PaymentSelect() {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold">Moyen de paiement</span>
      <select name="method" defaultValue="MOBILE_MONEY" className="h-11 w-full rounded-xl border border-line bg-white px-2">
        <option value="MOBILE_MONEY">Mobile Money</option>
        <option value="CARD">Carte bancaire</option>
        <option value="BANK_TRANSFER">Virement bancaire</option>
      </select>
      <span className="mt-1 block text-xs text-slate">L&apos;inscription est confirmée à réception du paiement.</span>
    </label>
  );
}
