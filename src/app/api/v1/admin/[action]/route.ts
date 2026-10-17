/**
 * Back-office : toutes les actions exigent une permission d'administration précise
 * (contrôlée dans les services) et sont journalisées.
 */
import { z } from "zod";
import { actions, defineAction } from "@/infrastructure/http/actions";
import { prisma } from "@/infrastructure/db";
import { requireAdmin } from "@/application/access";
import { audit } from "@/application/audit.service";
import { moderateMission, setAdminRole, setUserStatus, upsertDomain, upsertSkill } from "@/application/admin.service";
import { adminDecideOrganization } from "@/application/organization.service";
import { decide, recordCheck, revokeBadge, verifyProfileItem } from "@/application/verification.service";
import { confirmBankTransfer, decideRefund } from "@/application/billing.service";
import { resolveReport } from "@/application/community.service";
import { publishTender } from "@/application/tender.service";
import { saveBlock } from "@/application/cms.service";
import { setSetting } from "@/application/settings.service";
import { couponSchema, contentBlockSchema, faqSchema, matchingWeightsSchema, planPriceSchema, planSchema, tenderSchema, verificationCheckSchema, verificationDecisionSchema } from "@/application/schemas";
import { toMinor } from "@/domain/money";
import { normalizeWeights } from "@/domain/matching";

const PERMS = ["SUPER_ADMIN", "USERS_MANAGE", "EXPERTS_VERIFY", "ORGS_VALIDATE", "MARKETPLACE_MODERATE", "FINANCE_MANAGE", "CONFIG_MANAGE", "CONTENT_MANAGE", "COMMUNITY_MODERATE", "CRM_MANAGE", "ANALYTICS_VIEW", "AUDIT_VIEW"] as const;

