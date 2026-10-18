import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/db";
import { publicFigures } from "@/application/figures.service";
import { makeUser, resetDb } from "./helpers";

describe("chiffres des visuels publics", () => {
  beforeAll(resetDb);

  it("compte les organisations validées et exclut la démo hors environnement de démonstration", async () => {
    const real = await makeUser("COMPANY");
    const demo = await makeUser("NGO");
    await prisma.organization.update({ where: { id: real.activeOrgId! }, data: { status: "VERIFIED" } });
    await prisma.organization.update({ where: { id: demo.activeOrgId! }, data: { status: "VERIFIED", isDemo: true } });

    const prod = await publicFigures(false);
    expect(prod).toMatchObject({ organizations: 1, isDemo: false });
    const withDemo = await publicFigures(true);
    expect(withDemo).toMatchObject({ organizations: 2, isDemo: true });
    expect(withDemo.countries).toBeGreaterThanOrEqual(1);
  });

  it("ne compte un expert comme vérifié qu'avec un badge actif", async () => {
    const before = (await publicFigures(false)).expertsVerified;
    const expert = await makeUser("EXPERT");
    const profile = await prisma.expertProfile.findUniqueOrThrow({ where: { userId: expert.id } });
    const badge = await prisma.badge.findFirstOrThrow();
    const admin = await makeUser("EXPERT");
    const awarded = await prisma.expertBadge.create({ data: { expertId: profile.id, badgeId: badge.id, awardedById: admin.id, revokedAt: new Date() } });
    expect((await publicFigures(false)).expertsVerified).toBe(before);
    await prisma.expertBadge.update({ where: { id: awarded.id }, data: { revokedAt: null } });
    expect((await publicFigures(false)).expertsVerified).toBe(before + 1);
  });
});
