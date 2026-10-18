import { prisma } from "@/infrastructure/db";
import { seedReference } from "../../prisma/seed-reference";
import { createSession, getUserBySessionToken, signup, type SessionUser } from "@/application/auth.service";
import type { SignupInput } from "@/application/schemas";

/** Remet la base de test à zéro (toutes les tables métier) puis recharge les référentiels. */
export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  await seedReference(prisma, false);
}

let n = 0;
export async function makeUser(kind: "EXPERT" | SignupInput["accountType"] = "EXPERT", extra: Partial<SignupInput> = {}): Promise<SessionUser> {
  n++;
  const r = await signup({
    accountType: kind,
    firstName: `Prénom${n}`,
    lastName: `Nom${n}`,
    email: `user${n}-${Date.now()}@test.local`,
    phone: null,
    password: "Motdepasse123",
    countryCode: "CI",
    organizationName: kind === "EXPERT" ? null : `Organisation ${n}`,
    acceptTerms: true,
    acceptPrivacy: true,
    marketingEmail: false,
    invitationToken: null,
    ...extra,
  } as SignupInput);
  await prisma.user.update({ where: { id: r.userId }, data: { emailVerifiedAt: new Date() } });
  return session(r.userId);
}

export async function session(userId: string): Promise<SessionUser> {
  return (await getUserBySessionToken(await createSession(userId)))!;
}

export async function makeAdmin(perms: Parameters<typeof prisma.user.update>[0]["data"]["adminPermissions"]) {
  const u = await makeUser();
  await prisma.user.update({ where: { id: u.id }, data: { platformRole: "ADMIN", adminPermissions: perms } });
  return session(u.id);
}

export async function skillIds() {
  return Object.fromEntries((await prisma.skill.findMany()).map((s) => [s.slug, s.id]));
}

/** Profil expert complété (≥ 60 %) pour pouvoir soumettre à vérification et être candidat. */
export async function completeExpertProfile(expertId: string, skills: string[]) {
  const ids = await skillIds();
  const domain = await prisma.expertiseDomain.findFirstOrThrow();
  await prisma.expertProfile.update({
    where: { id: expertId },
    data: {
      headline: "Expert de test confirmé",
      bio: "Biographie de test suffisamment longue pour atteindre le seuil requis de quatre-vingts caractères.",
      city: "Abidjan",
      yearsExperience: 12,
      languages: ["fr"],
      visibility: "PUBLIC",
      cvFileId: "cv-test",
      domains: { create: [{ domainId: domain.id }] },
      skills: { create: skills.map((s) => ({ skillId: ids[s], level: 4, years: 8 })) },
      experiences: { create: [{ title: "Consultant", employer: "Client", startDate: new Date("2015-01-01") }] },
      qualifications: { create: [{ title: "Master", institution: "Université" }] },
      references: { create: [{ contactName: "A", contactOrg: "B" }, { contactName: "C", contactOrg: "D" }] },
    },
  });
}

export const missionInput = (requirements: { skillId: string; mandatory: boolean; minLevel: number }[]) => ({
  title: "Mission de test d'intégration",
  description: "Description détaillée de la mission de test pour vérifier le parcours complet.",
  objectives: null,
  expectedResults: null,
  domainId: null,
  experienceYearsMin: 5,
  languages: ["fr"],
  countryCode: "CI",
  city: null,
  workMode: "REMOTE" as const,
  durationDays: 20,
  startDate: null,
  budgetMin: 1_000_000,
  budgetMax: 5_000_000,
  currency: "XOF",
  applicationDeadline: null,
  visibility: "PUBLIC" as const,
  requirements,
});

/** Institution validée et cosignataire actif (fichiers fictifs : seuls les identifiants comptent ici). */
export async function certificateParties(createdById: string) {
  const issuer = await prisma.certificateIssuer.create({ data: { name: "Institut Test", createdById, logoFileId: "f-logo", sealFileId: "f-seal", signatureFileId: "f-sig", signatoryName: "Dr Test", signatoryTitle: "Directeur", authorizationAttested: true, status: "VALIDATED" } });
  const tb = await prisma.tbSignatory.create({ data: { fullName: "Cosignataire Test", title: "DG", signatureFileId: "f-tb", createdById, forVerification: true } });
  return { issuerId: issuer.id, tbSignatoryId: tb.id };
}
