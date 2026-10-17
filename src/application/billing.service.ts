/**
 * Offres, abonnements, factures, paiements, remboursements, commissions.
 *
 * Règles impératives :
 *  - aucun tarif dans le code : tout vient de subscription_plans / plan_prices (administrables) ;
 *  - une facture reçoit un numéro continu à l'émission (invoice_sequences, verrou par ligne) ;
 *  - un paiement ne passe à SUCCEEDED que via un webhook signé vérifié (montant et devise contrôlés)
 *    ou un rapprochement manuel de virement par la finance (journalisé) ;
 *  - les webhooks sont idempotents (payment_events unique par prestataire + identifiant d'événement).
 */
import type { Prisma } from "@prisma/client";
import { prisma, inTransaction, type Db } from "@/infrastructure/db";
import { providerForMethod, getPaymentProvider } from "@/infrastructure/payments/registry";
import type { PaymentMethod } from "@/infrastructure/payments/provider";
import { env } from "@/infrastructure/env";
import { logger } from "@/infrastructure/logger";
import { DomainError } from "@/domain/errors";
import { addInterval, formatInvoiceNumber, invoiceStatusAfterPayment, prorationCreditMinor, reminderDue } from "@/domain/billing";
import { couponDiscount, formatMoney, invoiceTotals } from "@/domain/money";
import type { SessionUser } from "./auth.service";
import { requireAdmin, requireOrgPermission } from "./access";
import { audit } from "./audit.service";
import { notify } from "./notification.service";
import { getSetting } from "./settings.service";

// ── Catalogue ────────────────────────────────────────────────

export async function listPublicPlans(filter: { audience?: "EXPERT" | "ORGANIZATION"; currency?: string } = {}, db: Db = prisma) {
  return db.subscriptionPlan.findMany({
    where: { isActive: true, isPublic: true, ...(filter.audience ? { audience: filter.audience } : {}) },
    orderBy: [{ audience: "asc" }, { sortOrder: "asc" }],
    include: {
      prices: { where: { isActive: true, ...(filter.currency ? { currency: filter.currency } : {}) }, orderBy: { amountMinor: "asc" } },
      features: { include: { feature: true } },
    },
  });
}

type Holder = { userId: string; organizationId: null } | { userId: null; organizationId: string };

function holderWhere(h: Holder): Prisma.SubscriptionWhereInput {
  return h.organizationId ? { organizationId: h.organizationId } : { userId: h.userId! };
}

export async function activeSubscriptions(h: Holder, db: Db = prisma) {
  return db.subscription.findMany({ where: { ...holderWhere(h), status: { in: ["ACTIVE", "PAST_DUE"] } }, include: { plan: { include: { features: { include: { feature: true } } } }, price: true } });
}

/**
 * Limite d'une fonctionnalité pour un titulaire : null = illimité, 0 = non incluse.
 * Sans abonnement actif, on applique le plan public gratuit de l'audience (s'il existe).
 */
export async function featureLimit(h: Holder, featureCode: string, db: Db = prisma): Promise<number | null> {
  const subs = await activeSubscriptions(h, db);
  const plans = subs.map((s) => s.plan);
  if (plans.length === 0) {
    const free = await db.subscriptionPlan.findFirst({
      where: { audience: h.organizationId ? "ORGANIZATION" : "EXPERT", isActive: true, prices: { some: { amountMinor: 0, isActive: true } } },
      include: { features: { include: { feature: true } } },
      orderBy: { sortOrder: "asc" },
    });
    if (free) plans.push(free);
  }
  let best: number | null = 0;
  for (const p of plans) {
    const f = p.features.find((x) => x.feature.code === featureCode);
    if (!f) continue;
    if (f.limit === null) return null;
    best = Math.max(best ?? 0, f.limit);
  }
  return best;
}

export async function assertFeature(h: Holder, featureCode: string, currentUsage: number, label: string, db: Db = prisma) {
  const limit = await featureLimit(h, featureCode, db);
  if (limit !== null && currentUsage >= limit) {
    throw new DomainError("PLAN_LIMIT", limit === 0 ? `${label} : fonctionnalité non incluse dans votre offre.` : `${label} : limite de votre offre atteinte (${limit}). Passez à une offre supérieure.`, { featureCode, limit });
  }
}

