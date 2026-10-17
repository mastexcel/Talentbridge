/** Isolation multi-organisation et contrôle d'accès côté serveur. */
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/db";
import { DomainError } from "@/domain/errors";
import { createMission, getOrgMission, listApplications, listOrgMissions, changeMissionStatus } from "@/application/mission.service";
import { listMembers, inviteMember, changeMemberRole } from "@/application/organization.service";
import { pipeline, createOpportunity } from "@/application/crm.service";
import { getInvoice } from "@/application/billing.service";
import { canReadFile } from "@/application/file.service";
import { runMatching } from "@/application/matching.service";
import { completeExpertProfile, makeUser, missionInput, resetDb, session, skillIds } from "./helpers";

const forbidden = (p: Promise<unknown>) => expect(p).rejects.toSatisfy((e) => e instanceof DomainError && ["FORBIDDEN", "NOT_FOUND", "PLAN_LIMIT"].includes(e.code));

describe("séparation multi-tenant", () => {
  let orgA: Awaited<ReturnType<typeof makeUser>>;
  let orgB: Awaited<ReturnType<typeof makeUser>>;
  let missionA: { id: string };

  beforeAll(async () => {
    await resetDb();
    orgA = await makeUser("NGO");
    orgB = await makeUser("COMPANY");
    const ids = await skillIds();
    missionA = await createMission(orgA, orgA.activeOrgId!, missionInput([{ skillId: ids["suivi-evaluation"], mandatory: true, minLevel: 2 }]));
  });

  it("une organisation ne lit ni ne modifie les missions d'une autre", async () => {
    await forbidden(getOrgMission(orgB, missionA.id));
    await forbidden(listApplications(orgB, missionA.id));
    await forbidden(changeMissionStatus(orgB, missionA.id, "PUBLISHED"));
    await forbidden(runMatching(orgB, missionA.id));
    await forbidden(listOrgMissions(orgB, orgA.activeOrgId!));
    await expect(listOrgMissions(orgA, orgA.activeOrgId!)).resolves.toMatchObject({ total: 1 });
  });

  it("ne peut pas créer de mission pour une autre organisation", async () => {
    const ids = await skillIds();
    await forbidden(createMission(orgB, orgA.activeOrgId!, missionInput([{ skillId: ids["audit-financier"], mandatory: false, minLevel: 1 }])));
  });

  it("isole les collaborateurs et les invitations", async () => {
    await forbidden(listMembers(orgB, orgA.activeOrgId!));
    await forbidden(inviteMember(orgB, orgA.activeOrgId!, "x@test.local", "ADMIN"));
  });

  it("isole les données CRM (et exige l'offre incluant le CRM)", async () => {
    await forbidden(pipeline(orgA)); // aucune offre incluant le CRM
    const plan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { code: "ORG_BUSINESS" }, include: { prices: true } });
    for (const o of [orgA, orgB]) await prisma.subscription.create({ data: { planId: plan.id, priceId: plan.prices[0].id, organizationId: o.activeOrgId!, status: "ACTIVE", currentPeriodEnd: new Date(Date.now() + 86_400_000) } });
    await createOpportunity(orgA, { title: "Opportunité A", value: 1000, currency: "XOF", stage: "PROSPECT", expectedCloseDate: null, contactId: null, leadId: null, assigneeId: null });
    const a = await pipeline(orgA);
    const b = await pipeline(orgB);
    expect(a.stages.flatMap((s) => s.items)).toHaveLength(1);
    expect(b.stages.flatMap((s) => s.items)).toHaveLength(0);
  });

  it("un rôle Lecteur ne peut pas publier ; le dernier propriétaire est protégé", async () => {
    const viewer = await makeUser("EXPERT");
    await prisma.organizationMember.create({ data: { organizationId: orgA.activeOrgId!, userId: viewer.id, role: "VIEWER" } });
    await prisma.session.updateMany({ where: { userId: viewer.id }, data: { activeOrgId: orgA.activeOrgId } });
    const v = await session(viewer.id);
    await forbidden(changeMissionStatus(v, missionA.id, "PUBLISHED"));
    await expect(changeMemberRole(orgA, orgA.activeOrgId!, orgA.id, "ADMIN")).rejects.toThrow(/au moins un propriétaire/);
  });

  it("un utilisateur peut appartenir à plusieurs organisations avec des rôles différents", async () => {
    const multi = await makeUser("EXPERT");
    await prisma.organizationMember.createMany({ data: [{ organizationId: orgA.activeOrgId!, userId: multi.id, role: "RECRUITER" }, { organizationId: orgB.activeOrgId!, userId: multi.id, role: "VIEWER" }] });
    const s = await session(multi.id);
    expect(s.memberships.map((m) => m.role).sort()).toEqual(["RECRUITER", "VIEWER"]);
    await expect(getOrgMission(s, missionA.id)).resolves.toBeTruthy();
  });

  it("factures et documents restent privés", async () => {
    const inv = await prisma.invoice.create({ data: { organizationId: orgA.activeOrgId!, currency: "XOF", buyerSnapshot: {}, sellerSnapshot: {}, status: "ISSUED", number: "TEST-1" } });
    await forbidden(getInvoice(orgB, inv.id));
    await expect(getInvoice(orgA, inv.id)).resolves.toBeTruthy();
    const file = await prisma.storedFile.create({ data: { ownerUserId: orgA.id, organizationId: orgA.activeOrgId, storageKey: "k1", filename: "rccm.pdf", mimeType: "application/pdf", sizeBytes: 10, sha256: "x", purpose: "ORG_DOCUMENT" } });
    expect(await canReadFile(orgA, file.id)).toBe(true);
    expect(await canReadFile(orgB, file.id)).toBe(false);
    expect(await canReadFile(null, file.id)).toBe(false);
  });

  it("le CV d'un expert n'est lisible que par les organisations auxquelles il a candidaté", async () => {
    const ex = await makeUser("EXPERT");
    const cv = await prisma.storedFile.create({ data: { ownerUserId: ex.id, storageKey: "cv1", filename: "cv.pdf", mimeType: "application/pdf", sizeBytes: 10, sha256: "x", purpose: "CV" } });
    await completeExpertProfile(ex.expertProfile!.id, ["suivi-evaluation"]);
    await prisma.expertProfile.update({ where: { id: ex.expertProfile!.id }, data: { cvFileId: cv.id } });
    expect(await canReadFile(orgA, cv.id)).toBe(false);
    await prisma.application.create({ data: { missionId: missionA.id, expertId: ex.expertProfile!.id, coverLetter: "x".repeat(60) } });
    expect(await canReadFile(orgA, cv.id)).toBe(true);
    expect(await canReadFile(orgB, cv.id)).toBe(false);
  });
});
