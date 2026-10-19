/**
 * Démonstration du protocole de certification : institution délivrante FICTIVE, cosignataire
 * Talent Bridge FICTIF et images « spécimen » générées (logo, cachet, signatures).
 * Aucune personne ni institution réelle. Idempotent : peut être relancé.
 */
import { createHash, randomBytes } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { storage } from "../src/infrastructure/storage/storage";

const ISSUER_NAME = "Institut Démo Formation (fictif)";
const TB_NAME = "Signataire Démo Talent Bridge";

const svgPng = async (svg: string) => new Uint8Array(await sharp(Buffer.from(svg)).png().toBuffer());

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="0 0 420 420">
  <circle cx="210" cy="210" r="196" fill="#ffffff" stroke="#3f5512" stroke-width="10"/>
  <circle cx="210" cy="210" r="170" fill="none" stroke="#3f5512" stroke-width="3"/>
  <text x="210" y="190" text-anchor="middle" font-family="Georgia, serif" font-size="92" font-weight="bold" fill="#3f5512">IDF</text>
  <text x="210" y="245" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="#3f5512">INSTITUT DÉMO</text>
  <text x="210" y="285" text-anchor="middle" font-family="Georgia, serif" font-size="24" fill="#3f5512">FORMATION</text>
  <text x="210" y="330" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="#b4520c">FICTIF</text>
</svg>`;

const SEAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="0 0 420 420">
  <defs><path id="c" d="M210,210 m-150,0 a150,150 0 1,1 300,0 a150,150 0 1,1 -300,0"/></defs>
  <circle cx="210" cy="210" r="200" fill="none" stroke="#1f3a8a" stroke-width="10" opacity="0.85"/>
  <circle cx="210" cy="210" r="120" fill="none" stroke="#1f3a8a" stroke-width="4" opacity="0.85"/>
  <text font-family="Arial, sans-serif" font-size="30" font-weight="bold" fill="#1f3a8a" opacity="0.85" letter-spacing="4"><textPath href="#c">INSTITUT DÉMO FORMATION · CACHET SPÉCIMEN ·</textPath></text>
  <text x="210" y="205" text-anchor="middle" font-family="Georgia, serif" font-size="44" font-weight="bold" fill="#1f3a8a" opacity="0.85">SPÉCIMEN</text>
  <text x="210" y="245" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="#1f3a8a" opacity="0.85">sans valeur</text>
</svg>`;

