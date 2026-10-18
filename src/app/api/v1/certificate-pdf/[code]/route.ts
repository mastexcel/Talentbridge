import { NextResponse } from "next/server";
import { route } from "@/infrastructure/http/handler";
import { DomainError } from "@/domain/errors";
import { findCertificate } from "@/application/certificate.service";
import { academyCertificatePdf, consultantCertificatePdf } from "@/application/certificate-pdf";

/** Certificat en PDF (public, comme la page de vérification). */
export const GET = route<{ code: string }>({ rateLimit: { limit: 60, windowMs: 60_000 } }, async ({ params }) => {
  const cert = await findCertificate(decodeURIComponent(params.code));
  if (!cert) throw new DomainError("NOT_FOUND", "Certificat introuvable.");
  let pdf: Uint8Array;
  if (cert.type === "consultant") pdf = await consultantCertificatePdf(cert);
  else if (cert.snapshot?.issuer) pdf = await academyCertificatePdf(cert, cert.snapshot);
  else throw new DomainError("NOT_AVAILABLE", "Ce certificat a été délivré avant le protocole de signature : consultez la page de vérification.");
  return new NextResponse(Buffer.from(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="certificat-${cert.code}.pdf"`, "cache-control": "private, max-age=300" } });
});