// ── Factures ─────────────────────────────────────────────────

async function sellerSnapshot(db: Db) {
  return (await getSetting("seller.identity", db)) as unknown as Prisma.InputJsonValue;
}

async function buyerSnapshot(h: Holder, db: Db) {
  if (h.organizationId) {
    const o = await db.organization.findUniqueOrThrow({ where: { id: h.organizationId } });
    return { name: o.name, address: o.address, countryCode: o.countryCode, registrationNumber: o.registrationNumber, taxId: o.taxId, email: o.contactEmail };
  }
  const u = await db.user.findUniqueOrThrow({ where: { id: h.userId! }, include: { expertProfile: { select: { countryCode: true, city: true } } } });
  return { name: `${u.firstName} ${u.lastName}`, email: u.email, countryCode: u.expertProfile?.countryCode ?? null, address: u.expertProfile?.city ?? null };
}

/** Taux de TVA par défaut du pays de l'acheteur (configurable dans tax_rates). */
export async function defaultTaxBps(countryCode: string | null | undefined, db: Db = prisma): Promise<number> {
  if (!countryCode) return 0;
  const rate = await db.taxRate.findFirst({ where: { countryCode, isDefault: true, isActive: true } });
  return rate?.rateBps ?? 0;
}

/** Attribution atomique du prochain numéro (verrou de ligne via UPDATE … RETURNING). */
async function nextInvoiceNumber(tx: Prisma.TransactionClient, prefix: string, year: number): Promise<string> {
  await tx.invoiceSequence.upsert({ where: { prefix_year: { prefix, year } }, create: { prefix, year, lastNumber: 0 }, update: {} });
  const seq = await tx.invoiceSequence.update({ where: { prefix_year: { prefix, year } }, data: { lastNumber: { increment: 1 } } });
  return formatInvoiceNumber(prefix, year, seq.lastNumber);
}

export async function createAndIssueInvoice(
  input: { holder: Holder; currency: string; serviceCode: string; subscriptionId?: string | null; lines: { description: string; quantity: number; unitPriceMinor: number; taxRateBps: number }[]; notes?: string | null; isDemo?: boolean },
  db: Db = prisma,
) {
  if (input.lines.length === 0) throw new DomainError("VALIDATION", "Facture sans ligne.");
  return inTransaction(db, async (tx) => {
    const totals = invoiceTotals(input.lines);
    const buyer = await buyerSnapshot(input.holder, tx);
    const termDays = await getSetting("invoice.paymentTermDays", tx);
    const prefix = await getSetting("invoice.prefix", tx);
    const now = new Date();
    return tx.invoice.create({
      data: {
        number: await nextInvoiceNumber(tx, prefix, now.getUTCFullYear()),
        organizationId: input.holder.organizationId,
        userId: input.holder.userId,
        subscriptionId: input.subscriptionId ?? null,
        status: totals.totalMinor === 0 ? "PAID" : "ISSUED",
        currency: input.currency,
        subtotalMinor: totals.subtotalMinor,
        taxMinor: totals.taxMinor,
        totalMinor: totals.totalMinor,
        serviceCode: input.serviceCode,
        buyerSnapshot: buyer as Prisma.InputJsonValue,
        sellerSnapshot: await sellerSnapshot(tx),
        countryCode: (buyer.countryCode as string | null) ?? null,
        notes: input.notes ?? null,
        issuedAt: now,
        dueAt: new Date(now.getTime() + termDays * 86_400_000),
        paidAt: totals.totalMinor === 0 ? now : null,
        isDemo: input.isDemo ?? false,
        lines: { create: totals.lines.map((l, i) => ({ description: input.lines[i].description, quantity: l.quantity, unitPriceMinor: l.unitPriceMinor, taxRateBps: l.taxRateBps, totalMinor: l.totalMinor })) },
      },
      include: { lines: true },
    });
  });
}

