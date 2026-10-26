/**
 * Remplissage du profil à partir du CV déposé : lecture du texte (PDF ou DOCX), propositions
 * (src/domain/cv-parser.ts), puis enregistrement des seuls éléments relus et cochés par l'expert.
 * Diplômes et certifications importés restent « déclarés » : seule la vérification Talent Bridge
 * peut les valider. Le fichier n'est lu que pour son propriétaire.
 */
import JSZip from "jszip";
import { prisma, inTransaction, type Db } from "@/infrastructure/db";
import { storage } from "@/infrastructure/storage/storage";
import { DomainError } from "@/domain/errors";
import { fold, parseCvText, type CvDraft } from "@/domain/cv-parser";
import type { SessionUser } from "./auth.service";
import type { CvImportInput } from "./schemas";
import { audit } from "./audit.service";
import { recomputeCompleteness } from "./expert.service";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Texte d'un DOCX : un paragraphe par ligne, sauts de ligne et tabulations conservés. */
async function docxText(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) return "";
  return xml
    .split(/<\/w:p>/)
    .map((p) =>
      p
        .replace(/<w:tab\/>/g, " ")
        .replace(/<w:br\/>/g, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'"),
    )
    .join("\n");
}

/** Texte d'un PDF, ligne par ligne (les PDF scannés n'ont pas de texte). */
async function pdfText(bytes: Uint8Array): Promise<string> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const pages: string[] = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 15); i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    let page = "";
    for (const item of content.items as { str?: string; hasEOL?: boolean }[]) {
      if (typeof item.str !== "string") continue;
      page += item.str + (item.hasEOL ? "\n" : "");
    }
    pages.push(page);
  }
  await pdf.cleanup();
  return pages.join("\n");
}

export async function readCvText(bytes: Uint8Array, mimeType: string): Promise<string> {
  if (mimeType === "application/pdf") return pdfText(bytes);
  if (mimeType === DOCX) return docxText(bytes);
  throw new DomainError("VALIDATION", "Format de CV non pris en charge (PDF ou DOCX).");
}

/** Propositions pour le profil, à partir du CV enregistré (rien n'est modifié). */
export async function cvDraftForExpert(user: SessionUser, expertId: string, db: Db = prisma): Promise<{ draft: CvDraft; fileName: string; already: { skills: number; experiences: number; qualifications: number } }> {
  const profile = await db.expertProfile.findUniqueOrThrow({
    where: { id: expertId },
    include: { skills: true, experiences: true, qualifications: true },
  });
  if (!profile.cvFileId) throw new DomainError("INVALID_STATE", "Déposez d'abord votre CV (PDF ou DOCX).");
  const file = await db.storedFile.findUnique({ where: { id: profile.cvFileId } });
  if (!file || file.ownerUserId !== user.id) throw new DomainError("FORBIDDEN", "CV introuvable.");
  let text = "";
  try {
    text = await readCvText(await storage().get(file.storageKey), file.mimeType);
  } catch (e) {
    if (e instanceof DomainError) throw e;
    throw new DomainError("INVALID_STATE", "Le CV n'a pas pu être lu. Vérifiez qu'il s'agit d'un PDF ou d'un DOCX non protégé.");
  }
  if (text.replace(/\s/g, "").length < 80) {
    throw new DomainError("INVALID_STATE", "Aucun texte lisible dans ce CV (document scanné ou image). Déposez une version PDF ou Word issue d'un traitement de texte, ou complétez votre profil manuellement.");
  }
  const [skills, domains, countries] = await Promise.all([
    db.skill.findMany({ where: { isActive: true }, select: { id: true, nameFr: true, nameEn: true, synonyms: true, domainId: true } }),
    db.expertiseDomain.findMany({ where: { isActive: true }, select: { id: true, nameFr: true, nameEn: true } }),
    db.country.findMany({ where: { isActive: true }, select: { code: true, nameFr: true, nameEn: true } }),
  ]);
  const draft = parseCvText(text, { skills, domains, countries });

  // On ne propose pas ce qui figure déjà au profil.
  const key = (...p: (string | number | null | undefined)[]) => p.map((x) => fold(String(x ?? ""))).join("|");
  const haveSkills = new Set(profile.skills.map((s) => s.skillId));
  const haveExp = new Set(profile.experiences.map((e) => key(e.title, e.employer, e.startDate.toISOString().slice(0, 7))));
  const haveQual = new Set(profile.qualifications.map((q) => key(q.title, q.year)));
  const before = { skills: draft.skills.length, experiences: draft.experiences.length, qualifications: draft.qualifications.length };
  draft.skills = draft.skills.filter((s) => !haveSkills.has(s.skillId));
  draft.experiences = draft.experiences.filter((e) => !haveExp.has(key(e.title, e.employer, e.startDate.slice(0, 7))));
  draft.qualifications = draft.qualifications.filter((q) => !haveQual.has(key(q.title, q.year)));
  return {
    draft,
    fileName: file.filename,
    already: { skills: before.skills - draft.skills.length, experiences: before.experiences - draft.experiences.length, qualifications: before.qualifications - draft.qualifications.length },
  };
}

