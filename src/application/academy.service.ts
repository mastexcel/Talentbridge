/**
 * Talent Bridge Academy : catalogue, inscription, progression, évaluations, certificats
 * vérifiables (code unique + QR). Un certificat n'est délivré que si les conditions sont remplies.
 */
import type { Prisma } from "@prisma/client";
import { prisma, inTransaction, type Db } from "@/infrastructure/db";
import { humanCode } from "@/infrastructure/crypto";
import { DomainError } from "@/domain/errors";
import { certificateEligibility, gradeAttempt, isSessionBased, progressPct, publicQuestions, seatsLeft, type CourseFormat, type CourseKind, type Question } from "@/domain/academy";
import { demoAllowed } from "@/infrastructure/env";
import { toMinor } from "@/domain/money";
import { slugify } from "@/domain/text";
import type { SessionUser } from "./auth.service";
import { audit } from "./audit.service";
import { notify } from "./notification.service";
import { createAndIssueInvoice, defaultTaxBps, startPayment } from "./billing.service";
import { courseCertificateState, courseSnapshot } from "./certificate.service";
import type { PaymentMethod } from "@/infrastructure/payments/provider";

/** Inscriptions qui occupent une place (une inscription annulée libère la sienne). */
const SEAT_HOLDING = { status: { in: ["PENDING_PAYMENT", "ACTIVE", "COMPLETED"] as ("PENDING_PAYMENT" | "ACTIVE" | "COMPLETED")[] } };
const realOnly = () => (demoAllowed() ? {} : { isDemo: false });

export interface CatalogFilter {
  q?: string;
  level?: string;
  kind?: string;
  format?: string;
  domain?: string;
  price?: string;
}

/** Catalogue public : formations et séminaires publiés, avec leurs prochaines sessions et places restantes. */
export async function catalog(filter: CatalogFilter = {}, db: Db = prisma) {
  const now = new Date();
  const where: Prisma.CourseWhereInput = {
    status: "PUBLISHED",
    ...realOnly(),
    ...(filter.q ? { OR: [{ title: { contains: filter.q, mode: "insensitive" } }, { summary: { contains: filter.q, mode: "insensitive" } }] } : {}),
    ...(filter.level && ["BEGINNER", "INTERMEDIATE", "ADVANCED"].includes(filter.level) ? { level: filter.level } : {}),
    ...(filter.kind === "TRAINING" || filter.kind === "SEMINAR" ? { kind: filter.kind } : {}),
    ...(filter.format && ["ONLINE", "VIRTUAL_CLASS", "IN_PERSON", "BLENDED"].includes(filter.format) ? { format: filter.format as CourseFormat } : {}),
    ...(filter.domain ? { domain: { slug: filter.domain } } : {}),
    ...(filter.price === "free" ? { priceMinor: 0 } : filter.price === "paid" ? { priceMinor: { gt: 0 } } : {}),
  };
  const courses = await db.course.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      instructor: { select: { firstName: true, lastName: true } },
      providerOrg: { select: { name: true } },
      domain: { select: { slug: true, nameFr: true } },
      liveSessions: { where: { startsAt: { gte: now } }, orderBy: { startsAt: "asc" }, take: 3, include: { country: { select: { nameFr: true } }, _count: { select: { enrollments: { where: SEAT_HOLDING } } } } },
      _count: { select: { enrollments: true, modules: true } },
    },
  });
  // Un cours en sessions datées sans session à venir n'est plus ouvert à l'inscription : on le place en fin de liste.
  return courses
    .map(({ liveSessions, ...c }) => ({ ...c, sessions: liveSessions.map(publicSession), open: !isSessionBased(c) || liveSessions.length > 0 }))
    .sort((a, b) => Number(b.open) - Number(a.open));
}

type SessionRow = { id: string; title: string; startsAt: Date; durationMin: number; mode: string; venue: string | null; city: string | null; countryCode: string | null; capacity: number | null; joinUrl?: string | null; country?: { nameFr: string } | null; _count?: { enrollments: number } };