function assertInvoiceAccess(user: SessionUser, invoice: { userId: string | null; organizationId: string | null }) {
  if (invoice.userId === user.id) return;
  if (invoice.organizationId) {
    try {
      requireOrgPermission(user, invoice.organizationId, "billing.manage");
      return;
    } catch {
      /* contrôle admin ci-dessous */
    }
  }
  requireAdmin(user, "FINANCE_MANAGE");
}

export async function getInvoice(user: SessionUser, invoiceId: string, db: Db = prisma) {
  const inv = await db.invoice.findUnique({ where: { id: invoiceId }, include: { lines: true, payments: { orderBy: { createdAt: "desc" }, include: { refunds: true } } } });
  if (!inv) throw new DomainError("NOT_FOUND", "Facture introuvable.");
  assertInvoiceAccess(user, inv);
  return inv;
}

export async function listInvoices(h: Holder, db: Db = prisma) {
  return db.invoice.findMany({ where: h.organizationId ? { organizationId: h.organizationId } : { userId: h.userId! }, orderBy: { createdAt: "desc" }, take: 100 });
}

// ── Souscription ─────────────────────────────────────────────

export async function subscribe(user: SessionUser, input: { priceId: string; couponCode: string | null; method: PaymentMethod; payerPhone: string | null; forOrganization: boolean }, db: Db = prisma) {
  const price = await db.planPrice.findUnique({ where: { id: input.priceId }, include: { plan: true } });
  if (!price || !price.isActive || !price.plan.isActive) throw new DomainError("NOT_FOUND", "Offre indisponible.");
  let holder: Holder;
  if (price.plan.audience === "ORGANIZATION") {
    const { organizationId } = requireOrgPermission(user, user.activeOrgId, "billing.manage");
    holder = { userId: null, organizationId };
  } else {
    if (!user.expertProfile) throw new DomainError("FORBIDDEN", "Cette offre est réservée aux consultants.");
    holder = { userId: user.id, organizationId: null };
  }
  if (price.plan.isRecurring) {
    const current = await db.subscription.findFirst({ where: { ...holderWhere(holder), planId: price.planId, status: { in: ["ACTIVE", "PENDING_PAYMENT", "PAST_DUE"] } } });
    if (current) throw new DomainError("CONFLICT", current.status === "PENDING_PAYMENT" ? "Une souscription à cette offre attend déjà son paiement." : "Vous êtes déjà abonné(e) à cette offre.");
  }

  let coupon = null;
  if (input.couponCode) {
    coupon = await db.coupon.findUnique({ where: { code: input.couponCode.toUpperCase() } });
    const valid = coupon && coupon.isActive && (!coupon.validUntil || coupon.validUntil > new Date()) && (!coupon.maxRedemptions || coupon.redemptions < coupon.maxRedemptions) && (!coupon.amountOffMinor || coupon.currency === price.currency);
    if (!valid) throw new DomainError("VALIDATION", "Code promotionnel invalide ou expiré.");
  }
  const discount = coupon ? couponDiscount(price.amountMinor, coupon) : 0;
  const buyerCountry = holder.organizationId ? (await db.organization.findUniqueOrThrow({ where: { id: holder.organizationId } })).countryCode : user.expertProfile ? (await db.expertProfile.findUnique({ where: { id: user.expertProfile.id } }))?.countryCode : null;
  const taxBps = await defaultTaxBps(buyerCountry, db);

  const { subscription, invoice } = await inTransaction(db, async (tx) => {
    const subscription = await tx.subscription.create({ data: { planId: price.planId, priceId: price.id, userId: holder.userId, organizationId: holder.organizationId, couponId: coupon?.id ?? null } });
    if (coupon) await tx.coupon.update({ where: { id: coupon.id }, data: { redemptions: { increment: 1 } } });
    const periodLabel = price.interval === "MONTH" ? " — 1 mois" : price.interval === "YEAR" ? " — 1 an" : "";
    const invoice = await createAndIssueInvoice(
      {
        holder,
        currency: price.currency,
        serviceCode: price.plan.isRecurring ? "SUBSCRIPTION" : serviceCodeFor(price.plan.code),
        subscriptionId: subscription.id,
        lines: [{ description: `${price.plan.name}${periodLabel}${discount ? ` (remise ${coupon!.code} : ${formatMoney(discount, price.currency)})` : ""}`, quantity: 1, unitPriceMinor: price.amountMinor - discount, taxRateBps: taxBps }],
      },
      tx,
    );
    await audit({ actorId: user.id, organizationId: holder.organizationId, action: "subscription.create", entityType: "Subscription", entityId: subscription.id, metadata: { plan: price.plan.code, invoice: invoice.number } }, tx);
    return { subscription, invoice };
  });

  if (invoice.totalMinor === 0) {
    await activateSubscription(subscription.id, db);
    return { subscriptionId: subscription.id, invoiceId: invoice.id, redirectUrl: "/facturation?ok=1" };
  }
  const pay = await startPayment(user, invoice.id, input.method, input.payerPhone, db);
  return { subscriptionId: subscription.id, invoiceId: invoice.id, ...pay };
}

