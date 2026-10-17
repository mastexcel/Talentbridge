import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/db";
import { getUserBySessionToken, login, requestPasswordReset, resetPassword, signup, verifyEmail } from "@/application/auth.service";
import { resetDb } from "./helpers";

const base = { firstName: "Awa", lastName: "Koné", phone: null, password: "Motdepasse123", countryCode: "CI", acceptTerms: true, acceptPrivacy: true, marketingEmail: false, invitationToken: null } as const;

describe("authentification", () => {
  beforeAll(resetDb);

  it("inscription consultant : compte utilisateur + profil expert, consentements historisés", async () => {
    const r = await signup({ ...base, accountType: "EXPERT", email: "awa@test.local", organizationName: null });
    const u = await prisma.user.findUniqueOrThrow({ where: { id: r.userId }, include: { expertProfile: true, consents: true, memberships: true } });
    expect(u.expertProfile).not.toBeNull();
    expect(u.memberships).toHaveLength(0);
    expect(u.consents.map((c) => c.type).sort()).toEqual(["MARKETING_EMAIL", "PRIVACY", "TERMS"]);
    expect(u.passwordHash).not.toContain("Motdepasse");
  });

  it("inscription organisation : utilisateur distinct, propriétaire d'une organisation en attente de validation", async () => {
    const r = await signup({ ...base, accountType: "NGO", email: "ong@test.local", organizationName: "ONG Test" });
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: r.organizationId! }, include: { members: true } });
    expect(org.status).toBe("PENDING");
    expect(org.members[0]).toMatchObject({ userId: r.userId, role: "OWNER" });
  });

  it("refuse un email déjà utilisé", async () => {
    await expect(signup({ ...base, accountType: "EXPERT", email: "awa@test.local", organizationName: null })).rejects.toThrow(/existe déjà/);
  });

  it("vérification d'email à usage unique", async () => {
    const r = await signup({ ...base, accountType: "EXPERT", email: "verif@test.local", organizationName: null });
    await verifyEmail(r.verifyToken);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: r.userId } })).emailVerifiedAt).not.toBeNull();
    await expect(verifyEmail(r.verifyToken)).rejects.toThrow();
  });

  it("connexion, message identique si compte inconnu, verrouillage après 5 échecs", async () => {
    const ok = await login("awa@test.local", "Motdepasse123");
    expect(await getUserBySessionToken(ok.token)).not.toBeNull();
    await expect(login("inconnu@test.local", "x")).rejects.toThrow("Email ou mot de passe incorrect.");
    for (let i = 0; i < 5; i++) await expect(login("awa@test.local", "mauvais")).rejects.toThrow();
    await expect(login("awa@test.local", "Motdepasse123")).rejects.toThrow(/verrouillé/);
  });

  it("réinitialisation : lien à usage unique, toutes les sessions révoquées", async () => {
    await prisma.user.update({ where: { email: "awa@test.local" }, data: { lockedUntil: null, failedLogins: 0 } });
    const { token: sessionToken } = await login("awa@test.local", "Motdepasse123");
    const reset = (await requestPasswordReset("awa@test.local"))!;
    await resetPassword(reset, "Nouveau123456");
    expect(await getUserBySessionToken(sessionToken)).toBeNull();
    await expect(resetPassword(reset, "Encore123456")).rejects.toThrow();
    await expect(login("awa@test.local", "Nouveau123456")).resolves.toBeTruthy();
    expect(await requestPasswordReset("personne@test.local")).toBeNull();
  });

  it("un compte suspendu perd ses sessions et ne se connecte plus", async () => {
    const { token } = await login("ong@test.local", "Motdepasse123");
    await prisma.user.update({ where: { email: "ong@test.local" }, data: { status: "SUSPENDED" } });
    expect(await getUserBySessionToken(token)).toBeNull();
    await expect(login("ong@test.local", "Motdepasse123")).rejects.toThrow(/suspendu/);
  });
});
