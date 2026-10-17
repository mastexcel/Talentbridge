import { describe, expect, it } from "vitest";
import { checkFile, sanitizeFilename } from "@/domain/files";
import { computeCompleteness } from "@/domain/profile";
import { certificateEligibility, gradeAttempt, publicQuestions } from "@/domain/academy";
import { complianceRate, extractRequirements } from "@/domain/tenders";
import { maskEmail, renderTemplate, slugify } from "@/domain/text";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

describe("validation des fichiers", () => {
  it("accepte un PDF réel", () => expect(checkFile("cv.pdf", PDF)).toMatchObject({ ok: true, mime: "application/pdf" }));
  it("refuse un contenu ne correspondant pas à l'extension", () => expect(checkFile("cv.pdf", PNG).ok).toBe(false));
  it("refuse les types non autorisés (exécutables, scripts)", () => {
    expect(checkFile("virus.exe", PDF).ok).toBe(false);
    expect(checkFile("page.html", PDF).ok).toBe(false);
    expect(checkFile("photo.png", PNG, ["pdf"]).ok).toBe(false);
  });
  it("refuse les fichiers vides ou trop volumineux", () => {
    expect(checkFile("a.pdf", new Uint8Array()).ok).toBe(false);
    expect(checkFile("a.pdf", new Uint8Array(11 * 1024 * 1024)).ok).toBe(false);
  });
  it("neutralise les chemins dans les noms", () => expect(sanitizeFilename("../../etc/passwd")).toBe("passwd"));
});

describe("complétude du profil", () => {
  it("varie de 0 à 100", () => {
    const empty = computeCompleteness({ hasPhoto: false, languages: [], domains: 0, skills: 0, experiences: 0, qualifications: 0, references: 0, portfolio: 0, hasCv: false, hasRate: false, yearsExperience: 0 });
    expect(empty.score).toBe(0);
    const full = computeCompleteness({ hasPhoto: true, headline: "Expert S&E senior", bio: "x".repeat(100), countryCode: "CI", city: "Abidjan", languages: ["fr"], domains: 1, skills: 3, experiences: 1, qualifications: 1, references: 2, portfolio: 1, hasCv: true, hasRate: true, yearsExperience: 10 });
    expect(full.score).toBe(100);
    expect(full.missing).toEqual([]);
  });
});

describe("Academy", () => {
  const qs = [{ id: "a", prompt: "?", options: ["x", "y"], answer: 1 }, { id: "b", prompt: "?", options: ["x", "y"], answer: 0 }];
  it("corrige côté serveur et ne publie jamais les réponses", () => {
    expect(gradeAttempt(qs, { a: 1, b: 1 }).scorePct).toBe(50);
    expect(publicQuestions(qs).every((q) => !("answer" in q))).toBe(true);
  });
  it("ne délivre un certificat que si les conditions sont remplies", () => {
    expect(certificateEligibility({ lessonsTotal: 4, lessonsDone: 3, hasFinal: true, bestScorePct: 90, passingScore: 70 }).eligible).toBe(false);
    expect(certificateEligibility({ lessonsTotal: 4, lessonsDone: 4, hasFinal: true, bestScorePct: 60, passingScore: 70 }).eligible).toBe(false);
    expect(certificateEligibility({ lessonsTotal: 4, lessonsDone: 4, hasFinal: true, bestScorePct: 70, passingScore: 70 }).eligible).toBe(true);
    expect(certificateEligibility({ lessonsTotal: 0, lessonsDone: 0, hasFinal: false, bestScorePct: null, passingScore: 70 }).eligible).toBe(false);
  });
});

describe("appels d'offres", () => {
  it("repère des pièces usuelles dans les TDR et calcule la conformité", () => {
    const r = extractRequirements("Le dossier comprendra le RCCM, une attestation de régularité fiscale, les CV des experts clés et l'offre financière.");
    expect(r.map((x) => x.category)).toEqual(expect.arrayContaining(["ADMINISTRATIVE", "EXPERTS", "FINANCIAL"]));
    expect(extractRequirements("Texte sans exigence identifiable.")).toEqual([]);
    expect(complianceRate([{ status: "READY" }, { status: "MISSING" }])).toBe(50);
  });
});

describe("texte", () => {
  it("slug, masquage, modèles", () => {
    expect(slugify("Évaluation Finale — Côte d'Ivoire")).toBe("evaluation-finale-cote-d-ivoire");
    expect(maskEmail("aminata@exemple.ci")).toBe("a•••@exemple.ci");
    expect(renderTemplate("Bonjour {{prenom}}, {{inconnu}}!", { prenom: "Awa" })).toBe("Bonjour Awa, !");
  });
});