/** Session telle qu'affichée publiquement : jamais le lien de connexion. */
function publicSession(s: SessionRow) {
  const taken = s._count?.enrollments ?? 0;
  return { id: s.id, title: s.title, startsAt: s.startsAt, durationMin: s.durationMin, mode: s.mode, venue: s.venue, city: s.city, countryName: s.country?.nameFr ?? null, capacity: s.capacity, taken, seatsLeft: seatsLeft(s.capacity, taken) };
}

/** Agenda : prochaines sessions (séminaires, classes virtuelles, présentiel) des cours publiés. */
export async function upcomingSessions(limit = 12, db: Db = prisma) {
  const rows = await db.liveSession.findMany({
    where: { startsAt: { gte: new Date() }, course: { status: "PUBLISHED", ...realOnly() } },
    orderBy: { startsAt: "asc" },
    take: limit,
    include: { country: { select: { nameFr: true } }, _count: { select: { enrollments: { where: SEAT_HOLDING } } }, course: { select: { slug: true, title: true, kind: true, format: true, priceMinor: true, currency: true, isDemo: true } } },
  });
  return rows.map((s) => ({ ...publicSession(s), course: s.course }));
}

/** Chiffres de l'Academy, calculés en direct (données de démonstration seulement hors production). */
export async function academyFigures(db: Db = prisma) {
  const real = realOnly();
  const now = new Date();
  const [trainings, seminars, sessions, learners, certificates] = await Promise.all([
    db.course.count({ where: { status: "PUBLISHED", kind: "TRAINING", ...real } }),
    db.course.count({ where: { status: "PUBLISHED", kind: "SEMINAR", ...real } }),
    db.liveSession.count({ where: { startsAt: { gte: now }, course: { status: "PUBLISHED", ...real } } }),
    db.enrollment.groupBy({ by: ["userId"], where: { status: { in: ["ACTIVE", "COMPLETED"] }, course: real } }),
    db.learningCertificate.count({ where: { revokedAt: null, enrollment: { course: real } } }),
  ]);
  return { trainings, seminars, sessions, learners: learners.length, certificates, isDemo: demoAllowed() };
}

/** Thématiques proposées dans les filtres : seulement celles qui ont au moins un cours publié. */
export async function catalogDomains(db: Db = prisma) {
  return db.expertiseDomain.findMany({ where: { isActive: true, courses: { some: { status: "PUBLISHED", ...realOnly() } } }, orderBy: { sortOrder: "asc" }, select: { slug: true, nameFr: true } });
}

export async function getCourse(slug: string, user: SessionUser | null, db: Db = prisma) {
  const course = await db.course.findUnique({
    where: { slug },
    include: {
      instructor: { select: { id: true, firstName: true, lastName: true, expertProfile: { select: { slug: true, headline: true } } } },
      providerOrg: { select: { name: true } },
      domain: { select: { slug: true, nameFr: true } },
      issuer: { select: { name: true, status: true } },
      modules: { orderBy: { position: "asc" }, include: { lessons: { orderBy: { position: "asc" }, select: { id: true, title: true, kind: true, position: true } } } },
      assessments: { select: { id: true, title: true, isFinal: true } },
      liveSessions: { where: { startsAt: { gte: new Date(Date.now() - 86_400_000) } }, orderBy: { startsAt: "asc" }, include: { country: { select: { nameFr: true } }, _count: { select: { enrollments: { where: SEAT_HOLDING } } } } },
    },
  });
  if (!course) return null;
  const canSeeDraft = user && (course.instructorId === user.id || user.platformRole === "ADMIN");
  if (course.status !== "PUBLISHED" && !canSeeDraft) return null;
  const enrollment = user ? await db.enrollment.findUnique({ where: { courseId_userId: { courseId: course.id, userId: user.id } }, include: { lessons: true, certificate: true } }) : null;
  const { liveSessions, ...rest } = course;
  // Le lien de connexion n'est communiqué qu'au participant inscrit (et réglé) de la session.
  const sessions = liveSessions.map((s) => ({ ...publicSession(s), joinUrl: enrollment?.sessionId === s.id && (enrollment.status === "ACTIVE" || enrollment.status === "COMPLETED") ? s.joinUrl : null }));
  return { course: { ...rest, sessions, sessionBased: isSessionBased(course) }, enrollment };
}