const signatureSvg = (initials: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200" viewBox="0 0 600 200">
  <path d="M30 140 C 80 40, 120 40, 140 120 S 200 170, 230 90 S 300 30, 330 110 S 400 160, 440 80 S 520 60, 570 120" fill="none" stroke="#1d3fa8" stroke-width="6" stroke-linecap="round"/>
  <text x="300" y="190" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="34" fill="#1d3fa8">${initials} — spécimen</text>
</svg>`;

async function storeImage(prisma: PrismaClient, ownerUserId: string, purpose: string, filename: string, bytes: Uint8Array) {
  const key = `${purpose.toLowerCase()}/demo/${randomBytes(8).toString("hex")}.png`;
  await storage().put(key, bytes, "image/png");
  const file = await prisma.storedFile.create({
    data: { ownerUserId, storageKey: key, filename, mimeType: "image/png", sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), visibility: "PRIVATE", purpose },
  });
  return file.id;
}

/** Institution et cosignataire de démonstration (créés une seule fois). */
export async function ensureDemoCertificateParties(prisma: PrismaClient): Promise<{ issuerId: string; tbSignatoryId: string } | null> {
  const trainerOrg = await prisma.organization.findFirst({ where: { isDemo: true, type: "TRAINING_PROVIDER" }, include: { members: { where: { role: "OWNER" }, take: 1 } } });
  const trainerId = trainerOrg?.members[0]?.userId;
  if (!trainerOrg || !trainerId) return null;
  const admin = await prisma.user.findUnique({ where: { email: "admin@demo.talentbridge.africa" } });

  let signatory = await prisma.tbSignatory.findFirst({ where: { isDemo: true, fullName: TB_NAME } });
  if (!signatory) {
    const owner = admin?.id ?? trainerId;
    signatory = await prisma.tbSignatory.create({
      data: { fullName: TB_NAME, title: "Directeur général (démo)", signatureFileId: await storeImage(prisma, owner, "CERT_SIGNATURE", "signature-tb-demo.png", await svgPng(signatureSvg("TB"))), forVerification: true, isActive: true, createdById: owner, isDemo: true },
    });
  }

  let issuer = await prisma.certificateIssuer.findFirst({ where: { isDemo: true, name: ISSUER_NAME } });
  if (!issuer) {
    issuer = await prisma.certificateIssuer.create({
      data: {
        name: ISSUER_NAME,
        tagline: "Apprendre · Démontrer · Progresser",
        organizationId: trainerOrg.id,
        createdById: trainerId,
        logoFileId: await storeImage(prisma, trainerId, "CERT_LOGO", "logo-institut-demo.png", await svgPng(LOGO_SVG)),
        sealFileId: await storeImage(prisma, trainerId, "CERT_SEAL", "cachet-institut-demo.png", await svgPng(SEAL_SVG)),
        signatureFileId: await storeImage(prisma, trainerId, "CERT_SIGNATURE", "signature-institut-demo.png", await svgPng(signatureSvg("A. D."))),
        signatoryName: "Dr A. Démo (fictive)",
        signatoryTitle: "Directrice des études",
        authorizationAttested: true,
        attestedAt: new Date(),
        status: "VALIDATED",
        reviewedById: admin?.id ?? null,
        reviewedAt: new Date(),
        reviewNote: "Institution fictive de démonstration.",
        isDemo: true,
      },
    });
  }
  return { issuerId: issuer.id, tbSignatoryId: signatory.id };
}

/** Rattache le protocole aux formations de démo, fige les certificats existants et délivre le certificat consultant de démo. */
export async function backfillDemoCertificates(prisma: PrismaClient, log = true) {
  const parties = await ensureDemoCertificateParties(prisma);
  if (!parties) return;
  await prisma.course.updateMany({ where: { isDemo: true, issuerId: null }, data: { issuerId: parties.issuerId } });
  await prisma.course.updateMany({ where: { isDemo: true, tbSignatoryId: null }, data: { tbSignatoryId: parties.tbSignatoryId } });

  const { courseSnapshot, claimExpertCertificate } = await import("../src/application/certificate.service");
  const legacy = await prisma.learningCertificate.findMany({ where: { snapshot: { equals: Prisma.DbNull }, enrollment: { course: { isDemo: true } } }, include: { enrollment: { include: { course: { include: { issuer: true, tbSignatory: true } } } } } });
  for (const cert of legacy) {
    await prisma.learningCertificate.update({ where: { id: cert.id }, data: { snapshot: courseSnapshot(cert.enrollment.course) as unknown as Prisma.InputJsonValue } });
  }

  const consultant = await prisma.user.findUnique({ where: { email: "consultant@demo.talentbridge.africa" }, include: { expertProfile: true } });
  if (consultant?.expertProfile && !(await prisma.expertCertificate.findFirst({ where: { expertId: consultant.expertProfile.id } }))) {
    const auth = await import("../src/application/auth.service");
    const user = await auth.getUserBySessionToken(await auth.createSession(consultant.id));
    await claimExpertCertificate(user!).catch((e: Error) => log && console.log(`ℹ Certificat consultant de démo non délivré : ${e.message}`));
  }
  if (log) console.log("✔ Protocole de certification de démonstration (institution et cosignataire fictifs)");
}

/**
 * Hébergement sans disque persistant : les images de démonstration (logo, cachet, signatures)
 * sont régénérées à l'identique si leur fichier a disparu du stockage. Ne touche qu'aux fichiers de démo.
 */
export async function restoreDemoFiles(prisma: PrismaClient, log = true) {
  const sources: Record<string, () => string> = {
    "logo-institut-demo.png": () => LOGO_SVG,
    "cachet-institut-demo.png": () => SEAL_SVG,
    "signature-institut-demo.png": () => signatureSvg("A. D."),
    "signature-tb-demo.png": () => signatureSvg("TB"),
  };
  const files = await prisma.storedFile.findMany({ where: { storageKey: { contains: "/demo/" }, filename: { in: Object.keys(sources) } } });
  let restored = 0;
  for (const f of files) {
    const present = await storage().get(f.storageKey).then(() => true, () => false);
    if (present) continue;
    await storage().put(f.storageKey, await svgPng(sources[f.filename]()), "image/png");
    restored++;
  }
  if (log && restored) console.log(`✔ ${restored} image(s) de démonstration restaurée(s)`);
}
