import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCvText, type CvReferenceData } from "@/domain/cv-parser";

const ref: CvReferenceData = {
  skills: [
    { id: "se", nameFr: "Suivi-évaluation", nameEn: "Monitoring and evaluation", synonyms: ["s e", "m e", "suivi evaluation"], domainId: "d-se" },
    { id: "gf", nameFr: "Gestion financière de projets", nameEn: "Project financial management", synonyms: [], domainId: "d-fin" },
    { id: "pm", nameFr: "Passation des marchés", nameEn: "Procurement", synonyms: ["marches publics"], domainId: "d-gouv" },
    { id: "ag", nameFr: "Agronomie", nameEn: "Agronomy", synonyms: ["agronome"], domainId: "d-agri" },
  ],
  domains: [{ id: "d-agri", nameFr: "Agriculture", nameEn: "Agriculture" }],
  countries: [{ code: "CI", nameFr: "Côte d'Ivoire", nameEn: "Côte d'Ivoire" }, { code: "SN", nameFr: "Sénégal", nameEn: "Senegal" }],
};

describe("lecture assistée du CV", () => {
  const d = parseCvText(readFileSync("tests/fixtures/cv-exemple.txt", "utf8"), ref);

  it("présentation, années d'expérience, langues et pays", () => {
    expect(d.headline).toBe("Experte en suivi-évaluation de programmes de développement");
    expect(d.bio).toMatch(/^Plus de 12 ans d'expérience/);
    expect(d.yearsExperience).toBe(12);
    expect(d.languages).toEqual(["fr", "en"]);
    expect(d.countryCode).toBe("CI");
    expect(d.contact.email).toBe("prenom.nom@example.org");
  });

  it("compétences du référentiel (noms et synonymes) et domaines déduits, sans faux positif", () => {
    expect(d.skills.map((s) => s.skillId).sort()).toEqual(["gf", "pm", "se"]);
    expect(d.domainIds.sort()).toEqual(["d-fin", "d-gouv", "d-se"]);
  });

  it("expériences : plages de dates (mois, MM/AAAA, années, « aujourd'hui ») et intitulé / employeur", () => {
    expect(d.experiences).toEqual([
      { title: "Responsable suivi-évaluation", employer: "Programme National de Nutrition", startDate: "2019-03-01", endDate: null, description: "Conception du cadre de résultats, enquêtes de référence, rapports semestriels." },
      { title: "Chargée de suivi-évaluation", employer: "ONG Santé Pour Tous", startDate: "2015-01-01", endDate: "2019-02-01", description: "Collecte de données, tableaux de bord." },
      { title: "Consultante junior", employer: "Cabinet Alpha Conseil", startDate: "2012-01-01", endDate: "2014-01-01", description: null },
    ]);
  });

  it("diplômes et certifications avec établissement et année", () => {
    expect(d.qualifications).toEqual([
      { kind: "DEGREE", title: "Master en économie du développement", institution: "Université Félix Houphouët-Boigny", year: 2011 },
      { kind: "DEGREE", title: "Licence en statistique", institution: "ENSEA Abidjan", year: 2009 },
      { kind: "CERTIFICATION", title: "PMP", institution: "Project Management Institute", year: 2018 },
    ]);
  });

  it("CV en anglais, synonyme abrégé (M&E) et années déduites des expériences", () => {
    const en = parseCvText(["John Doe", "Senior M&E Specialist", "Dakar, Senegal", "", "WORK EXPERIENCE", "Jan 2016 - Present | M&E Lead, Health Project", "2010 - 2015", "Procurement Officer", "World Bank funded project", "EDUCATION", "MSc Development Economics, University of Sussex, 2009", "LANGUAGES", "English, French"].join("\n"), ref);
    expect(en.headline).toBe("Senior M&E Specialist");
    expect(en.countryCode).toBe("SN");
    expect(en.skills.map((s) => s.skillId).sort()).toEqual(["pm", "se"]);
    expect(en.experiences.map((e) => [e.title, e.employer, e.startDate, e.endDate])).toEqual([
      ["M&E Lead", "Health Project", "2016-01-01", null],
      ["Procurement Officer", "World Bank funded project", "2010-01-01", "2015-01-01"],
    ]);
    expect(en.qualifications[0]).toMatchObject({ kind: "DEGREE", title: "MSc Development Economics", institution: "University of Sussex", year: 2009 });
    expect(en.languages.sort()).toEqual(["en", "fr"]);
    expect(en.yearsExperience).toBe(new Date().getFullYear() - 2010);
  });

  it("texte sans structure : rien d'inventé", () => {
    const empty = parseCvText("Bonjour\nCeci n'est pas un CV.\n2019", ref);
    expect(empty.experiences).toEqual([]);
    expect(empty.qualifications).toEqual([]);
    expect(empty.skills).toEqual([]);
    expect(empty.headline).toBeNull();
  });
});