export async function enroll(user: SessionUser, courseId: string, method: PaymentMethod | null, db: Db = prisma, sessionId: string | null = null) {
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course || course.status !== "PUBLISHED") throw new DomainError("NOT_FOUND", "Formation indisponible.");
  const existing = await db.enrollment.findUnique({ where: { courseId_userId: { courseId, userId: user.id } } });
  if (existing && existing.status !== "CANCELLED") return { enrollmentId: existing.id, redirectUrl: `/academy/${course.slug}/suivre` };
  if (course.priceMinor > 0 && !method) throw new DomainError("VALIDATION", "Choisissez un moyen de paiement.");
  const sessionBased = isSessionBased(course);
  if (sessionBased && !sessionId) throw new DomainError("VALIDATION", "Choisissez une session.");
  const status = course.priceMinor === 0 ? "ACTIVE" : "PENDING_PAYMENT";

  // Réservation de la place : verrou sur la session pour qu'aucune inscription concurrente ne dépasse la capacité.
  const e = await inTransaction(db, async (tx) => {
    let chosen: string | null = null;
    if (sessionBased) {
      await tx.$queryRaw`SELECT id FROM live_sessions WHERE id = ${sessionId} FOR UPDATE`;
      const s = await tx.liveSession.findUnique({ where: { id: sessionId! }, include: { _count: { select: { enrollments: { where: SEAT_HOLDING } } } } });
      if (!s || s.courseId !== courseId) throw new DomainError("NOT_FOUND", "Session introuvable.");
      if (s.startsAt <= new Date()) throw new DomainError("INVALID_STATE", "Cette session a déjà commencé.");
      if (seatsLeft(s.capacity, s._count.enrollments) === 0) throw new DomainError("INVALID_STATE", "Cette session est complète.");
      chosen = s.id;
    }
    return tx.enrollment.upsert({ where: { courseId_userId: { courseId, userId: user.id } }, create: { courseId, userId: user.id, status, sessionId: chosen }, update: { status, sessionId: chosen, attendedAt: null } });
  });

  if (status === "ACTIVE") {
    await notify({ userId: user.id, type: "TRAINING", title: "Inscription confirmée", body: `Vous êtes inscrit(e) à « ${course.title} ».`, link: `/academy/${course.slug}/suivre`, channels: [] }, db);
    return { enrollmentId: e.id, redirectUrl: `/academy/${course.slug}/suivre` };
  }
  // Formation payante : inscription (et place) en attente, activée au paiement de la facture.
  const expert = await db.expertProfile.findUnique({ where: { userId: user.id }, select: { countryCode: true } });
  const invoice = await createAndIssueInvoice({ holder: { userId: user.id, organizationId: null }, currency: course.currency, serviceCode: "TRAINING", lines: [{ description: `${course.kind === "SEMINAR" ? "Séminaire" : "Formation"} : ${course.title}`, quantity: 1, unitPriceMinor: course.priceMinor, taxRateBps: await defaultTaxBps(expert?.countryCode, db) }], notes: `enrollment:${e.id}` }, db);
  const pay = await startPayment(user, invoice.id, method!, null, db);
  return { enrollmentId: e.id, ...pay };
}

/** Active les inscriptions dont la facture de formation est payée (appelé par les tâches planifiées). */
export async function activatePaidEnrollments(db: Db = prisma) {
  const paid = await db.invoice.findMany({ where: { serviceCode: "TRAINING", status: "PAID", notes: { startsWith: "enrollment:" } }, select: { notes: true } });
  const ids = paid.map((i) => i.notes!.slice("enrollment:".length));
  const res = await db.enrollment.updateMany({ where: { id: { in: ids }, status: "PENDING_PAYMENT" }, data: { status: "ACTIVE" } });
  return res.count;
}

async function myEnrollment(user: SessionUser, courseId: string, db: Db) {
  const e = await db.enrollment.findUnique({ where: { courseId_userId: { courseId, userId: user.id } } });
  if (!e || (e.status !== "ACTIVE" && e.status !== "COMPLETED")) throw new DomainError("FORBIDDEN", "Inscription active requise.");
  return e;
}

export async function getLesson(user: SessionUser, lessonId: string, db: Db = prisma) {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, include: { module: { select: { courseId: true } } } });
  if (!lesson) throw new DomainError("NOT_FOUND", "Leçon introuvable.");
  await myEnrollment(user, lesson.module.courseId, db);
  return lesson;
}