function serviceCodeFor(planCode: string): string {
  if (planCode.includes("CERTIF")) return "CERTIFICATION";
  if (planCode.includes("SOURCING")) return "SOURCING";
  if (planCode.includes("TENDER") || planCode.includes("AO")) return "TENDER_SUPPORT";
  if (planCode.includes("TEAM") || planCode.includes("EQUIPE")) return "TEAM_BUILDING";
  if (planCode.includes("FORMATION") || planCode.includes("TRAINING")) return "TRAINING";
  return "SUBSCRIPTION";
}

/** Crée un paiement en attente auprès du prestataire et renvoie l'URL de paiement hébergée. */
export async function startPayment(user: SessionUser, invoiceId: string, method: PaymentMethod, payerPhone: string | null, db: Db = prisma) {
  const inv = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) throw new DomainError("NOT_FOUND", "Facture introuvable.");
  assertInvoiceAccess(user, inv);
  if (!["ISSUED", "PARTIALLY_PAID"].includes(inv.status)) throw new DomainError("INVALID_STATE", "Cette facture n'est pas à régler.");
  const due = inv.totalMinor - inv.paidMinor;
  const provider = providerForMethod(method);
  if (!provider.methods.includes(method)) throw new DomainError("PAYMENT_ERROR", "Moyen de paiement non disponible.");
  const payment = await db.payment.create({ data: { invoiceId, provider: provider.name, method, amountMinor: due, currency: inv.currency, isTest: provider.isTest, payerPhone, createdById: user.id } });
  try {
    const charge = await provider.createCharge({
      paymentId: payment.id,
      amountMinor: due,
      currency: inv.currency,
      method,
      payerPhone,
      description: `Facture ${inv.number}`,
      returnUrl: `/facturation/factures/${inv.id}`,
      notifyUrl: `${env().APP_URL}/api/v1/webhooks/payments/${provider.name}`,
    });
    await db.payment.update({ where: { id: payment.id }, data: { providerRef: charge.providerRef } });
    await audit({ actorId: user.id, organizationId: inv.organizationId, action: "payment.start", entityType: "Payment", entityId: payment.id, metadata: { provider: provider.name, method, amount: due } }, db);
    return { paymentId: payment.id, redirectUrl: charge.redirectUrl, instructions: charge.instructions ?? null };
  } catch (e) {
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: (e as Error).message.slice(0, 300) } });
    throw new DomainError("PAYMENT_ERROR", "Le prestataire de paiement est indisponible. Réessayez plus tard.");
  }
}

