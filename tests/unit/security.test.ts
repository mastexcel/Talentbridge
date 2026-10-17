import { describe, expect, it } from "vitest";
import { signPayload, verifySignature } from "@/infrastructure/payments/signature";
import { presignVirtualHosted } from "@/infrastructure/storage/s3-sign";
import { MockPaymentProvider } from "@/infrastructure/payments/mock-provider";
import { signFileLink, verifyFileLink } from "@/application/file.service";

describe("signature des webhooks", () => {
  const secret = "s3cr3t-webhook";
  it("valide une signature correcte et récente", () => {
    const body = '{"a":1}';
    expect(() => verifySignature(secret, body, signPayload(secret, body))).not.toThrow();
  });
  it("refuse signature altérée, corps modifié, absente ou rejouée", () => {
    const body = '{"a":1}';
    const h = signPayload(secret, body);
    expect(() => verifySignature(secret, '{"a":2}', h)).toThrow();
    expect(() => verifySignature("autre", body, h)).toThrow();
    expect(() => verifySignature(secret, body, null)).toThrow();
    expect(() => verifySignature(secret, body, signPayload(secret, body, Date.now() - 10 * 60_000))).toThrow(/expiré/);
  });
  it("le prestataire simulé décode uniquement des webhooks signés", async () => {
    const p = new MockPaymentProvider(secret);
    const hook = p.buildWebhook({ reference: "mock_x", status: "SUCCEEDED", amountMinor: 1000, currency: "XOF" });
    await expect(p.parseWebhook(hook.body, hook.headers)).resolves.toMatchObject({ status: "SUCCEEDED", amountMinor: 1000 });
    await expect(p.parseWebhook(hook.body.replace("1000", "1"), hook.headers)).rejects.toThrow();
  });
});

describe("URL pré-signées S3 (SigV4)", () => {
  it("reproduit le vecteur de test officiel AWS", () => {
    // Exemple de la documentation AWS « Authenticating Requests: Using Query Parameters ».
    const sig = presignVirtualHosted({ region: "us-east-1", bucket: "examplebucket", accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" }, "test.txt", 86400, new Date("2013-05-24T00:00:00Z"));
    expect(sig).toBe("aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404");
  });
});

describe("liens temporaires de documents", () => {
  it("expirent et sont liés au document", () => {
    const now = Date.now();
    const u = new URL(signFileLink("file1", 600, now), "http://x");
    expect(verifyFileLink("file1", u.searchParams.get("e"), u.searchParams.get("s"), now)).toBe(true);
    expect(verifyFileLink("file2", u.searchParams.get("e"), u.searchParams.get("s"), now)).toBe(false);
    expect(verifyFileLink("file1", u.searchParams.get("e"), u.searchParams.get("s"), now + 601_000)).toBe(false);
  });
});
