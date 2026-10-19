import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/db";
import { academyFigures, addSession, catalog, claimCertificate, enroll, getCourse, markAttendance, removeSession, setCourseStatus, upcomingSessions } from "@/application/academy.service";
import { homePathFor } from "@/lib/home";
import { certificateParties, makeUser, resetDb } from "./helpers";

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000);

describe("Academy : séminaires, sessions et apprenants", () => {
  beforeAll(resetDb);

  it("compte apprenant : ni profil d'expert ni organisation, accueil sur ses formations", async () => {
    const learner = await makeUser("LEARNER");
    expect(learner.expertProfile).toBeNull();
    expect(learner.memberships).toHaveLength(0);
    expect(homePathFor(learner)).toBe("/espace/formations");
  });

  it("séminaire : session obligatoire, places limitées, lien réservé aux inscrits, certificat après présence attestée", async () => {
    const trainer = await makeUser("TRAINING_PROVIDER");
    const seminar = await prisma.course.create({ data: { slug: "seminaire-test", title: "Séminaire test", summary: "Résumé du séminaire", kind: "SEMINAR", format: "IN_PERSON", instructorId: trainer.id, ...(await certificateParties(trainer.id)) } });

    // Mise en ligne impossible sans session programmée
    await expect(setCourseStatus(trainer, seminar.id, "PUBLISHED")).rejects.toThrow(/session/);
    await expect(addSession(trainer, seminar.id, { title: "Passée", startsAt: inDays(-1), durationMin: 120, mode: "IN_PERSON", joinUrl: null, venue: null, city: "Abidjan", countryCode: "CI", capacity: 2 })).rejects.toThrow(/futur/);
    await expect(addSession(trainer, seminar.id, { title: "Sans lieu", startsAt: inDays(5), durationMin: 120, mode: "IN_PERSON", joinUrl: null, venue: null, city: null, countryCode: null, capacity: 2 })).rejects.toThrow(/Ville et pays/);
    const s = await addSession(trainer, seminar.id, { title: "Abidjan", startsAt: inDays(5), durationMin: 120, mode: "IN_PERSON", joinUrl: null, venue: "Salle A", city: "Abidjan", countryCode: "CI", capacity: 2 });
    const online = await addSession(trainer, seminar.id, { title: "En ligne", startsAt: inDays(6), durationMin: 60, mode: "VIRTUAL", joinUrl: "https://visio.example/salle", venue: null, city: null, countryCode: null, capacity: null });
    await setCourseStatus(trainer, seminar.id, "PUBLISHED");

    const [a, b, c, d] = [await makeUser("LEARNER"), await makeUser("EXPERT"), await makeUser("LEARNER"), await makeUser("LEARNER")];
    await expect(enroll(a, seminar.id, null)).rejects.toThrow(/session/);
    // Inscriptions simultanées sur la dernière place : une seule passe
    await enroll(a, seminar.id, null, undefined, s.id);
    const race = await Promise.allSettled([enroll(b, seminar.id, null, undefined, s.id), enroll(c, seminar.id, null, undefined, s.id)]);
    expect(race.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(String((race.find((r) => r.status === "rejected") as PromiseRejectedResult).reason)).toMatch(/complète/);
    expect(await prisma.enrollment.count({ where: { sessionId: s.id } })).toBe(2);

    // Le lien de connexion n'est visible que de l'inscrit de la session en ligne
    await enroll(d, seminar.id, null, undefined, online.id);
    expect((await getCourse("seminaire-test", d))!.course.sessions.find((x) => x.id === online.id)!.joinUrl).toBe("https://visio.example/salle");
    expect((await getCourse("seminaire-test", a))!.course.sessions.find((x) => x.id === online.id)!.joinUrl).toBeNull();
    expect((await getCourse("seminaire-test", null))!.course.sessions.every((x) => x.joinUrl === null)).toBe(true);

    // Catalogue, agenda et chiffres
    const cards = await catalog({ kind: "SEMINAR" });
    expect(cards.map((x) => x.slug)).toContain("seminaire-test");
    expect(cards.find((x) => x.slug === "seminaire-test")!.sessions[0].seatsLeft).toBe(0);
    expect(await catalog({ kind: "TRAINING", q: "Séminaire test" })).toHaveLength(0);
    expect((await upcomingSessions()).map((x) => x.id)).toEqual(expect.arrayContaining([s.id, online.id]));
    expect((await academyFigures()).seminars).toBe(1);

    // Pas de certificat sans présence ; présence impossible avant le début de la session
    await expect(claimCertificate(a, seminar.id)).rejects.toThrow(/Présence/);
    const ea = await prisma.enrollment.findFirstOrThrow({ where: { userId: a.id, courseId: seminar.id } });
    await expect(markAttendance(trainer, ea.id, true)).rejects.toThrow(/commencée/);
    await expect(markAttendance(a, ea.id, true)).rejects.toThrow(/formateur/);
    await prisma.liveSession.update({ where: { id: s.id }, data: { startsAt: inDays(-0.1) } });
    await markAttendance(trainer, ea.id, true);
    const cert = await claimCertificate(a, seminar.id);
    expect(cert.snapshot).toMatchObject({ kind: "SEMINAR", format: "IN_PERSON" });
    await expect(markAttendance(trainer, ea.id, false)).rejects.toThrow(/certificat/);

    // Une session avec des inscrits ne peut pas être supprimée
    await expect(removeSession(trainer, s.id)).rejects.toThrow(/inscrits/);
  });

  it("formation en ligne : aucune session, inscription directe", async () => {
    const trainer = await makeUser("TRAINING_PROVIDER");
    const course = await prisma.course.create({ data: { slug: "en-ligne-test", title: "Formation en ligne", summary: "Résumé", status: "PUBLISHED", instructorId: trainer.id, ...(await certificateParties(trainer.id)), modules: { create: { title: "M1", lessons: { create: { title: "L1" } } } } } });
    await expect(addSession(trainer, course.id, { title: "X", startsAt: inDays(3), durationMin: 60, mode: "VIRTUAL", joinUrl: null, venue: null, city: null, countryCode: null, capacity: null })).rejects.toThrow(/en ligne/);
    const learner = await makeUser("LEARNER");
    const r = await enroll(learner, course.id, null);
    expect(r.redirectUrl).toBe("/academy/en-ligne-test/suivre");
  });
});
