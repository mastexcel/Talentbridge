import { beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { prisma } from "@/infrastructure/db";
import { uploadFile } from "@/application/file.service";
import { assignCosigner, claimExpertCertificate, findCertificate, reviewIssuer, saveIssuer, saveTbSignatory, setIssuerFile, submitIssuer } from "@/application/certificate.service";
import { setCourseStatus } from "@/application/academy.service";
import { consultantCertificatePdf } from "@/application/certificate-pdf";
import { makeAdmin, makeUser, resetDb, session } from "./helpers";

const png = async () => new Uint8Array(await sharp({ create: { width: 8, height: 8, channels: 4, background: "#7B1F2B" } }).png().toBuffer());

describe("protocole de certification", () => {
  beforeAll(resetDb);

  it("une formation ne peut être mise en ligne qu'avec une institution complète, validée par une autre personne, et un cosignataire", async () => {
    const trainer = await makeUser("TRAINING_PROVIDER");
    const course = await prisma.course.create({ data: { slug: "proto", title: "Formation protocole", summary: "Résumé", instructorId: trainer.id, modules: { create: { title: "M1", lessons: { create: { title: "L1" } } } } } });
    await expect(setCourseStatus(trainer, course.id, "PUBLISHED")).rejects.toThrow(/institution qui délivre/);

    const issuer = await saveIssuer(trainer, { courseId: course.id, name: "Université Exemple", tagline: null, signatoryName: "Pr X", signatoryTitle: "Recteur", attest: true });
    await expect(submitIssuer(trainer, issuer.id)).rejects.toThrow(/logo/);
    for (const kind of ["logo", "seal", "signature"] as const) {
      const f = await uploadFile(trainer, { filename: `${kind}.png`, bytes: await png(), purpose: kind === "logo" ? "CERT_LOGO" : kind === "seal" ? "CERT_SEAL" : "CERT_SIGNATURE" });
      await setIssuerFile(trainer, issuer.id, kind, f.id);
    }
    // Un PDF n'est pas accepté comme signature
    await expect(uploadFile(trainer, { filename: "sig.pdf", bytes: new TextEncoder().encode("%PDF-1.4"), purpose: "CERT_SIGNATURE" })).rejects.toThrow();
    expect((await submitIssuer(trainer, issuer.id)).status).toBe("SUBMITTED");
    await expect(setCourseStatus(trainer, course.id, "PUBLISHED")).rejects.toThrow(/en attente de validation/);

    // Le déclarant ne peut pas valider sa propre institution, même administrateur
    await prisma.user.update({ where: { id: trainer.id }, data: { platformRole: "ADMIN", adminPermissions: ["ACADEMY_MANAGE"] } });
    await expect(reviewIssuer(await session(trainer.id), issuer.id, true, null)).rejects.toThrow(/autre personne/);
    const reviewer = await makeAdmin(["ACADEMY_MANAGE"]);
    await expect(reviewIssuer(reviewer, issuer.id, false, null)).rejects.toThrow(/motif/);
    await reviewIssuer(reviewer, issuer.id, true, null);
    await expect(setCourseStatus(trainer, course.id, "PUBLISHED")).rejects.toThrow(/cosignataire/);

    // Cosignataire : créé par un super-administrateur uniquement, désigné par l'Academy
    const sig = await uploadFile(reviewer, { filename: "tb.png", bytes: await png(), purpose: "CERT_SIGNATURE" });
    await expect(saveTbSignatory(reviewer, { fullName: "Directeur Test", title: "DG", signatureFileId: sig.id, sealFileId: null, forVerification: true, isActive: true })).rejects.toThrow(/Permission/);
    const superAdmin = await makeAdmin(["SUPER_ADMIN"]);
    const tb = await saveTbSignatory(superAdmin, { fullName: "Directeur Test", title: "DG", signatureFileId: sig.id, sealFileId: null, forVerification: true, isActive: true });
    await assignCosigner(reviewer, course.id, tb.id);
    await setCourseStatus(trainer, course.id, "PUBLISHED");
    expect((await prisma.course.findUniqueOrThrow({ where: { id: course.id } })).status).toBe("PUBLISHED");

    // Toute modification de l'institution exige une nouvelle validation
    await saveIssuer(trainer, { issuerId: issuer.id, name: "Université Exemple", tagline: "Savoir", signatoryName: "Pr X", signatoryTitle: "Recteur", attest: true });
    expect((await prisma.certificateIssuer.findUniqueOrThrow({ where: { id: issuer.id } })).status).toBe("DRAFT");
  });

  it("certificat consultant : exige identité et documents vérifiés, numérotation continue, PDF", async () => {
    const expert = await makeUser("EXPERT");
    await expect(claimExpertCertificate(expert)).rejects.toThrow(/identité vérifiée ET/);
    const admin = await makeAdmin(["EXPERTS_VERIFY"]);
    for (const code of ["IDENTITY_VERIFIED", "DOCUMENTS_VERIFIED"]) {
      const badge = await prisma.badge.findUniqueOrThrow({ where: { code } });
      await prisma.expertBadge.create({ data: { expertId: expert.expertProfile!.id, badgeId: badge.id, awardedById: admin.id } });
    }
    const cert = await claimExpertCertificate(expert);
    expect(cert.code).toMatch(/^TB-CV-\d{4}-\d{6}$/);
    expect(cert.checks).toEqual(["EXPERIENCE", "DIPLOMAS", "REFERENCES", "IDENTITY"]);
    expect((await claimExpertCertificate(expert)).id).toBe(cert.id);
    const found = await findCertificate(cert.code.toLowerCase());
    expect(found?.type).toBe("consultant");
    const pdf = await consultantCertificatePdf(found as Extract<typeof found, { type: "consultant" }> & object);
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");
  });
});