export async function completeLesson(user: SessionUser, lessonId: string, db: Db = prisma) {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, include: { module: { select: { courseId: true } } } });
  if (!lesson) throw new DomainError("NOT_FOUND", "Leçon introuvable.");
  const e = await myEnrollment(user, lesson.module.courseId, db);
  await db.lessonProgress.upsert({ where: { enrollmentId_lessonId: { enrollmentId: e.id, lessonId } }, create: { enrollmentId: e.id, lessonId }, update: {} });
  const [total, done] = await Promise.all([db.lesson.count({ where: { module: { courseId: lesson.module.courseId } } }), db.lessonProgress.count({ where: { enrollmentId: e.id } })]);
  await db.enrollment.update({ where: { id: e.id }, data: { progressPct: progressPct(done, total) } });
  return { progressPct: progressPct(done, total) };
}

export async function getAssessment(user: SessionUser, assessmentId: string, db: Db = prisma) {
  const a = await db.assessment.findUnique({ where: { id: assessmentId } });
  if (!a) throw new DomainError("NOT_FOUND", "Évaluation introuvable.");
  await myEnrollment(user, a.courseId, db);
  return { id: a.id, title: a.title, courseId: a.courseId, questions: publicQuestions(a.questions as unknown as Question[]) };
}

export async function submitAttempt(user: SessionUser, assessmentId: string, answers: Record<string, number>, db: Db = prisma) {
  const a = await db.assessment.findUnique({ where: { id: assessmentId }, include: { course: true } });
  if (!a) throw new DomainError("NOT_FOUND", "Évaluation introuvable.");
  await myEnrollment(user, a.courseId, db);
  const recent = await db.assessmentAttempt.count({ where: { assessmentId, userId: user.id, createdAt: { gte: new Date(Date.now() - 3600_000) } } });
  if (recent >= 3) throw new DomainError("RATE_LIMITED", "3 tentatives maximum par heure.");
  const grade = gradeAttempt(a.questions as unknown as Question[], answers);
  const passed = grade.scorePct >= a.course.passingScore;
  await db.assessmentAttempt.create({ data: { assessmentId, userId: user.id, answers: answers as Prisma.InputJsonValue, scorePct: grade.scorePct, passed } });
  return { ...grade, passed, passingScore: a.course.passingScore };
}

/** Délivrance du certificat — uniquement si toutes les conditions sont satisfaites. */
export async function claimCertificate(user: SessionUser, courseId: string, db: Db = prisma) {
  const e = await myEnrollment(user, courseId, db);
  const existing = await db.learningCertificate.findUnique({ where: { enrollmentId: e.id } });
  if (existing) return existing;
  const course = await db.course.findUniqueOrThrow({ where: { id: courseId }, include: { assessments: { where: { isFinal: true } }, issuer: true, tbSignatory: true } });
  const [lessonsTotal, lessonsDone] = await Promise.all([db.lesson.count({ where: { module: { courseId } } }), db.lessonProgress.count({ where: { enrollmentId: e.id } })]);
  const finalIds = course.assessments.map((a) => a.id);
  const best = finalIds.length ? await db.assessmentAttempt.aggregate({ where: { assessmentId: { in: finalIds }, userId: user.id }, _max: { scorePct: true } }) : null;
  const elig = certificateEligibility({ lessonsTotal, lessonsDone, hasFinal: finalIds.length > 0, bestScorePct: best?._max.scorePct ?? null, passingScore: course.passingScore, sessionBased: isSessionBased(course), attended: !!e.attendedAt });
  if (!elig.eligible) throw new DomainError("INVALID_STATE", `Conditions non remplies : ${elig.reasons.join(" ")}`);
  const snapshot = courseSnapshot(course);
  return inTransaction(db, async (tx) => {
    const cert = await tx.learningCertificate.create({ data: { code: `TB-${humanCode(4)}-${humanCode(4)}`, enrollmentId: e.id, holderName: `${user.firstName} ${user.lastName}`, courseTitle: course.title, scorePct: best?._max.scorePct ?? 100, snapshot: snapshot as unknown as Prisma.InputJsonValue } });
    await tx.enrollment.update({ where: { id: e.id }, data: { status: "COMPLETED", completedAt: new Date(), progressPct: 100 } });
    await audit({ actorId: user.id, action: "certificate.issue", entityType: "LearningCertificate", entityId: cert.id }, tx);
    await notify({ userId: user.id, type: "CERTIFICATION", title: "Certificat délivré", body: `Félicitations : certificat « ${course.title} » (${cert.code}).`, link: `/certificats/${cert.code}` }, tx);
    return cert;
  });
}