export const POST = actions<{ action: string }>({
  "user-status": defineAction({ schema: z.object({ userId: z.string(), status: z.enum(["ACTIVE", "SUSPENDED"]), reason: z.string().trim().min(3).max(500) }), run: async ({ user }, b) => setUserStatus(user, b.userId, b.status, b.reason) }),
  "admin-role": defineAction({ schema: z.object({ userId: z.string(), permissions: z.array(z.enum(PERMS)) }), run: async ({ user }, b) => setAdminRole(user, b.userId, b.permissions) }),
  "org-decide": defineAction({ schema: z.object({ organizationId: z.string(), status: z.enum(["VERIFIED", "REJECTED", "SUSPENDED"]), note: z.string().max(1000).optional().nullable() }), run: async ({ user }, b) => adminDecideOrganization(user, b.organizationId, b.status, b.note ?? null) }),
  "mission-moderate": defineAction({ schema: z.object({ missionId: z.string(), reason: z.string().trim().min(3).max(500) }), run: async ({ user }, b) => moderateMission(user, b.missionId, b.reason) }),
  "verification-check": defineAction({ schema: verificationCheckSchema.extend({ requestId: z.string() }), run: async ({ user }, b) => recordCheck(user, b.requestId, b) }),
  "verification-decide": defineAction({ schema: verificationDecisionSchema.extend({ requestId: z.string() }), run: async ({ user }, b) => decide(user, b.requestId, b.decision, b.note) }),
  "verify-item": defineAction({ schema: z.object({ kind: z.enum(["reference", "qualification"]), id: z.string(), verified: z.boolean() }), run: async ({ user }, b) => verifyProfileItem(user, b.kind, b.id, b.verified) }),
  "badge-revoke": defineAction({ schema: z.object({ expertBadgeId: z.string(), reason: z.string().trim().min(3).max(500) }), run: async ({ user }, b) => revokeBadge(user, b.expertBadgeId, b.reason) }),
  "transfer-confirm": defineAction({ schema: z.object({ paymentId: z.string(), bankReference: z.string().trim().min(3).max(120) }), run: async ({ user }, b) => confirmBankTransfer(user, b.paymentId, b.bankReference) }),
  "refund-decide": defineAction({ schema: z.object({ refundId: z.string(), approve: z.boolean() }), run: async ({ user }, b) => decideRefund(user, b.refundId, b.approve) }),
  "report-resolve": defineAction({ schema: z.object({ reportId: z.string(), action: z.enum(["REMOVE", "RESTORE", "DISMISS"]), note: z.string().max(500).optional().nullable() }), run: async ({ user }, b) => resolveReport(user, b.reportId, b.action, b.note ?? null) }),
  "tender-publish": defineAction({ schema: tenderSchema, run: async ({ user }, b) => ({ tender: await publishTender(user, b, true), redirectUrl: "/appels-offres" }) }),
  "cms-block": defineAction({ schema: contentBlockSchema.extend({ key: z.string().regex(/^[a-z0-9.\-_]{2,60}$/), locale: z.enum(["fr", "en"]).default("fr") }), run: async ({ user }, b) => saveBlock(user, b.key, b.locale, { title: b.title, body: b.body }) }),
  "faq-create": defineAction({ schema: faqSchema, run: async ({ user }, b) => { requireAdmin(user, "CONTENT_MANAGE"); await prisma.faqItem.create({ data: b }); await audit({ actorId: user.id, action: "cms.faq", entityType: "FaqItem" }); } }),
  "faq-toggle": defineAction({ schema: z.object({ id: z.string(), isVisible: z.boolean() }), run: async ({ user }, b) => { requireAdmin(user, "CONTENT_MANAGE"); await prisma.faqItem.update({ where: { id: b.id }, data: { isVisible: b.isVisible } }); } }),
  "stat-update": defineAction({
    schema: z.object({ id: z.string(), label: z.string().trim().min(2).max(80), source: z.enum(["LIVE", "MANUAL"]), manualValue: z.string().max(30).optional().nullable(), isDemo: z.boolean(), isVisible: z.boolean() }),
    run: async ({ user }, b) => { requireAdmin(user, "CONTENT_MANAGE"); await prisma.publicStat.update({ where: { id: b.id }, data: { label: b.label, source: b.source, manualValue: b.manualValue ?? null, isDemo: b.isDemo, isVisible: b.isVisible } }); await audit({ actorId: user.id, action: "cms.stat", entityType: "PublicStat", entityId: b.id }); },
  }),
  "testimonial-save": defineAction({
    schema: z.object({ id: z.string().optional(), authorName: z.string().trim().min(2).max(120), authorRole: z.string().trim().min(2).max(120), organization: z.string().max(160).optional().nullable(), quote: z.string().trim().min(10).max(1000), isVerified: z.boolean(), isVisible: z.boolean() }),
    run: async ({ user }, b) => { requireAdmin(user, "CONTENT_MANAGE"); const { id, ...data } = b; if (id) await prisma.testimonial.update({ where: { id }, data }); else await prisma.testimonial.create({ data }); await audit({ actorId: user.id, action: "cms.testimonial", entityType: "Testimonial", entityId: id ?? null }); },
  }),
  "matching-weights": defineAction({ schema: matchingWeightsSchema, run: async ({ user }, b) => { requireAdmin(user, "CONFIG_MANAGE"); await setSetting("matching.weights", normalizeWeights(b), user.id); await audit({ actorId: user.id, action: "config.matching_weights", entityType: "SystemSetting", metadata: b }); } }),
  "seller-identity": defineAction({
    schema: z.object({ name: z.string().trim().min(2).max(160), address: z.string().trim().min(2).max(300), countryCode: z.string().length(2), registrationNumber: z.string().trim().max(60), taxId: z.string().trim().max(60), taxRegime: z.string().trim().max(120) }),
    run: async ({ user }, b) => { requireAdmin(user, "FINANCE_MANAGE"); await setSetting("seller.identity", b, user.id); await audit({ actorId: user.id, action: "config.seller", entityType: "SystemSetting" }); },
  }),
  "billing-settings": defineAction({
    schema: z.object({ invoicePrefix: z.string().regex(/^[A-Z]{2,8}$/), paymentTermDays: z.coerce.number().int().min(0).max(120), commissionPct: z.coerce.number().min(0).max(50) }),
    run: async ({ user }, b) => { requireAdmin(user, "FINANCE_MANAGE"); await setSetting("invoice.prefix", b.invoicePrefix, user.id); await setSetting("invoice.paymentTermDays", b.paymentTermDays, user.id); await setSetting("commission.defaultBps", Math.round(b.commissionPct * 100), user.id); await audit({ actorId: user.id, action: "config.billing", entityType: "SystemSetting", metadata: b }); },
  }),
  "tax-rate": defineAction({
    schema: z.object({ countryCode: z.string().length(2), name: z.string().trim().min(2).max(60), ratePct: z.coerce.number().min(0).max(40) }),
    run: async ({ user }, b) => { requireAdmin(user, "FINANCE_MANAGE"); await prisma.taxRate.updateMany({ where: { countryCode: b.countryCode, isDefault: true }, data: { isDefault: false, isActive: false } }); await prisma.taxRate.create({ data: { countryCode: b.countryCode, name: b.name, rateBps: Math.round(b.ratePct * 100), isDefault: true } }); await audit({ actorId: user.id, action: "config.tax_rate", entityType: "TaxRate", metadata: b }); },
  }),
  "country-toggle": defineAction({ schema: z.object({ code: z.string().length(2), isActive: z.boolean() }), run: async ({ user }, b) => { requireAdmin(user, "CONFIG_MANAGE"); await prisma.country.update({ where: { code: b.code }, data: { isActive: b.isActive } }); await audit({ actorId: user.id, action: "config.country", entityType: "Country", entityId: b.code, metadata: b }); } }),
  skill: defineAction({ schema: z.object({ id: z.string().optional(), slug: z.string().regex(/^[a-z0-9-]{2,60}$/), nameFr: z.string().trim().min(2).max(80), nameEn: z.string().trim().min(2).max(80), domainId: z.string().nullable().optional(), synonyms: z.array(z.string().trim().min(1).max(60)).max(20).default([]), isActive: z.boolean().default(true) }), run: async ({ user }, b) => upsertSkill(user, { ...b, domainId: b.domainId ?? null }) }),
  domain: defineAction({ schema: z.object({ id: z.string().optional(), slug: z.string().regex(/^[a-z0-9-]{2,60}$/), nameFr: z.string().trim().min(2).max(80), nameEn: z.string().trim().min(2).max(80), isActive: z.boolean().default(true) }), run: async ({ user }, b) => upsertDomain(user, b) }),
  "plan-save": defineAction({
    schema: planSchema.extend({ id: z.string().optional() }),
    run: async ({ user }, b) => { requireAdmin(user, "FINANCE_MANAGE"); const { id, ...data } = b; const p = id ? await prisma.subscriptionPlan.update({ where: { id }, data }) : await prisma.subscriptionPlan.create({ data }); await audit({ actorId: user.id, action: "config.plan", entityType: "SubscriptionPlan", entityId: p.id, metadata: data }); return { plan: p }; },
  }),
  "price-add": defineAction({
    schema: planPriceSchema.extend({ planId: z.string() }),
    run: async ({ user }, b) => { requireAdmin(user, "FINANCE_MANAGE"); const price = await prisma.planPrice.create({ data: { planId: b.planId, currency: b.currency, interval: b.interval, amountMinor: toMinor(b.amount, b.currency), countryCode: b.countryCode ?? null } }); await audit({ actorId: user.id, action: "config.price", entityType: "PlanPrice", entityId: price.id, metadata: b }); },
  }),
  "price-toggle": defineAction({ schema: z.object({ id: z.string(), isActive: z.boolean() }), run: async ({ user }, b) => { requireAdmin(user, "FINANCE_MANAGE"); await prisma.planPrice.update({ where: { id: b.id }, data: { isActive: b.isActive } }); await audit({ actorId: user.id, action: "config.price_toggle", entityType: "PlanPrice", entityId: b.id, metadata: b }); } }),
  "plan-feature": defineAction({
    schema: z.object({ planId: z.string(), featureCode: z.string(), included: z.boolean(), limit: z.coerce.number().int().min(0).nullable().optional() }),
    run: async ({ user }, b) => {
      requireAdmin(user, "FINANCE_MANAGE");
      const f = await prisma.feature.findUniqueOrThrow({ where: { code: b.featureCode } });
      if (!b.included) await prisma.planFeature.deleteMany({ where: { planId: b.planId, featureId: f.id } });
      else await prisma.planFeature.upsert({ where: { planId_featureId: { planId: b.planId, featureId: f.id } }, create: { planId: b.planId, featureId: f.id, limit: b.limit ?? null }, update: { limit: b.limit ?? null } });
      await audit({ actorId: user.id, action: "config.plan_feature", entityType: "SubscriptionPlan", entityId: b.planId, metadata: b });
    },
  }),
  "coupon-create": defineAction({
    schema: couponSchema,
    run: async ({ user }, b) => { requireAdmin(user, "FINANCE_MANAGE"); await prisma.coupon.create({ data: { code: b.code, percentOffBps: b.percentOff ? Math.round(b.percentOff * 100) : null, amountOffMinor: b.amountOff && b.currency ? toMinor(b.amountOff, b.currency) : null, currency: b.currency ?? null, maxRedemptions: b.maxRedemptions ?? null, validUntil: b.validUntil } }); await audit({ actorId: user.id, action: "config.coupon", entityType: "Coupon", metadata: { code: b.code } }); },
  }),
  "coupon-toggle": defineAction({ schema: z.object({ id: z.string(), isActive: z.boolean() }), run: async ({ user }, b) => { requireAdmin(user, "FINANCE_MANAGE"); await prisma.coupon.update({ where: { id: b.id }, data: { isActive: b.isActive } }); } }),
  "template-save": defineAction({
    schema: z.object({ id: z.string(), subject: z.string().trim().min(2).max(200), body: z.string().trim().min(2).max(5000), isActive: z.boolean() }),
    run: async ({ user }, b) => { requireAdmin(user, "CONFIG_MANAGE"); await prisma.notificationTemplate.update({ where: { id: b.id }, data: { subject: b.subject, body: b.body, isActive: b.isActive } }); await audit({ actorId: user.id, action: "config.template", entityType: "NotificationTemplate", entityId: b.id }); },
  }),
  "contact-handled": defineAction({ schema: z.object({ id: z.string() }), run: async ({ user }, b) => { requireAdmin(user, "CONTENT_MANAGE"); await prisma.contactRequest.update({ where: { id: b.id }, data: { status: "HANDLED" } }); } }),
});
