/** Préparation des données d'affichage d'un certificat : liens signés vers les images et QR code. */
import { certificateWording } from "@/domain/academy";
import QRCode from "qrcode";
import { env } from "@/infrastructure/env";
import { signFileLink } from "@/application/file.service";
import type { PublicCertificate } from "@/application/certificate.service";
import type { CertificateSnapshot } from "@/domain/certificates";
import type { AcademyCertificateProps, ConsultantCertificateProps } from "@/ui/certificates/CertificateViews";

/** Lien d'image valable 1 heure (les fichiers restent privés ; seul le certificat les expose). */
export const imageUrl = (fileId: string | null | undefined) => (fileId ? signFileLink(fileId, 3600) : null);

export async function qrFor(code: string) {
  return QRCode.toDataURL(`${env().APP_URL}/certificats/${code}`, { margin: 1, width: 260, color: { dark: "#17212B" } });
}

export function academyProps(c: { code: string; holderName: string; courseTitle: string; issuedAt: Date; revokedAt?: Date | null }, snap: CertificateSnapshot, qrDataUrl: string, specimen = false): AcademyCertificateProps {
  const i = snap.issuer!;
  return {
    code: c.code,
    holderName: c.holderName,
    courseTitle: c.courseTitle,
    durationHours: snap.durationHours ?? null,
    issuedAt: c.issuedAt,
    issuer: { name: i.name, tagline: i.tagline, logoUrl: imageUrl(i.logoFileId), sealUrl: imageUrl(i.sealFileId), signatory: { name: i.signatoryName, title: i.signatoryTitle, organization: i.name, signatureUrl: imageUrl(i.signatureFileId) } },
    tb: { name: snap.tb.fullName, title: snap.tb.title, organization: "Talent Bridge Academy", signatureUrl: imageUrl(snap.tb.signatureFileId) },
    qrDataUrl,
    wording: certificateWording(snap.kind, snap.format),
    specimen,
    revoked: !!c.revokedAt,
  };
}

export function consultantProps(c: Extract<PublicCertificate, { type: "consultant" }>, qrDataUrl: string): ConsultantCertificateProps {
  return {
    code: c.code,
    holderName: c.holderName,
    headline: c.headline,
    photoUrl: imageUrl(c.photoFileId),
    domains: c.domains,
    checks: c.checks,
    yearsExperience: c.yearsExperience,
    issuedAt: c.issuedAt,
    validUntil: c.validUntil,
    tb: { name: c.snapshot.tb.fullName, title: c.snapshot.tb.title, organization: "Talent Bridge", signatureUrl: imageUrl(c.snapshot.tb.signatureFileId) },
    qrDataUrl,
    revoked: !!c.revokedAt,
  };
}
