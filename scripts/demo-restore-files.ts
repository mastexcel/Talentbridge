/** Démo hébergée sans disque persistant : régénère les images de démonstration effacées au redémarrage. */
import { PrismaClient } from "@prisma/client";
import { restoreDemoFiles } from "../prisma/seed-certificates";

const prisma = new PrismaClient();
restoreDemoFiles(prisma)
  .catch((e) => console.error("Restauration des images de démonstration :", e))
  .finally(() => prisma.$disconnect());
