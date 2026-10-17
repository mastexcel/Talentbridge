/**
 * Talent Bridge Academy : catalogue, inscription, progression, évaluations, certificats
 * vérifiables (code unique + QR). Un certificat n'est délivré que si les conditions sont remplies.
 */
import type { Prisma } from "@prisma/client";
import { prisma, inTransaction, type Db } from "@/infrastructure/db";
import { humanCode } from "@/infrastructure/crypto";
import { DomainError } from "@/domain/errors";
import { certificateEligibility, gradeAttempt, progressPct, publicQuestions, type Question } from "@/domain/academy";
import { toMinor } from "@/domain/money";
import { slugify } from "@/domain/text";
import type { SessionUser } from "./auth.service";
import { audit } from "./audit.service";
import { notify } from "./notification.service";
import { createAndIssueInvoice, defaultTaxBps, startPayment } from "./billing.service";
import type { PaymentMethod } from "@/infrastructure/payments/provider";

export async function catalog(filter: { q?: string; level?: string } = {}, db: Db = prisma) {
  return db.course.findMany({
    where: { status: "PUBLISHED", ...(filter.q ? { title: { contains: filter.q, mode: "insensitive" } } : {}), ...(filter.level ? { level: filter.level } : {}) },
    orderBy: { createdAt: "desc" },
    include: { instructor: { select: { firstName: true, lastName: true } }, _count: { select: { enrollments: true, modules: true } } },
  });
}

export async function getCourse(slug: string, user: SessionUser | null, db: Db = prisma) {
  const course = await db.course.findUnique({
    where: { slug },
    include: {
      instructor: { select: { id: true, firstName: true, lastName: true, expertProfile: { select: { slug: true, headline: true } } } },
      modules: { orderBy: { position: "asc" }, include: { lessons: { orderBy: { position: "asc" }, select: { id: true, title: true, kind: true, position: true } } } },
      assessments: { select: { id: true, title: true, isFinal: true } },
      liveSessions: { where: { startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" } },
    },
  });
  if (!course) return null;
  const canSeeDraft = user && (course.instructorId === user.id || user.platformRole === "ADMIN");
  if (course.status !== "PUBLISHED" && !canSeeDraft) return null;
  const enrollment = user ? await db.enrollment.findUnique({ where: { courseId_userId: { courseId: course.id, userId: user.id } }, include: { lessons: true, certificate: true } }) : null;
  return { course, enrollment };
}

export async function enroll(user: SessionUser, courseId: string, method: PaymentMethod | null, db: Db = prisma) {
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course || course.status !== "PUBLISHED") throw new DomainError("NOT_FOUND", "Formation indisponible.");
  const existing = await db.enrollment.findUnique({ where: { courseId_userId: { courseId, userId: user.id } } });
  if (existing && existing.status !== "CANCELLED") return { enrollmentId: existing.id, redirectUrl: `/academy/${course.slug}/suivre` };
  if (course.priceMinor === 0) {
    const e = await db.enrollment.upsert({ where: { courseId_userId: { courseId, userId: user.id } }, create: { courseId, userId: user.id, status: "ACTIVE" }, update: { status: "ACTIVE" } });
    await notify({ userId: user.id, type: "TRAINING", title: "Inscription confirmée", body: `Vous êtes inscrit(e) à « ${course.title} ».`, link: `/academy/${course.slug}/suivre`, channels: [] }, db);
    return { enrollmentId: e.id, redirectUrl: `/academy/${course.slug}/suivre` };
  }
  if (!method) throw new DomainError("VALIDATION", "Choisissez un moyen de paiement.");
  // Formation payante : inscription en attente, activée au paiement de la facture.
  const e = await db.enrollment.upsert({ where: { courseId_userId: { courseId, userId: user.id } }, create: { courseId, userId: user.id, status: "PENDING_PAYMENT" }, update: { status: "PENDING_PAYMENT" } });
  const expert = await db.expertProfile.findUnique({ where: { userId: user.id }, select: { countryCode: true } });
  const invoice = await createAndIssueInvoice({ holder: { userId: user.id, organizationId: null }, currency: course.currency, serviceCode: "TRAINING", lines: [{ description: `Formation : ${course.title}`, quantity: 1, unitPriceMinor: course.priceMinor, taxRateBps: await defaultTaxBps(expert?.countryCode, db) }], notes: `enrollment:${e.id}` }, db);
  const pay = await startPayment(user, invoice.id, method, null, db);
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
  const course = await db.course.findUniqueOrThrow({ where: { id: courseId }, include: { assessments: { where: { isFinal: true } } } });
  const [lessonsTotal, lessonsDone] = await Promise.all([db.lesson.count({ where: { module: { courseId } } }), db.lessonProgress.count({ where: { enrollmentId: e.id } })]);
  const finalIds = course.assessments.map((a) => a.id);
  const best = finalIds.length ? await db.assessmentAttempt.aggregate({ where: { assessmentId: { in: finalIds }, userId: user.id }, _max: { scorePct: true } }) : null;
  const elig = certificateEligibility({ lessonsTotal, lessonsDone, hasFinal: finalIds.length > 0, bestScorePct: best?._max.scorePct ?? null, passingScore: course.passingScore });
  if (!elig.eligible) throw new DomainError("INVALID_STATE", `Conditions non remplies : ${elig.reasons.join(" ")}`);
  return inTransaction(db, async (tx) => {
    const cert = await tx.learningCertificate.create({ data: { code: `TB-${humanCode(4)}-${humanCode(4)}`, enrollmentId: e.id, holderName: `${user.firstName} ${user.lastName}`, courseTitle: course.title, scorePct: best?._max.scorePct ?? 100 } });
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
  return db.enrollment.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, include: { course: { select: { title: true, slug: true, durationHours: true } }, certificate: true } });
}

// ── Espace formateur ─────────────────────────────────────────

function assertInstructor(user: SessionUser, course: { instructorId: string }) {
  if (course.instructorId !== user.id && user.platformRole !== "ADMIN") throw new DomainError("FORBIDDEN", "Réservé au formateur du cours.");
}

export async function createCourse(user: SessionUser, input: { title: string; summary: string; description: string | null; level: string; durationHours: number; price: number; currency: string; passingScore: number }, db: Db = prisma) {
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
  const course = await db.course.findUniqueOrThrow({ where: { id: courseId }, include: { _count: { select: { modules: true } } } });
  assertInstructor(user, course);
  if (status === "PUBLISHED" && course._count.modules === 0) throw new DomainError("VALIDATION", "Ajoutez au moins une leçon avant publication.");
  await db.course.update({ where: { id: courseId }, data: { status } });
}

export async function instructorCourses(userId: string, db: Db = prisma) {
  return db.course.findMany({ where: { instructorId: userId }, orderBy: { updatedAt: "desc" }, include: { _count: { select: { enrollments: true, modules: true } }, enrollments: { select: { progressPct: true, status: true, user: { select: { firstName: true, lastName: true } } } } } });
}