/** Application d'un paiement confirmé (webhook vérifié ou rapprochement manuel). */
async function applySucceededPayment(paymentId: string, tx: Prisma.TransactionClient) {
  // Mise à jour conditionnelle : un paiement n'est confirmé qu'une fois.
  const res = await tx.payment.updateMany({ where: { id: paymentId, status: "PENDING" }, data: { status: "SUCCEEDED", confirmedAt: new Date() } });
  if (res.count === 0) return false;
  const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
  const inv = await tx.invoice.update({ where: { id: payment.invoiceId }, data: { paidMinor: { increment: payment.amountMinor } } });
  const status = invoiceStatusAfterPayment(inv.totalMinor, inv.paidMinor);
  await tx.invoice.update({ where: { id: inv.id }, data: { status, ...(status === "PAID" ? { paidAt: new Date() } : {}) } });
  if (status === "PAID" && inv.subscriptionId) await activateSubscription(inv.subscriptionId, tx);
  const recipients = inv.userId ? [inv.userId] : (await tx.organizationMember.findMany({ where: { organizationId: inv.organizationId!, role: { in: ["OWNER", "ADMIN"] } } })).map((m) => m.userId);
  for (const uid of recipients) {
    await notify({ userId: uid, type: "PAYMENT", title: "Paiement reçu", body: `Paiement de ${formatMoney(payment.amountMinor, payment.currency)} reçu pour la facture ${inv.number}.${payment.isTest ? " (paiement de TEST, aucun encaissement réel)" : ""}`, link: `/facturation/factures/${inv.id}` }, tx);
  }
  return true;
}

/** Active (ou prolonge en cas de renouvellement) une souscription dont la facture est payée. */
export async function activateSubscription(subscriptionId: string, db: Db = prisma) {
  const sub = await db.subscription.findUniqueOrThrow({ where: { id: subscriptionId }, include: { price: true, plan: true } });
  const renewal = sub.status === "PAST_DUE" || (sub.status === "ACTIVE" && !!sub.currentPeriodEnd);
  const start = renewal && sub.currentPeriodEnd ? sub.currentPeriodEnd : new Date();
  const end = addInterval(start, sub.price.interval);
  await db.subscription.update({
    where: { id: subscriptionId },
    data: { status: "ACTIVE", currentPeriodStart: start, currentPeriodEnd: end, ...(renewal ? { renewalCount: { increment: 1 } } : {}) },
  });
  // Changement de plan : l'ancien abonnement du même titulaire et de la même audience est clôturé.
  if (!renewal && sub.plan.isRecurring) {
    await db.subscription.updateMany({
      where: { id: { not: sub.id }, status: { in: ["ACTIVE", "PAST_DUE"] }, plan: { audience: sub.plan.audience, isRecurring: true }, ...(sub.organizationId ? { organizationId: sub.organizationId } : { userId: sub.userId }) },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
  }
}

/** Webhook prestataire : signature vérifiée par l'adaptateur, idempotence, contrôle montant/devise. */
export async function handlePaymentWebhook(providerName: string, rawBody: string, headers: Headers, db: Db = prisma) {
  const provider = getPaymentProvider(providerName);
  const event = await provider.parseWebhook(rawBody, headers); // lève si signature invalide
  return inTransaction(db, async (tx) => {
    const payment = await tx.payment.findUnique({ where: { providerRef: event.providerRef } });
    try {
      await tx.paymentEvent.create({ data: { provider: provider.name, eventId: event.eventId, paymentId: payment?.id ?? null, status: event.status, payload: event.sanitized as Prisma.InputJsonValue } });
    } catch {
      return { duplicate: true }; // événement déjà traité
    }
    if (!payment) {
      logger.warn("payment.webhook.unknown_reference", { provider: provider.name, ref: event.providerRef });
      return { ignored: true };
    }
    if (event.status === "SUCCEEDED") {
      if (event.amountMinor !== payment.amountMinor || event.currency !== payment.currency) {
        await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: "Montant ou devise non concordant avec le paiement attendu." } });
        await audit({ action: "payment.mismatch", entityType: "Payment", entityId: payment.id, metadata: { expected: payment.amountMinor, received: event.amountMinor } }, tx);
        return { mismatch: true };
      }
      const applied = await applySucceededPayment(payment.id, tx);
      if (applied) await audit({ action: "payment.confirmed", entityType: "Payment", entityId: payment.id, metadata: { provider: provider.name, eventId: event.eventId, isTest: payment.isTest } }, tx);
      return { applied };
    }
    if (event.status === "FAILED") {
      await tx.payment.updateMany({ where: { id: payment.id, status: "PENDING" }, data: { status: "FAILED", failureReason: event.failureReason ?? "Paiement refusé." } });
    }
    return { status: event.status };
  });
}

