import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { prisma } from "@/infrastructure/db";
import { requireUser } from "@/lib/session";
import { getAssessment, getCourse } from "@/application/academy.service";
import { PageHeader, RichText } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { ActionButton } from "@/ui/ActionButton";
import { Progress } from "@/ui/Stat";
import { QuizForm } from "@/ui/QuizForm";
import { Alert } from "@/ui/Feedback";
import { fmtDay, fmtTime, sessionPlace } from "@/ui/academy";

export const metadata: Metadata = { title: "Suivre la formation" };

export default async function FollowCourse({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ lecon?: string; evaluation?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/academy/${slug}/suivre`);
  const data = await getCourse(slug, user);
  if (!data) notFound();
  const { course: c, enrollment: e } = data;
  if (!e || !["ACTIVE", "COMPLETED"].includes(e.status)) redirect(`/academy/${slug}`);
  const lessons = c.modules.flatMap((m) => m.lessons);
  const done = new Set(e.lessons.map((l) => l.lessonId));
  const currentId = sp.lecon ?? lessons.find((l) => !done.has(l.id))?.id ?? lessons[0]?.id;
  const lesson = currentId && !sp.evaluation ? await prisma.lesson.findFirst({ where: { id: currentId, module: { courseId: c.id } } }) : null;
  const finalA = c.assessments.find((a) => a.isFinal);
  const quiz = sp.evaluation && finalA ? await getAssessment(user, finalA.id) : null;
  const session = c.sessions.find((s) => s.id === e.sessionId) ?? null;
  const best = finalA ? await prisma.assessmentAttempt.aggregate({ where: { assessmentId: finalA.id, userId: user.id }, _max: { scorePct: true } }) : null;
  return (
    <>
      <PageHeader back={{ href: `/academy/${slug}`, label: c.title }} title={c.title} />
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          {session && (
            <Card><CardBody className="space-y-1 text-sm">
              <p className="font-semibold">Votre session</p>
              <p className="first-letter:uppercase">{fmtDay(session.startsAt)} · {fmtTime(session.startsAt)}</p>
              <p className="text-slate">{sessionPlace(session)}</p>
              {session.joinUrl && <a href={session.joinUrl} target="_blank" rel="noopener noreferrer" className="block font-semibold text-orange-700 underline">Lien de connexion</a>}
              <p className={e.attendedAt ? "text-olive-700" : "text-slate"}>{e.attendedAt ? "Présence confirmée par le formateur" : "Présence à confirmer par le formateur"}</p>
            </CardBody></Card>
          )}
          {lessons.length > 0 && <Card><CardBody className="space-y-2"><Progress value={e.progressPct} /><p className="text-xs text-slate">{e.progressPct} % · {done.size}/{lessons.length} leçons</p></CardBody></Card>}
          <nav className="space-y-3 text-sm" aria-label="Plan du cours">
            {c.modules.map((m) => <div key={m.id}><p className="font-semibold">{m.title}</p><ul className="mt-1 space-y-1">{m.lessons.map((l) => <li key={l.id}><Link href={`?lecon=${l.id}`} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${l.id === currentId && !sp.evaluation ? "bg-bordeaux-50 text-bordeaux-700" : "hover:bg-mist"}`}>{done.has(l.id) ? <CheckCircle2 className="h-4 w-4 text-olive-600" /> : <span className="h-4 w-4 rounded-full border border-line" />}{l.title}</Link></li>)}</ul></div>)}
            {finalA && <Link href="?evaluation=1" className={`block rounded-lg px-2 py-1 font-semibold ${sp.evaluation ? "bg-orange-100 text-orange-800" : "hover:bg-mist"}`}>Évaluation finale {best?._max.scorePct != null ? `(meilleur score ${best._max.scorePct} %)` : ""}</Link>}
          </nav>
          {!e.certificate && <ActionButton action="/api/v1/academy/certificate" body={{ courseId: c.id }} variant="success" className="w-full" successMessage="Certificat délivré !">Obtenir mon certificat</ActionButton>}
          {e.certificate && <Link href={`/certificats/${e.certificate.code}`} className="block text-center text-sm font-semibold text-olive-700 underline">Voir mon certificat</Link>}
        </aside>
        <div>
          {quiz ? (
            <Card><CardHeader title={quiz.title} description={`Seuil de réussite : ${c.passingScore} %. 3 tentatives maximum par heure.`} /><CardBody><QuizForm assessmentId={quiz.id} questions={quiz.questions} /></CardBody></Card>
          ) : lesson ? (
            <Card><CardHeader title={lesson.title} />
              <CardBody>
                {lesson.videoUrl && <Alert tone="info" className="mb-4">Vidéo : <a href={lesson.videoUrl} target="_blank" rel="noopener noreferrer" className="underline">ouvrir la vidéo</a></Alert>}
                {lesson.fileId && <a href={`/api/v1/files/${lesson.fileId}`} className="mb-4 block text-orange-700 underline">Télécharger le support</a>}
                <RichText text={lesson.content ?? ""} />
                <div className="mt-6">{done.has(lesson.id) ? <p className="text-sm text-olive-700">Leçon terminée ✓</p> : <ActionButton action="/api/v1/academy/lesson-complete" body={{ lessonId: lesson.id }} variant="primary" size="md" successMessage="Leçon terminée.">Marquer comme terminée</ActionButton>}</div>
              </CardBody>
            </Card>
          ) : session ? <Alert tone="info">Votre inscription est confirmée. Rendez-vous le {fmtDay(session.startsAt)} à {fmtTime(session.startsAt)} ({sessionPlace(session)}). Votre certificat pourra être demandé une fois votre présence confirmée par le formateur.</Alert> : <Alert tone="info">Ce cours ne contient pas encore de leçon.</Alert>}
        </div>
      </div>
    </>
  );
}
