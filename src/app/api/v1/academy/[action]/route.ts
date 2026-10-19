import { z } from "zod";
import { actions, defineAction } from "@/infrastructure/http/actions";
import { addLesson, addSession, claimCertificate, completeLesson, createCourse, enroll, markAttendance, removeSession, setAssessment, setCourseStatus, submitAttempt } from "@/application/academy.service";
import { courseSchema, lessonSchema, sessionSchema } from "@/application/schemas";

export const POST = actions<{ action: string }>({
  enroll: defineAction({ schema: z.object({ courseId: z.string(), sessionId: z.string().nullable().optional(), method: z.enum(["MOBILE_MONEY", "CARD", "BANK_TRANSFER"]).nullable().optional() }), run: async ({ user }, b) => enroll(user, b.courseId, b.method ?? null, undefined, b.sessionId ?? null) }),
  "lesson-complete": defineAction({ schema: z.object({ lessonId: z.string() }), run: async ({ user }, b) => completeLesson(user, b.lessonId) }),
  attempt: defineAction({ schema: z.object({ assessmentId: z.string(), answers: z.record(z.coerce.number().int().min(0)) }), run: async ({ user }, b) => submitAttempt(user, b.assessmentId, b.answers) }),
  certificate: defineAction({ schema: z.object({ courseId: z.string() }), run: async ({ user }, b) => { const c = await claimCertificate(user, b.courseId); return { certificate: c, redirectUrl: `/certificats/${c.code}` }; } }),
  "course-create": defineAction({ schema: courseSchema, run: async ({ user }, b) => { const c = await createCourse(user, b); return { course: c, redirectUrl: `/academy/formateur/${c.id}` }; } }),
  "lesson-add": defineAction({ schema: lessonSchema.extend({ courseId: z.string() }), run: async ({ user }, b) => addLesson(user, b.courseId, b) }),
  assessment: defineAction({
    schema: z.object({ courseId: z.string(), title: z.string().trim().min(2).max(160), questions: z.array(z.object({ id: z.string(), prompt: z.string().min(2).max(500), options: z.array(z.string().min(1).max(300)).min(2).max(6), answer: z.coerce.number().int().min(0) })).min(1).max(50) }),
    run: async ({ user }, b) => setAssessment(user, b.courseId, b.title, b.questions),
  }),
  "session-add": defineAction({ schema: sessionSchema.extend({ courseId: z.string() }), run: async ({ user }, { courseId, ...b }) => addSession(user, courseId, b) }),
  "session-remove": defineAction({ schema: z.object({ sessionId: z.string() }), run: async ({ user }, b) => removeSession(user, b.sessionId) }),
  attendance: defineAction({ schema: z.object({ enrollmentId: z.string(), attended: z.boolean() }), run: async ({ user }, b) => markAttendance(user, b.enrollmentId, b.attended) }),
  "course-status": defineAction({ schema: z.object({ courseId: z.string(), status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]) }), run: async ({ user }, b) => setCourseStatus(user, b.courseId, b.status) }),
});
