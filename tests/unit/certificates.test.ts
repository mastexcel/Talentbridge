import { describe, expect, it } from "vitest";
import { consultantCertificateCode, consultantChecks, consultantValidUntil, coursePublishBlockers, issuerMissing, type IssuerFields } from "@/domain/certificates";

const complete: IssuerFields = { name: "Institut X", logoFileId: "l", sealFileId: "s", signatoryName: "A. B.", signatoryTitle: "Directeur", signatureFileId: "g", authorizationAttested: true };
const tb = { fullName: "C. D.", title: "Directeur général", signatureFileId: "t", isActive: true };

describe("protocole de certification", () => {
  it("liste chaque élément manquant de l'institution", () => {
    expect(issuerMissing(complete)).toEqual([]);
    const m = issuerMissing({ ...complete, logoFileId: null, sealFileId: null, signatureFileId: null, authorizationAttested: false });
    expect(m).toEqual(["logo de l'institution", "cachet de l'institution", "signature du signataire de l'institution", "attestation d'autorisation d'usage du logo, du cachet et de la signature"]);
  });

  it("bloque la mise en ligne tant que l'institution n'est pas validée et qu'aucun cosignataire n'est désigné", () => {
    expect(coursePublishBlockers({ lessons: 0, issuer: null, tbSignatory: null })).toHaveLength(3);
    expect(coursePublishBlockers({ lessons: 2, issuer: { ...complete, status: "SUBMITTED" }, tbSignatory: tb })).toEqual(["Institution en attente de validation par Talent Bridge."]);
    // Séminaire / sessions datées : pas de leçon exigée, mais une session à venir
    expect(coursePublishBlockers({ lessons: 0, issuer: { ...complete, status: "VALIDATED" }, tbSignatory: tb, sessionBased: true, upcomingSessions: 0 })).toEqual(["Programmez au moins une session à venir (date, lieu ou lien, nombre de places)."]);
    expect(coursePublishBlockers({ lessons: 0, issuer: { ...complete, status: "VALIDATED" }, tbSignatory: tb, sessionBased: true, upcomingSessions: 1 })).toEqual([]);
    expect(coursePublishBlockers({ lessons: 2, issuer: { ...complete, status: "VALIDATED" }, tbSignatory: { ...tb, isActive: false } })[0]).toMatch(/n'est plus actif/);
    expect(coursePublishBlockers({ lessons: 2, issuer: { ...complete, status: "VALIDATED" }, tbSignatory: tb })).toEqual([]);
  });

  it("n'accorde le certificat consultant qu'avec identité ET documents vérifiés", () => {
    expect(consultantChecks(["IDENTITY_VERIFIED"]).eligible).toBe(false);
    const r = consultantChecks(["IDENTITY_VERIFIED", "DOCUMENTS_VERIFIED"]);
    expect(r.eligible).toBe(true);
    expect(r.checks).toEqual(["EXPERIENCE", "DIPLOMAS", "REFERENCES", "IDENTITY"]);
    expect(consultantChecks(["IDENTITY_VERIFIED", "DOCUMENTS_VERIFIED", "SKILLS_ASSESSED"]).checks).toContain("SKILLS");
  });

  it("calcule la validité et le numéro", () => {
    const issued = new Date("2026-10-15T00:00:00Z");
    expect(consultantValidUntil(issued, [new Date("2029-01-01"), null, new Date("2028-06-01")]).toISOString().slice(0, 10)).toBe("2028-06-01");
    expect(consultantValidUntil(issued, [null]).getUTCFullYear()).toBe(2029);
    expect(consultantCertificateCode(2026, 1257)).toBe("TB-CV-2026-001257");
  });
});