/** Enregistre les éléments choisis : champs remplacés seulement s'ils sont cochés, listes complétées sans doublon. */
export async function applyCvImport(user: SessionUser, expertId: string, input: CvImportInput, db: Db = prisma) {
  const [skillsOk, domainsOk] = await Promise.all([
    input.skills.length ? db.skill.count({ where: { id: { in: input.skills.map((s) => s.skillId) }, isActive: true } }) : 0,
    input.domainIds.length ? db.expertiseDomain.count({ where: { id: { in: input.domainIds }, isActive: true } }) : 0,
  ]);
  if (skillsOk !== new Set(input.skills.map((s) => s.skillId)).size || domainsOk !== new Set(input.domainIds).size) throw new DomainError("VALIDATION", "Compétence ou domaine inconnu du référentiel.");
  if (input.countryCode && !(await db.country.findUnique({ where: { code: input.countryCode } }))) throw new DomainError("VALIDATION", "Pays inconnu.");

  const counts = await inTransaction(db, async (tx) => {
    const p = await tx.expertProfile.findUniqueOrThrow({ where: { id: expertId }, include: { experiences: true, qualifications: true } });
    await tx.expertProfile.update({
      where: { id: expertId },
      data: {
        ...(input.headline ? { headline: input.headline } : {}),
        ...(input.bio ? { bio: input.bio } : {}),
        ...(input.yearsExperience != null ? { yearsExperience: input.yearsExperience } : {}),
        ...(input.countryCode ? { countryCode: input.countryCode } : {}),
        ...(input.languages.length ? { languages: [...new Set([...p.languages, ...input.languages])] } : {}),
      },
    });
    if (input.domainIds.length) await tx.expertDomain.createMany({ data: input.domainIds.map((domainId) => ({ expertId, domainId })), skipDuplicates: true });
    if (input.skills.length) await tx.expertSkill.createMany({ data: input.skills.map((s) => ({ expertId, ...s })), skipDuplicates: true });

    const expKey = (t: string, e: string, d: Date) => `${fold(t)}|${fold(e)}|${d.toISOString().slice(0, 7)}`;
    const haveExp = new Set(p.experiences.map((e) => expKey(e.title, e.employer, e.startDate)));
    const experiences = input.experiences.filter((e) => !haveExp.has(expKey(e.title, e.employer, e.startDate)));
    if (experiences.length) await tx.professionalExperience.createMany({ data: experiences.map((e) => ({ expertId, ...e })) });

    const haveQual = new Set(p.qualifications.map((q) => `${fold(q.title)}|${q.year ?? ""}`));
    const qualifications = input.qualifications.filter((q) => !haveQual.has(`${fold(q.title)}|${q.year ?? ""}`));
    // Toujours « déclarés » : seule la vérification administrative peut les valider.
    if (qualifications.length) await tx.qualification.createMany({ data: qualifications.map((q) => ({ expertId, ...q, status: "DECLARED" as const })) });

    const c = { skills: input.skills.length, domains: input.domainIds.length, experiences: experiences.length, qualifications: qualifications.length };
    await audit({ actorId: user.id, action: "profile.cv_import", entityType: "ExpertProfile", entityId: expertId, metadata: c }, tx);
    return c;
  });
  const completeness = await recomputeCompleteness(expertId, db);
  return { ...counts, completeness, redirectUrl: "/espace/profil?import=1" };
}