export async function verifyCertificate(code: string, db: Db = prisma) {
  return db.learningCertificate.findUnique({ where: { code: code.toUpperCase() } });
}

export async function myLearning(userId: string, db: Db = prisma) {
  return db.enrollment.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, include: { course: { select: { title: true, slug: true, durationHours: true, kind: true, format: true } }, session: { include: { country: { select: { nameFr: true } } } }, certificate: true } });
}

// ── Espace formateur ─────────────────────────────────────────

function assertInstructor(user: SessionUser, course: { instructorId: string }) {
  if (course.instructorId !== user.id && user.platformRole !== "ADMIN") throw new DomainError("FORBIDDEN", "Réservé au formateur du cours.");
}

export async function createCourse(user: SessionUser, input: { title: string; summary: string; description: string | null; level: string; durationHours: number; price: number; currency: string; passingScore: number; kind?: CourseKind; format?: CourseFormat; domainId?: string | null; audience?: string | null; language?: string }, db: Db = prisma) {
  const isTrainer = user.memberships.some((m) => m.organization.type === "TRAINING_PROVIDER") || !!user.expertProfile || user.platformRole === "ADMIN";
  if (!isTrainer) throw new DomainError("FORBIDDEN", "La création de cours est réservée aux formateurs.");
  let slug = slugify(input.title);
  if (await db.course.findUnique({ where: { slug } })) slug = `${slug}-${humanCode(4).toLowerCase()}`;
  const providerOrgId = user.memberships.find((m) => m.organization.type === "TRAINING_PROVIDER")?.organizationId ?? null;
  const { price, ...rest } = input;
  return db.course.create({ data: { ...rest, slug, priceMinor: toMinor(price, input.currency), instructorId: user.id, providerOrgId } });
}

export async function addLesson(user: SessionUser, courseId: string, input: { moduleTitle: string; title: string; kind: "TEXT" | "VIDEO" | "DOCUMENT" | "EXERCISE"; content: string | null; videoUrl: string | null }, db: Db = prisma) {
  const course = await db.course.findUniqueOrThrow({ where: { id: courseId } });
  assertInstructor(user, course);
  let mod = await db.courseModule.findFirst({ where: { courseId, title: input.moduleTitle } });
  if (!mod) mod = await db.courseModule.create({ data: { courseId, title: input.moduleTitle, position: await db.courseModule.count({ where: { courseId } }) } });
  return db.lesson.create({ data: { moduleId: mod.id, title: input.title, kind: input.kind, content: input.content, videoUrl: input.videoUrl, position: await db.lesson.count({ where: { moduleId: mod.id } }) } });
}

export async function setAssessment(user: SessionUser, courseId: string, title: string, questions: Question[], db: Db = prisma) {
  const course = await db.course.findUniqueOrThrow({ where: { id: courseId } });
  assertInstructor(user, course);
  if (questions.length === 0 || questions.some((q) => q.options.length < 2 || q.answer < 0 || q.answer >= q.options.length)) throw new DomainError("VALIDATION", "Questions invalides.");
  await db.assessment.deleteMany({ where: { courseId, isFinal: true } });
  return db.assessment.create({ data: { courseId, title, questions: questions as unknown as Prisma.InputJsonValue, isFinal: true } });
}

export async function setCourseStatus(user: SessionUser, courseId: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED", db: Db = prisma) {
  const course = await db.course.findUniqueOrThrow({ where: { id: courseId } });
  assertInstructor(user, course);
  if (status === "PUBLISHED") {
    // Protocole : institution délivrante validée et cosignataire Talent Bridge actif obligatoires.
    const { blockers } = await courseCertificateState(courseId, db);
    if (blockers.length) throw new DomainError("VALIDATION", `Mise en ligne impossible : ${blockers.join(" ")}`);
  }
  await db.course.update({ where: { id: courseId }, data: { status } });
}

