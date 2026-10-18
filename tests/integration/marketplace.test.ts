/** Parcours métier complet : mission → matching → candidature → sélection → contrat → projet → livrable → évaluation. */
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/db";
import { apply, changeMissionStatus, createMission, decideApplication, scheduleInterview, withdraw } from "@/application/mission.service";
import { decideMatch, getMatches, runMatching } from "@/application/matching.service";
import { addProjectMember, createContractFromApplication, createProject, createTask, getProject, moveTask, reviewContract, reviewDeliverable, submitDeliverable, transitionContract } from "@/application/project.service";
import { claimCertificate, completeLesson, enroll, submitAttempt } from "@/application/academy.service";
import { ceoKpis } from "@/application/analytics.service";
import { certificateParties, completeExpertProfile, makeAdmin, makeUser, missionInput, resetDb, skillIds } from "./helpers";

describe("marketplace et exécution", () => {
  beforeAll(resetDb);

  it("de la publication à l'évaluation finale", async () => {
    const org = await makeUser("NGO");
    const expert = await makeUser("EXPERT");
    const other = await makeUser("EXPERT");
    await completeExpertProfile(expert.expertProfile!.id, ["suivi-evaluation", "enquetes"]);
    await completeExpertProfile(other.expertProfile!.id, ["audit-financier"]);
    const ids = await skillIds();
    const m = await createMission(org, org.activeOrgId!, missionInput([{ skillId: ids["suivi-evaluation"], mandatory: true, minLevel: 3 }, { skillId: ids["enquetes"], mandatory: false, minLevel: 2 }]));
    expect(m.status).toBe("DRAFT");
    expect(m.reference).toMatch(/^TB-M-\d{4}-\d{5}$/);
    await expect(apply(expert, m.id, { coverLetter: "x".repeat(60), availableFrom: null, technicalFileId: null, financialFileId: null })).rejects.toThrow(/n'accepte plus/);
    await changeMissionStatus(org, m.id, "PUBLISHED");
    // Offre gratuite « Découverte » : un brouillon reste possible, une 2e publication non.
    const m2 = await createMission(org, org.activeOrgId!, missionInput([{ skillId: ids["enquetes"], mandatory: false, minLevel: 1 }]));
    await expect(changeMissionStatus(org, m2.id, "PUBLISHED")).rejects.toMatchObject({ code: "PLAN_LIMIT" });

    // Matching : seul l'expert pertinent est recommandé, score expliqué
    await runMatching(org, m.id);
    const matches = await getMatches(org, m.id);
    expect(matches.map((x) => x.expertId)).toEqual([expert.expertProfile!.id]);
    expect((matches[0].breakdown as { criteria: unknown[] }).criteria).toHaveLength(6);
    await decideMatch(org, matches[0].id, "ACCEPTED");
    expect(await prisma.shortlistEntry.count({ where: { expertId: expert.expertProfile!.id } })).toBe(1);

    // Candidature, doublon refusé, retrait possible pour un autre
    const app = await apply(expert, m.id, { coverLetter: "Proposition technique détaillée ".repeat(3), proposedRate: 200000, currency: "XOF", availableFrom: null, technicalFileId: null, financialFileId: null });
    await expect(apply(expert, m.id, { coverLetter: "x".repeat(60), availableFrom: null, technicalFileId: null, financialFileId: null })).rejects.toThrow(/déjà candidaté/);
    const app2 = await apply(other, m.id, { coverLetter: "x".repeat(60), availableFrom: null, technicalFileId: null, financialFileId: null });
    await withdraw(other, app2.id);
    await expect(apply(org, m.id, { coverLetter: "x".repeat(60), availableFrom: null, technicalFileId: null, financialFileId: null })).rejects.toThrow(/consultants/);

    // Présélection, entretien, sélection (la mission avance automatiquement)
    await decideApplication(org, app.id, "SHORTLISTED", null);
    await scheduleInterview(org, app.id, { scheduledAt: new Date(Date.now() + 86_400_000), durationMin: 30, mode: "VISIO", location: null, notes: null });
    await decideApplication(org, app.id, "SELECTED", "Retenu");
    expect((await prisma.mission.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("SELECTION");

    // Contrat : seul l'expert signe
    const c = await createContractFromApplication(org, app.id, { amountMinor: 4_000_000, startDate: null, endDate: null, terms: null });
    await transitionContract(org, c.id, "SENT");
    await expect(transitionContract(org, c.id, "SIGNED")).rejects.toThrow(/Seul l'expert/);
    await transitionContract(expert, c.id, "SIGNED");
    await transitionContract(org, c.id, "ACTIVE");
    expect((await prisma.mission.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("IN_PROGRESS");

    // Équipe projet et livrables
    const p = await createProject(org, org.activeOrgId!, { name: "Projet test", description: null, missionId: m.id, startDate: null, endDate: null });
    await expect(getProject(other, p.id)).rejects.toThrow(/membre/);
    await addProjectMember(org, p.id, { expertId: expert.expertProfile!.id, role: "LEAD", responsibilities: null });
    await expect(addProjectMember(org, p.id, { expertId: other.expertProfile!.id, role: "CONSULTANT", responsibilities: null })).rejects.toThrow(/retenu/);
    const t = await createTask(expert, p.id, { title: "Rapport final", description: null, assigneeId: expert.id, startDate: null, dueDate: null, isDeliverable: true });
    await expect(moveTask(expert, t.id, "DONE")).rejects.toThrow(/validé/);
    const f = await prisma.storedFile.create({ data: { ownerUserId: expert.id, storageKey: "liv", filename: "rapport.pdf", mimeType: "application/pdf", sizeBytes: 1, sha256: "x", purpose: "DELIVERABLE" } });
    await submitDeliverable(expert, t.id, f.id);
    await reviewDeliverable(org, t.id, true, "Très bien");
    expect((await prisma.projectTask.findUniqueOrThrow({ where: { id: t.id } })).status).toBe("DONE");

    // Clôture, commission, évaluation vérifiée
    await expect(reviewContract(org, c.id, 5, null)).rejects.toThrow(/terminé/);
    await transitionContract(org, c.id, "COMPLETED");
    expect(await prisma.commission.count({ where: { contractId: c.id } })).toBe(1);
    await reviewContract(org, c.id, 4, "Bon travail");
    const profile = await prisma.expertProfile.findUniqueOrThrow({ where: { id: expert.expertProfile!.id } });
    expect(profile).toMatchObject({ averageRating: 4, ratingsCount: 1, completedMissions: 1 });

    // Les KPI de direction reflètent ces données réelles
    const k = await ceoKpis({ from: new Date(Date.now() - 86_400_000), to: new Date(Date.now() + 86_400_000), currency: "XOF", includeDemo: false });
    expect(k.totals.missionsAwarded).toBe(1);
    expect(k.rates.satisfaction).toBe(4);
    expect(k.rates.avgMatchingHours).not.toBeNull();
    const ceo = await makeAdmin(["ANALYTICS_VIEW"]);
    expect(ceo.platformRole).toBe("ADMIN");
  });

  it("Academy : certificat délivré seulement après toutes les leçons et l'évaluation réussie", async () => {
    const trainer = await makeUser("TRAINING_PROVIDER");
    const learner = await makeUser("EXPERT");
    const course = await prisma.course.create({ data: { slug: "cours-test", title: "Cours test", summary: "Résumé du cours test", status: "PUBLISHED", instructorId: trainer.id, ...(await certificateParties(trainer.id)), passingScore: 60, modules: { create: { title: "M1", lessons: { create: [{ title: "L1" }, { title: "L2" }] } } }, assessments: { create: { title: "Final", questions: [{ id: "q1", prompt: "?", options: ["a", "b"], answer: 1 }, { id: "q2", prompt: "?", options: ["a", "b"], answer: 0 }] } } }, include: { modules: { include: { lessons: true } }, assessments: true } });
    await enroll(learner, course.id, null);
    await expect(claimCertificate(learner, course.id)).rejects.toThrow(/Leçons/);
    for (const l of course.modules[0].lessons) await completeLesson(learner, l.id);
    const fail = await submitAttempt(learner, course.assessments[0].id, { q1: 0, q2: 1 });
    expect(fail.passed).toBe(false);
    await expect(claimCertificate(learner, course.id)).rejects.toThrow(/non réussie/);
    await submitAttempt(learner, course.assessments[0].id, { q1: 1, q2: 0 });
    const cert = await claimCertificate(learner, course.id);
    expect(cert.code).toMatch(/^TB-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect((await claimCertificate(learner, course.id)).id).toBe(cert.id);
    // Copie figée de l'institution et des signataires
    expect(cert.snapshot).toMatchObject({ issuer: { name: "Institut Test", signatoryName: "Dr Test" }, tb: { fullName: "Cosignataire Test" } });
  });
});
