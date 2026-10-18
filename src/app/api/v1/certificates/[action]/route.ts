import { z } from "zod";
import { actions, defineAction } from "@/infrastructure/http/actions";
import { assignCosigner, attachIssuer, claimExpertCertificate, reviewIssuer, revokeExpertCertificate, saveIssuer, saveTbSignatory, setIssuerFile, submitIssuer } from "@/application/certificate.service";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

/** Protocole de certification : institutions délivrantes, cosignataires Talent Bridge, certificats consultants. */
export const POST = actions<{ action: string }>({
  "issuer-save": defineAction({
    schema: z.object({ issuerId: z.string().optional().nullable(), courseId: z.string().optional().nullable(), name: text(2, 160), tagline: optionalText(120), signatoryName: optionalText(120), signatoryTitle: optionalText(160), attest: z.boolean().default(false) }),
    run: async ({ user }, b) => ({ issuer: await saveIssuer(user, b) }),
  }),
  "issuer-file": defineAction({
    schema: z.object({ issuerId: z.string(), kind: z.enum(["logo", "seal", "signature"]), fileId: z.string() }),
    run: async ({ user }, b) => setIssuerFile(user, b.issuerId, b.kind, b.fileId),
  }),
  "issuer-submit": defineAction({ schema: z.object({ issuerId: z.string() }), run: async ({ user }, b) => ({ issuer: await submitIssuer(user, b.issuerId) }) }),
  "issuer-attach": defineAction({ schema: z.object({ courseId: z.string(), issuerId: z.string() }), run: async ({ user }, b) => attachIssuer(user, b.courseId, b.issuerId) }),
  "issuer-review": defineAction({
    schema: z.object({ issuerId: z.string(), approve: z.boolean(), note: optionalText(500) }),
    run: async ({ user }, b) => reviewIssuer(user, b.issuerId, b.approve, b.note),
  }),
  "tb-signatory-save": defineAction({
    schema: z.object({ id: z.string().optional().nullable(), fullName: text(3, 120), title: text(2, 160), signatureFileId: z.string().optional().nullable(), sealFileId: z.string().optional().nullable(), forVerification: z.boolean().default(false), isActive: z.boolean().default(true) }),
    run: async ({ user }, b) => ({ signatory: await saveTbSignatory(user, { ...b, id: b.id ?? null, signatureFileId: b.signatureFileId ?? null, sealFileId: b.sealFileId ?? null }) }),
  }),
  "course-cosigner": defineAction({ schema: z.object({ courseId: z.string(), tbSignatoryId: z.string().optional().nullable() }), run: async ({ user }, b) => assignCosigner(user, b.courseId, b.tbSignatoryId || null) }),
  "consultant-claim": defineAction({ idempotent: true, run: async ({ user }) => { const c = await claimExpertCertificate(user); return { certificate: c, redirectUrl: `/certificats/${c.code}` }; } }),
  "consultant-revoke": defineAction({ schema: z.object({ certificateId: z.string(), reason: text(5, 300) }), run: async ({ user }, b) => revokeExpertCertificate(user, b.certificateId, b.reason) }),
});