/** Rapprochement manuel d'un virement reçu (finance), journalisé. */
export async function confirmBankTransfer(user: SessionUser, paymentId: string, bankReference: string, db: Db = prisma) {
  requireAdmin(user, "FINANCE_MANAGE");
  const p = await db.payment.findUnique({ where: { id: paymentId } });
  if (!p || p.method !== "BANK_TRANSFER") throw new DomainError("VALIDATION", "Seuls les virements se confirment manuellement.");
  await inTransaction(db, async (tx) => {
    const applied = await applySucceededPayment(paymentId, tx);
    if (!applied) throw new DomainError("INVALID_STATE", "Ce paiement n'est plus en attente.");
    await audit({ actorId: user.id, action: "payment.manual_confirm", entityType: "Payment", entityId: paymentId, metadata: { bankReference } }, tx);
  });
}

export async function cancelSubscription(user: SessionUser, subscriptionId: string, db: Db = prisma) {
  const sub = await db.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) throw new DomainError("NOT_FOUND", "Abonnement introuvable.");
  if (sub.organizationId) requireOrgPermission(user, sub.organizationId, "billing.manage");
  else if (sub.userId !== user.id) throw new DomainError("FORBIDDEN", "Accès refusé.");
  if (sub.status === "PENDING_PAYMENT") {
    await db.subscription.update({ where: { id: sub.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    await db.invoice.updateMany({ where: { subscriptionId: sub.id, status: "ISSUED", paidMinor: 0 }, data: { status: "VOID", voidedAt: new Date() } });
  } else if (sub.status === "ACTIVE" || sub.status === "PAST_DUE") {
    // Résiliation en fin de période : l'accès est conservé jusqu'à l'échéance payée.
    await db.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: true } });
  } else throw new DomainError("INVALID_STATE", "Abonnement déjà terminé.");
  await audit({ actorId: user.id, organizationId: sub.organizationId, action: "subscription.cancel", entityType: "Subscription", entityId: sub.id }, db);
}

/** Changement de plan immédiat avec crédit au prorata de la période en cours. */
export async function changePlan(user: SessionUser, subscriptionId: string, newPriceId: string, method: PaymentMethod, db: Db = prisma) {
  const sub = await db.subscription.findUnique({ where: { id: subscriptionId }, include: { price: true } });
  if (!sub || sub.status !== "ACTIVE" || !sub.currentPeriodStart || !sub.currentPeriodEnd) throw new DomainError("INVALID_STATE", "Abonnement actif requis.");
  if (sub.organizationId) requireOrgPermission(user, sub.organizationId, "billing.manage");
  else if (sub.userId !== user.id) throw new DomainError("FORBIDDEN", "Accès refusé.");
  const price = await db.planPrice.findUnique({ where: { id: newPriceId }, include: { plan: true } });
  if (!price || !price.isActive || price.currency !== sub.price.currency || price.id === sub.priceId) throw new DomainError("VALIDATION", "Offre de destination invalide (même devise requise).");
  const credit = prorationCreditMinor(sub.price.amountMinor, sub.currentPeriodStart, sub.currentPeriodEnd, new Date());
  const holder: Holder = sub.organizationId ? { userId: null, organizationId: sub.organizationId } : { userId: sub.userId!, organizationId: null };
  const newSub = await db.subscription.create({ data: { planId: price.planId, priceId: price.id, userId: holder.userId, organizationId: holder.organizationId } });
  const taxBps = await defaultTaxBps((await buyerSnapshot(holder, db)).countryCode as string | null, db);
  const amount = Math.max(0, price.amountMinor - credit);
  const invoice = await createAndIssueInvoice({ holder, currency: price.currency, serviceCode: "SUBSCRIPTION", subscriptionId: newSub.id, lines: [{ description: `${price.plan.name} (crédit prorata ${formatMoney(credit, price.currency)} déduit)`, quantity: 1, unitPriceMinor: amount, taxRateBps: taxBps }] }, db);
  await audit({ actorId: user.id, organizationId: sub.organizationId, action: "subscription.change", entityType: "Subscription", entityId: sub.id, metadata: { to: price.plan.code, credit } }, db);
  if (invoice.totalMinor === 0) {
    await activateSubscription(newSub.id, db);
    return { redirectUrl: "/facturation?ok=1" };
  }
  return startPayment(user, invoice.id, method, null, db);
}

