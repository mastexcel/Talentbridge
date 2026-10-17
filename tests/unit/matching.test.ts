import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS, extractSkills, normalizeWeights, proposeTeam, rankCandidates, scoreCandidate, type CandidateProfile, type MissionNeed } from "@/domain/matching";

const need: MissionNeed = {
  requirements: [
    { skillId: "se", skillName: "Suivi-évaluation", mandatory: true, minLevel: 3 },
    { skillId: "enq", skillName: "Enquêtes", mandatory: false, minLevel: 2 },
  ],
  experienceYearsMin: 8,
  domainId: "d-se",
  languages: ["fr", "en"],
  countryCode: "SN",
  workMode: "ONSITE",
  startDate: new Date("2027-01-10"),
  durationDays: 30,
  budgetMaxMinor: 6_000_000,
  currency: "XOF",
};

const base: CandidateProfile = {
  expertId: "e1",
  skills: [{ skillId: "se", level: 4, years: 10 }, { skillId: "enq", level: 3, years: 5 }],
  yearsExperience: 12,
  domainIds: ["d-se"],
  verifiedReferences: 3,
  declaredReferences: 0,
  availability: "AVAILABLE",
  blockedSlots: [],
  countryCode: "SN",
  mobility: "NATIONAL",
  mobilityCountries: [],
  remoteOk: true,
  languages: ["fr", "en"],
  dailyRateMinor: 150_000,
  rateCurrency: "XOF",
};

describe("pondérations", () => {
  it("normalise à 100 % et reprend les valeurs du cahier des charges par défaut", () => {
    const w = normalizeWeights(DEFAULT_WEIGHTS);
    expect(Object.values(w).reduce((s, v) => s + v, 0)).toBeCloseTo(100);
    expect(w.skills).toBeCloseTo(30);
    const custom = normalizeWeights({ skills: 50, experience: 50, references: 0, availability: 0, location: 0, languages: 0 });
    expect(custom.skills).toBeCloseTo(50);
    expect(normalizeWeights({ skills: -5, experience: 0, references: 0, availability: 0, location: 0, languages: 0 })).toEqual(DEFAULT_WEIGHTS);
  });
});

describe("score d'un candidat", () => {
  it("donne 100 à un profil qui coche tous les critères", () => {
    const r = scoreCandidate(need, base);
    expect(r.eligible).toBe(true);
    expect(r.score).toBe(100);
    expect(r.breakdown).toHaveLength(6);
    expect(r.breakdown.every((c) => c.explanation.length > 0)).toBe(true);
  });

  it("exclut si une compétence obligatoire manque et l'explique", () => {
    const r = scoreCandidate(need, { ...base, skills: [{ skillId: "enq", level: 5, years: 8 }] });
    expect(r.eligible).toBe(false);
    expect(r.exclusionReasons[0]).toContain("Suivi-évaluation");
    expect(r.missingSkills).toEqual(["Suivi-évaluation"]);
  });

  it("ne compte pas les références simplement déclarées", () => {
    const r = scoreCandidate(need, { ...base, verifiedReferences: 0, declaredReferences: 5 });
    expect(r.breakdown.find((c) => c.criterion === "references")!.value).toBe(0);
  });

  it("pénalise un conflit de calendrier", () => {
    const r = scoreCandidate(need, { ...base, blockedSlots: [{ start: new Date("2027-01-20"), end: new Date("2027-02-20") }] });
    expect(r.breakdown.find((c) => c.criterion === "availability")!.value).toBeLessThan(0.2);
  });

  it("exclut une mission sur site hors zone de mobilité, mais accepte la mobilité régionale", () => {
    expect(scoreCandidate(need, { ...base, countryCode: "KE", mobility: "NATIONAL" }).eligible).toBe(false);
    expect(scoreCandidate(need, { ...base, countryCode: "CI", mobility: "REGIONAL" }).eligible).toBe(true);
  });

  it("signale (sans exclure) un dépassement de budget", () => {
    const r = scoreCandidate(need, { ...base, dailyRateMinor: 400_000 });
    expect(r.overBudget).toBe(true);
    expect(r.eligible).toBe(true);
  });
});

describe("classement", () => {
  it("place les éligibles d'abord, puis par score, de façon déterministe", () => {
    const weak = { ...base, expertId: "e2", yearsExperience: 2, verifiedReferences: 0 };
    const excluded = { ...base, expertId: "e0", skills: [] };
    const ranked = rankCandidates(need, [excluded, weak, base]);
    expect(ranked.map((r) => r.expertId)).toEqual(["e1", "e2", "e0"]);
    expect(rankCandidates(need, [base, weak, excluded]).map((r) => r.expertId)).toEqual(["e1", "e2", "e0"]);
  });
});

describe("équipes", () => {
  it("n'affecte jamais deux rôles au même expert et respecte le budget", () => {
    const a = { ...base, expertId: "a", dailyRateMinor: 100_000 };
    const b = { ...base, expertId: "b", dailyRateMinor: 300_000 };
    const roles = [
      { key: "lead", label: "Chef de mission", days: 10, need },
      { key: "exp", label: "Expert", days: 10, need },
    ];
    const p = proposeTeam(roles, [a, b], 2_500_000);
    const ids = p.assignments.map((x) => x.expertId);
    expect(new Set(ids.filter(Boolean)).size).toBe(ids.filter(Boolean).length);
    expect(p.totalCostMinor).toBeLessThanOrEqual(2_500_000);
    expect(p.uncoveredRoles).toEqual(["Expert"]);
  });
});

describe("extraction des compétences", () => {
  const catalog = [
    { id: "se", nameFr: "Suivi-évaluation", nameEn: "Monitoring and evaluation", synonyms: ["suivi evaluation"] },
    { id: "eies", nameFr: "Études d'impact environnemental et social", nameEn: "ESIA", synonyms: ["eies"] },
    { id: "web", nameFr: "Développement web", nameEn: "Web development", synonyms: [] },
  ];
  it("repère les compétences par nom ou synonyme, sans accent ni casse", () => {
    const found = extractSkills("Recrutement d'un expert en SUIVI ÉVALUATION pour une EIES.", catalog).map((f) => f.id);
    expect(found.sort()).toEqual(["eies", "se"]);
  });
  it("n'invente aucune compétence absente du référentiel", () => {
    expect(extractSkills("Besoin d'un expert en blockchain quantique", catalog)).toEqual([]);
  });
});
