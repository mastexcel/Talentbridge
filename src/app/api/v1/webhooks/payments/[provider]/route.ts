import { NextResponse, type NextRequest } from "next/server";
import { handlePaymentWebhook } from "@/application/billing.service";
import { WebhookVerificationError } from "@/infrastructure/payments/provider";
import { logger } from "@/infrastructure/logger";
import { errorResponse } from "@/infrastructure/http/handler";

/** Webhook prestataire : corps brut lu tel quel pour la vérification de signature. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const raw = await req.text();
  try {
    return NextResponse.json(await handlePaymentWebhook(provider, raw, req.headers));
  } catch (e) {
    if (e instanceof WebhookVerificationError) {
      logger.warn("payment.webhook.rejected", { provider, reason: e.message });
      return NextResponse.json({ error: { code: "INVALID_SIGNATURE", message: e.message } }, { status: 401 });
    }
    return errorResponse(e);
  }
}