export async function instructorCourses(userId: string, db: Db = prisma) {
  return db.course.findMany({ where: { instructorId: userId }, orderBy: { updatedAt: "desc" }, include: { _count: { select: { enrollments: true, modules: true } }, enrollments: { select: { progressPct: true, status: true, user: { select: { firstName: true, lastName: true } } } } } });
}

// ── Sessions datées et présence ──────────────────────────────

export interface SessionInput {
  title: string;
  startsAt: Date;
  durationMin: number;
  mode: "VIRTUAL" | "IN_PERSON";
  joinUrl: string | null;
  venue: string | null;
  city: string | null;
  countryCode: string | null;
  capacity: number | null;
}

export async function addSession(user: SessionUser, courseId: string, input: SessionInput, db: Db = prisma) {
  const course = await db.course.findUniqueOrThrow({ where: { id: courseId } });
  assertInstructor(user, course);
  if (!isSessionBased(course)) throw new DomainError("VALIDATION", "Une formation en ligne à votre rythme n'a pas de sessions : choisissez un autre format.");
  if (input.startsAt <= new Date()) throw new DomainError("VALIDATION", "La session doit être programmée dans le futur.");
  if (input.mode === "IN_PERSON" && (!input.city || !input.countryCode)) throw new DomainError("VALIDATION", "Ville et pays requis pour une session en présentiel.");
  if (input.countryCode && !(await db.country.findUnique({ where: { code: input.countryCode } }))) throw new DomainError("VALIDATION", "Pays inconnu.");
  const s = await db.liveSession.create({ data: { courseId, ...input, joinUrl: input.mode === "VIRTUAL" ? input.joinUrl : null } });
  await audit({ actorId: user.id, action: "course.session_add", entityType: "LiveSession", entityId: s.id, metadata: { courseId } }, db);
  return s;
}

/** Suppression d'une session sans inscrit (une session avec des inscrits ne peut pas disparaître). */
export async function removeSession(user: SessionUser, sessionId: string, db: Db = prisma) {
  const s = await db.liveSession.findUniqueOrThrow({ where: { id: sessionId }, include: { course: true, _count: { select: { enrollments: true } } } });
  assertInstructor(user, s.course);
  if (s._count.enrollments > 0) throw new DomainError("INVALID_STATE", "Des participants sont inscrits à cette session : elle ne peut pas être supprimée.");
  await db.liveSession.delete({ where: { id: sessionId } });
  await audit({ actorId: user.id, action: "course.session_remove", entityType: "LiveSession", entityId: sessionId, metadata: { courseId: s.courseId } }, db);
}

/** Présence attestée par le formateur, une fois la session commencée. Condition du certificat des formats en sessions. */
export async function markAttendance(user: SessionUser, enrollmentId: string, attended: boolean, db: Db = prisma) {
  const e = await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId }, include: { course: true, session: true, certificate: true } });
  assertInstructor(user, e.course);
  if (!e.session) throw new DomainError("INVALID_STATE", "Inscription sans session.");
  if (e.status !== "ACTIVE" && e.status !== "COMPLETED") throw new DomainError("INVALID_STATE", "Inscription non active (paiement en attente ou annulée).");
  if (e.session.startsAt > new Date()) throw new DomainError("INVALID_STATE", "La présence se renseigne une fois la session commencée.");
  if (!attended && e.certificate) throw new DomainError("INVALID_STATE", "Un certificat a déjà été délivré : révoquez-le d'abord.");
  await db.enrollment.update({ where: { id: e.id }, data: { attendedAt: attended ? new Date() : null } });
  await audit({ actorId: user.id, action: attended ? "enrollment.attended" : "enrollment.absent", entityType: "Enrollment", entityId: e.id, metadata: { courseId: e.courseId, sessionId: e.sessionId } }, db);
  if (attended) await notify({ userId: e.userId, type: "TRAINING", title: "Présence confirmée", body: `Votre présence à « ${e.course.title} » est confirmée.`, link: `/academy/${e.course.slug}/suivre` }, db);
}