// ── Remboursements ───────────────────────────────────────────

export async function requestRefund(user: SessionUser, paymentId: string, amountMinor: number, reason: string, db: Db = prisma) {
  const p = await db.payment.findUnique({ where: { id: paymentId }, include: { invoice: true, refunds: true } });
  if (!p) throw new DomainError("NOT_FOUND", "Paiement introuvable.");
  assertInvoiceAccess(user, p.invoice);
  if (!["SUCCEEDED", "PARTIALLY_REFUNDED"].includes(p.status)) throw new DomainError("INVALID_STATE", "Seul un paiement réussi peut être remboursé.");
  const already = p.refunds.filter((r) => ["REQUESTED", "APPROVED", "SUCCEEDED"].includes(r.status)).reduce((s, r) => s + r.amountMinor, 0);
  if (amountMinor <= 0 || amountMinor > p.amountMinor - already) throw new DomainError("VALIDATION", "Montant de remboursement supérieur au montant remboursable.");
  const refund = await db.refund.create({ data: { paymentId, amountMinor, reason, requestedById: user.id } });
  await audit({ actorId: user.id, organizationId: p.invoice.organizationId, action: "refund.request", entityType: "Refund", entityId: refund.id, metadata: { amountMinor } }, db);
  return refund;
}

export async function decideRefund(user: SessionUser, refundId: string, approve: boolean, db: Db = prisma) {
  requireAdmin(user, "FINANCE_MANAGE");
  const r = await db.refund.findUnique({ where: { id: refundId }, include: { payment: { include: { refunds: true } } } });
  if (!r || r.status !== "REQUESTED") throw new DomainError("INVALID_STATE", "Demande de remboursement non traitable.");
  if (!approve) {
    await db.refund.update({ where: { id: refundId }, data: { status: "REJECTED", decidedById: user.id, processedAt: new Date() } });
    await audit({ actorId: user.id, action: "refund.reject", entityType: "Refund", entityId: refundId }, db);
    return;
  }
  const provider = getPaymentProvider(r.payment.provider);
  const result = await provider.refund({ providerRef: r.payment.providerRef ?? r.payment.id, amountMinor: r.amountMinor, refundId: r.id, reason: r.reason });
  const status = result.status === "SUCCEEDED" ? "SUCCEEDED" : result.status === "FAILED" ? "FAILED" : "APPROVED";
  await inTransaction(db, async (tx) => {
    await tx.refund.update({ where: { id: refundId }, data: { status, decidedById: user.id, providerRef: result.providerRefundRef, processedAt: new Date() } });
    if (status === "SUCCEEDED") {
      const refunded = r.payment.refunds.filter((x) => x.status === "SUCCEEDED").reduce((s, x) => s + x.amountMinor, 0) + r.amountMinor;
      await tx.payment.update({ where: { id: r.paymentId }, data: { status: refunded >= r.payment.amountMinor ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
    }
    await audit({ actorId: user.id, action: "refund.approve", entityType: "Refund", entityId: refundId, metadata: { status } }, tx);
  });
}

// ── Tâches planifiées ────────────────────────────────────────

/** Renouvellements : facture de renouvellement à l'échéance, expiration après 15 jours d'impayé. */
export async function processRenewals(now = new Date(), db: Db = prisma) {
  let renewed = 0;
  let expired = 0;
  const due = await db.subscription.findMany({ where: { status: "ACTIVE", currentPeriodEnd: { lte: now }, plan: { isRecurring: true } }, include: { price: true, plan: true } });
  for (const sub of due) {
    if (sub.cancelAtPeriodEnd) {
      await db.subscription.update({ where: { id: sub.id }, data: { status: "CANCELLED", cancelledAt: now } });
      expired++;
      continue;
    }
    const holder: Holder = sub.organizationId ? { userId: null, organizationId: sub.organizationId } : { userId: sub.userId!, organizationId: null };
    const taxBps = await defaultTaxBps((await buyerSnapshot(holder, db)).countryCode as string | null, db);
    await db.subscription.update({ where: { id: sub.id }, data: { status: "PAST_DUE" } });
    const inv = await createAndIssueInvoice({ holder, currency: sub.price.currency, serviceCode: "SUBSCRIPTION", subscriptionId: sub.id, lines: [{ description: `${sub.plan.name} — renouvellement`, quantity: 1, unitPriceMinor: sub.price.amountMinor, taxRateBps: taxBps }] }, db);
    if (inv.totalMinor === 0) await activateSubscription(sub.id, db);
    const recipients = sub.userId ? [sub.userId] : (await db.organizationMember.findMany({ where: { organizationId: sub.organizationId!, role: { in: ["OWNER", "ADMIN"] } } })).map((m) => m.userId);
    for (const uid of recipients) await notify({ userId: uid, type: "RENEWAL", title: "Renouvellement de votre abonnement", body: `Facture ${inv.number} émise pour ${sub.plan.name}.`, link: `/facturation/factures/${inv.id}` }, db);
    renewed++;
  }
  const lapsed = await db.subscription.updateMany({ where: { status: "PAST_DUE", currentPeriodEnd: { lte: new Date(now.getTime() - 15 * 86_400_000) } }, data: { status: "EXPIRED" } });
  return { renewed, expired: expired + lapsed.count };
}

/** Relances des factures impayées (J+3, J+10, J+20). */
export async function sendInvoiceReminders(now = new Date(), db: Db = prisma) {
  const open = await db.invoice.findMany({ where: { status: { in: ["ISSUED", "PARTIALLY_PAID"] }, dueAt: { lte: now }, isDemo: false } });
  let sent = 0;
  for (const inv of open) {
    if (!inv.dueAt || !reminderDue(inv.dueAt, inv.remindersSent, now)) continue;
    const recipients = inv.userId ? [inv.userId] : (await db.organizationMember.findMany({ where: { organizationId: inv.organizationId!, role: { in: ["OWNER", "ADMIN"] } } })).map((m) => m.userId);
    for (const uid of recipients) await notify({ userId: uid, type: "INVOICE", title: `Relance : facture ${inv.number}`, body: `Reste à payer : ${formatMoney(inv.totalMinor - inv.paidMinor, inv.currency)}.`, link: `/facturation/factures/${inv.id}` }, db);
    await db.invoice.update({ where: { id: inv.id }, data: { remindersSent: { increment: 1 }, lastReminderAt: now } });
    sent++;
  }
  return sent;
}

/** Simulateur (prestataire mock uniquement) : construit et traite un webhook signé. */
export async function simulateMockPayment(user: SessionUser, paymentId: string, outcome: "SUCCEEDED" | "FAILED", db: Db = prisma) {
  const p = await db.payment.findUnique({ where: { id: paymentId }, include: { invoice: true } });
  if (!p || p.provider !== "mock" || !p.providerRef) throw new DomainError("NOT_FOUND", "Paiement de test introuvable.");
  assertInvoiceAccess(user, p.invoice);
  const { getMockProvider } = await import("@/infrastructure/payments/registry");
  const hook = getMockProvider().buildWebhook({ reference: p.providerRef, status: outcome, amountMinor: p.amountMinor, currency: p.currency, failureReason: outcome === "FAILED" ? "Refusé (simulation)" : undefined });
  return handlePaymentWebhook("mock", hook.body, hook.headers, db);
}
