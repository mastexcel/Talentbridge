import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/db";
import { createSession, SESSION_COOKIE } from "@/application/auth.service";
import { POST as billing } from "@/app/api/v1/billing/[action]/route";
import { makeUser, resetDb } from "./helpers";

const ORIGIN = "http://localhost:3000";

function post(path: string, token: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, host: "localhost:3000", cookie: `${SESSION_COOKIE}=${token}`, ...headers },
    body: JSON.stringify(body),
  });
}
const ctx = (action: string) => ({ params: Promise.resolve({ action }) });

describe("API : contrôles transverses", () => {
  beforeAll(resetDb);

  it("souscription idempotente : un double envoi avec la même clé ne crée qu'une facture", async () => {
    const org = await makeUser("COMPANY");
    const token = await createSession(org.id);
    const price = await prisma.planPrice.findFirstOrThrow({ where: { plan: { code: "ORG_STANDARD" }, interval: "MONTH", currency: "XOF" } });
    const body = { priceId: price.id, method: "MOBILE_MONEY", forOrganization: true };
    const r1 = await billing(post("/api/v1/billing/subscribe", token, body, { "idempotency-key": "cle-1" }), ctx("subscribe"));
    const r2 = await billing(post("/api/v1/billing/subscribe", token, body, { "idempotency-key": "cle-1" }), ctx("subscribe"));
    expect(r1.status, JSON.stringify(await r1.clone().json())).toBe(200);
    expect(r2.headers.get("idempotent-replay")).toBe("true");
    expect(await r2.json()).toEqual(await r1.json());
    expect(await prisma.invoice.count({ where: { organizationId: org.activeOrgId! } })).toBe(1);
  });

  it("refuse une mutation d'une autre origine (CSRF) et une requête sans session", async () => {
    const org = await makeUser("COMPANY");
    const token = await createSession(org.id);
    const cross = await billing(post("/api/v1/billing/subscribe", token, {}, { origin: "https://malveillant.example" }), ctx("subscribe"));
    expect(cross.status).toBe(403);
    const anon = await billing(post("/api/v1/billing/subscribe", "jeton-invalide", {}), ctx("subscribe"));
    expect(anon.status).toBe(401);
  });

  it("le simulateur de paiement est refusé en production sans autorisation explicite", async () => {
    const { getPaymentProvider } = await import("@/infrastructure/payments/registry");
    const { env } = await import("@/infrastructure/env");
    const e = env() as { NODE_ENV: string };
    const prev = e.NODE_ENV;
    e.NODE_ENV = "production";
    try {
      expect(() => getPaymentProvider("mock")).toThrow(/pas encore activé/);
    } finally {
      e.NODE_ENV = prev;
    }
  });
});
