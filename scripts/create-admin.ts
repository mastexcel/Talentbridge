/**
 * Création (ou promotion) d'un super-administrateur — à utiliser pour le premier compte en production.
 * Usage : ADMIN_EMAIL=… ADMIN_PASSWORD=… ADMIN_FIRST_NAME=… ADMIN_LAST_NAME=… npm run admin:create
 * Le mot de passe est lu dans l'environnement (jamais en argument de ligne de commande) et doit
 * respecter la politique de mots de passe de la plateforme.
 */
import "dotenv/config";
import { password as passwordRule } from "../src/application/schemas";
import { audit } from "../src/application/audit.service";
import { hashPassword } from "../src/infrastructure/auth/password";
import { prisma } from "../src/infrastructure/db";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const pwd = process.env.ADMIN_PASSWORD ?? "";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("ADMIN_EMAIL invalide.");
  const check = passwordRule.safeParse(pwd);
  if (!check.success) throw new Error(`ADMIN_PASSWORD refusé : ${check.error.issues[0]?.message}`);
  const user = await prisma.user.upsert({
    where: { email },
    update: { platformRole: "ADMIN", adminPermissions: ["SUPER_ADMIN"], status: "ACTIVE" },
    create: {
      email,
      passwordHash: await hashPassword(pwd),
      firstName: process.env.ADMIN_FIRST_NAME ?? "Administrateur",
      lastName: process.env.ADMIN_LAST_NAME ?? "Talent Bridge",
      emailVerifiedAt: new Date(),
      platformRole: "ADMIN",
      adminPermissions: ["SUPER_ADMIN"],
    },
  });
  await audit({ actorId: null, action: "admin.bootstrap", entityType: "User", entityId: user.id, metadata: { email } });
  console.log(`Super-administrateur prêt : ${email} (le mot de passe d'un compte existant n'est pas modifié).`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
