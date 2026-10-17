import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/db";
import { DomainError } from "@/domain/errors";
import { addDocument, decide, expireVerifications, getOrCreateRequest, recordCheck, submitRequest } from "@/application/verification.service";
import { completeExpertProfile, makeAdmin, makeUser, resetDb } from "./helpers";

describe("vérification et certification", () => {
  beforeAll(resetDb);

  it("parcours complet : dépôt → soumission → contrôles → décision → badge → expiration", async () => {
    const expert = await makeUser("EXPERT");
    const verifier = await makeAdmin(["EXPERTS_VERIFY"]);
    const outsider = await makeAdmin(["FINANCE_MANAGE"]);
    const expertId = expert.expertProfile!.id;
    const req = await getOrCreateRequest(expertId, "IDENTITY");
    const file = await prisma.storedFile.create({ data: { ownerUserId: expert.id, storageKey: "id1", filename: "cni.pdf", mimeType: "application/pdf", sizeBytes: 10, sha256: "x", purpose: "VERIFICATION" } });

    await expect(submitRequest(expert, expertId, req.id)).rejects.toThrow(/complété/); // profil incomplet
    await completeExpertProfile(expertId, ["suivi-evaluation", "enquetes", "cadre-logique"]);
    await expect(submitRequest(expert, expertId, req.id)).rejects.toThrow(/justificatif/);
    await addDocument(expert, expertId, req.id, file.id, "ID_CARD", null);
    await submitRequest(expert, expertId, req.id);

    await expect(decide(outsider, req.id, "START_REVIEW", null)).rejects.toBeInstanceOf(DomainError);
    await decide(verifier, req.id, "START_REVIEW", null);
    // Aucun badge sans contrôles humains complets
    await expect(decide(verifier, req.id, "APPROVE", null)).rejects.toThrow(/contrôles requis/);
    await recordCheck(verifier, req.id, { step: "COMPLETENESS", result: "PASS", note: null });
    await expect(decide(verifier, req.id, "APPROVE", null)).rejects.toThrow(/contrôles requis/);
    await recordCheck(verifier, req.id, { step: "ADMINISTRATIVE", result: "PASS", note: "CNI conforme" });
    await decide(verifier, req.id, "APPROVE", "OK");

    const badges = await prisma.expertBadge.findMany({ where: { expertId }, include: { badge: true } });
    expect(badges).toHaveLength(1);
    expect(badges[0].badge.code).toBe("IDENTITY_VERIFIED");
    expect(badges[0].awardedById).toBe(verifier.id);
    const events = await prisma.verificationEvent.findMany({ where: { requestId: req.id }, orderBy: { createdAt: "asc" } });
    expect(events.map((e) => e.toStatus)).toEqual(["PENDING", "IN_REVIEW", "VERIFIED"]);
    expect(await prisma.auditLog.count({ where: { entityId: req.id } })).toBeGreaterThanOrEqual(4);

    // Expiration → renouvellement
    const expired = await expireVerifications(new Date(Date.now() + 5 * 365 * 86_400_000));
    expect(expired).toBe(1);
    expect((await prisma.verificationRequest.findUniqueOrThrow({ where: { id: req.id } })).status).toBe("EXPIRED");
  });

  it("refus motivé et complément demandé", async () => {
    const expert = await makeUser("EXPERT");
    const verifier = await makeAdmin(["EXPERTS_VERIFY"]);
    await completeExpertProfile(expert.expertProfile!.id, ["audit-financier"]);
    const req = await getOrCreateRequest(expert.expertProfile!.id, "DOCUMENTS");
    const file = await prisma.storedFile.create({ data: { ownerUserId: expert.id, storageKey: "d1", filename: "dip.pdf", mimeType: "application/pdf", sizeBytes: 10, sha256: "x", purpose: "VERIFICATION" } });
    await addDocument(expert, expert.expertProfile!.id, req.id, file.id, "DIPLOMA", null);
    await submitRequest(expert, expert.expertProfile!.id, req.id);
    await expect(decide(verifier, req.id, "REQUEST_INFO", null)).rejects.toThrow(/Précisez/);
    await decide(verifier, req.id, "REQUEST_INFO", "Merci d'ajouter la copie certifiée.");
    expect((await prisma.verificationRequest.findUniqueOrThrow({ where: { id: req.id } })).status).toBe("INFO_REQUESTED");
    expect(await prisma.notification.count({ where: { userId: expert.id, type: "VERIFICATION" } })).toBe(1);
  });
});
