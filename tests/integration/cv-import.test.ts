import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/db";
import { uploadFile } from "@/application/file.service";
import { setProfileFile } from "@/application/expert.service";
import { applyCvImport, cvDraftForExpert, readCvText } from "@/application/cv-import.service";
import { cvImportSchema } from "@/application/schemas";
import { makeUser, resetDb } from "./helpers";

const CV = readFileSync("tests/fixtures/cv-exemple.txt", "utf8");
const lines = CV.split("\n");

async function pdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let page = doc.addPage([595, 842]);
  let y = 800;
  for (const l of lines) {
    if (y < 40) { page = doc.addPage([595, 842]); y = 800; }
    page.drawText(l.replace(/—/g, "-"), { x: 40, y, size: 10, font });
    y -= 14;
  }
  return doc.save();
}

async function docx(): Promise<Uint8Array> {
  const zip = new JSZip();
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  zip.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${lines.map((l) => `<w:p><w:r><w:t xml:space="preserve">${esc(l)}</w:t></w:r></w:p>`).join("")}</w:body></w:document>`);
  return zip.generateAsync({ type: "uint8array" });
}

describe("remplissage du profil depuis le CV", () => {
  beforeAll(resetDb);

  it("lit le texte d'un PDF et d'un DOCX ligne par ligne", async () => {
    for (const [bytes, mime] of [[await pdf(), "application/pdf"], [await docx(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]] as const) {
      const text = await readCvText(bytes, mime);
      expect(text).toContain("EXPÉRIENCES PROFESSIONNELLES");
      expect(text.split("\n").some((l) => l.trim() === "Chargée de suivi-évaluation")).toBe(true);
    }
  });

  it("propose, n'enregistre que la sélection relue, en « déclaré », sans doublon ; CV d'autrui inaccessible", async () => {
    const expert = await makeUser("EXPERT");
    const expertId = expert.expertProfile!.id;
    const file = await uploadFile(expert, { filename: "cv.pdf", bytes: await pdf(), purpose: "CV" });
    await setProfileFile(expert, expertId, "cvFileId", file.id);

    const { draft } = await cvDraftForExpert(expert, expertId);
    expect(draft.experiences).toHaveLength(3);
    expect(draft.qualifications.map((q) => q.title)).toContain("Master en économie du développement");
    expect(draft.skills.map((s) => s.name)).toEqual(expect.arrayContaining(["Suivi-évaluation", "Passation des marchés"]));
    // Rien n'est encore enregistré
    expect(await prisma.professionalExperience.count({ where: { expertId } })).toBe(0);

    // L'expert garde 2 expériences, le Master et une compétence
    const input = cvImportSchema.parse({
      headline: draft.headline,
      yearsExperience: draft.yearsExperience,
      languages: draft.languages,
      domainIds: [],
      skills: [{ skillId: draft.skills[0].skillId, level: 4, years: 10 }],
      experiences: draft.experiences.slice(0, 2),
      qualifications: draft.qualifications.filter((q) => q.kind === "DEGREE").slice(0, 1),
    });
    const r = await applyCvImport(expert, expertId, input);
    expect(r).toMatchObject({ experiences: 2, qualifications: 1, skills: 1 });
    const profile = await prisma.expertProfile.findUniqueOrThrow({ where: { id: expertId }, include: { experiences: true, qualifications: true, skills: true } });
    expect(profile.headline).toBe(draft.headline);
    expect(profile.yearsExperience).toBe(12);
    expect(profile.qualifications.every((q) => q.status === "DECLARED")).toBe(true);
    expect(profile.skills[0]).toMatchObject({ level: 4, years: 10 });
    expect(profile.bio).toBeNull(); // non cochée : non modifiée

    // Deuxième passage : les éléments déjà au profil ne sont ni reproposés ni dupliqués
    const again = await cvDraftForExpert(expert, expertId);
    expect(again.draft.experiences).toHaveLength(1);
    expect(again.already.experiences).toBe(2);
    await applyCvImport(expert, expertId, input);
    expect(await prisma.professionalExperience.count({ where: { expertId } })).toBe(2);
    expect(await prisma.qualification.count({ where: { expertId } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "profile.cv_import", entityId: expertId } })).toBe(2);

    // Un autre utilisateur ne peut pas faire lire ce CV
    const other = await makeUser("EXPERT");
    await prisma.expertProfile.update({ where: { id: other.expertProfile!.id }, data: { cvFileId: file.id } });
    await expect(cvDraftForExpert(other, other.expertProfile!.id)).rejects.toThrow(/introuvable/);
  });

  it("CV sans texte (scanné) : message clair, rien de proposé", async () => {
    const expert = await makeUser("EXPERT");
    const blank = await PDFDocument.create();
    blank.addPage();
    const file = await uploadFile(expert, { filename: "scan.pdf", bytes: await blank.save(), purpose: "CV" });
    await setProfileFile(expert, expert.expertProfile!.id, "cvFileId", file.id);
    await expect(cvDraftForExpert(expert, expert.expertProfile!.id)).rejects.toThrow(/scanné/);
  });
});
