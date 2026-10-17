import { describe, expect, it } from "vitest";
import { applicationFlow, canApproveVerification, contractFlow, missionFlow, verificationFlow } from "@/domain/workflows";
import { DomainError } from "@/domain/errors";

describe("processus mission", () => {
  it("suit le cycle Brouillon → … → Clôture", () => {
    const path = ["DRAFT", "PUBLISHED", "SHORTLISTING", "INTERVIEWS", "SELECTION", "CONTRACTING", "IN_PROGRESS", "CLOSED"] as const;
    for (let i = 0; i < path.length - 1; i++) expect(missionFlow.can(path[i], path[i + 1])).toBe(true);
  });
  it("refuse les sauts et les retours depuis un état final", () => {
    expect(() => missionFlow.assert("DRAFT", "IN_PROGRESS")).toThrow(DomainError);
    expect(missionFlow.next("CLOSED")).toEqual([]);
    expect(missionFlow.can("CANCELLED", "PUBLISHED")).toBe(false);
  });
});

describe("candidatures et contrats", () => {
  it("une candidature retirée ou contractualisée est figée", () => {
    expect(applicationFlow.next("WITHDRAWN")).toEqual([]);
    expect(applicationFlow.next("CONTRACTED")).toEqual([]);
    expect(applicationFlow.can("SUBMITTED", "CONTRACTED")).toBe(false);
  });
  it("un contrat doit être signé avant d'être actif", () => {
    expect(contractFlow.can("SENT", "ACTIVE")).toBe(false);
    expect(contractFlow.can("SIGNED", "ACTIVE")).toBe(true);
  });
});

describe("vérification", () => {
  it("statuts du cahier des charges et renouvellement après expiration", () => {
    expect(verificationFlow.can("VERIFIED", "EXPIRED")).toBe(true);
    expect(verificationFlow.can("EXPIRED", "PENDING")).toBe(true);
    expect(verificationFlow.can("PENDING", "VERIFIED")).toBe(false); // jamais sans instruction
  });
  it("interdit la validation sans tous les contrôles humains requis", () => {
    expect(canApproveVerification("IDENTITY", []).ok).toBe(false);
    expect(canApproveVerification("IDENTITY", [{ step: "COMPLETENESS", result: "PASS" }]).missing).toEqual(["ADMINISTRATIVE"]);
    expect(canApproveVerification("IDENTITY", [{ step: "COMPLETENESS", result: "PASS" }, { step: "ADMINISTRATIVE", result: "FAIL" }]).ok).toBe(false);
    expect(canApproveVerification("IDENTITY", [{ step: "COMPLETENESS", result: "NOT_APPLICABLE" }, { step: "ADMINISTRATIVE", result: "PASS" }]).ok).toBe(false);
    expect(canApproveVerification("DOCUMENTS", [{ step: "COMPLETENESS", result: "PASS" }, { step: "DIPLOMAS", result: "PASS" }, { step: "REFERENCES", result: "PASS" }]).ok).toBe(true);
  });
});
