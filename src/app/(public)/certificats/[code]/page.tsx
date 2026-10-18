import type { Metadata } from "next";
import { BadgeCheck, Download, XCircle } from "lucide-react";
import { findCertificate } from "@/application/certificate.service";
import { academyProps, consultantProps, qrFor } from "@/lib/certificate-view";
import { AcademyCertificate, ConsultantCertificate } from "@/ui/certificates/CertificateViews";
import { DemoBadge } from "@/ui/Badge";

export const metadata: Metadata = { title: "Vérification de certificat" };
export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/** Page publique de vérification : statut, informations clés, certificat et téléchargement PDF. */
export default async function CertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const cert = await findCertificate(decodeURIComponent(code));
  if (!cert) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <XCircle className="mx-auto h-14 w-14 text-red-600" />
        <h1 className="mt-4 text-2xl font-extrabold">Certificat introuvable</h1>
        <p className="mt-2 text-slate">Aucun certificat ne correspond à l&apos;identifiant « {code} ». Vérifiez la saisie.</p>
      </div>
    );
  }
  const qr = await qrFor(cert.code);
  const now = new Date();
  const expired = cert.type === "consultant" && cert.validUntil < now;
  const valid = !cert.revokedAt && !expired;
  const issuerName = cert.type === "academy" ? (cert.snapshot?.issuer ? `Talent Bridge Academy et ${cert.snapshot.issuer.name}` : "Talent Bridge Academy") : "Talent Bridge";
  const facts: [string, string][] =
    cert.type === "academy"
      ? [["Titulaire", cert.holderName], ["Formation", cert.courseTitle], ["Délivré par", issuerName], ["Date d'obtention", fmt(cert.issuedAt)], ["Score à l'évaluation finale", `${cert.scorePct} %`], ["Numéro", cert.code]]
      : [["Titulaire", cert.holderName], ["Profil", cert.headline], ["Délivré par", issuerName], ["Date de certification", fmt(cert.issuedAt)], ["Valable jusqu'au", fmt(cert.validUntil)], ["Numéro", cert.code]];
  const renderable = cert.type === "consultant" || !!cert.snapshot?.issuer;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className={`flex items-start gap-2 rounded-xl p-3 text-sm font-semibold ${valid ? "bg-olive-100 text-olive-800" : "bg-red-100 text-red-800"}`} role="status">
        {valid ? <BadgeCheck className="h-5 w-5 shrink-0" /> : <XCircle className="h-5 w-5 shrink-0" />}
        <span>
          {valid && `Certificat authentique et valide, délivré par ${issuerName}.`}
          {cert.revokedAt && `Certificat révoqué le ${fmt(cert.revokedAt)}${cert.revokeReason ? ` : ${cert.revokeReason}` : ""}.`}
          {!cert.revokedAt && expired && `Certificat expiré depuis le ${fmt((cert as { validUntil: Date }).validUntil)}.`}
        </span>
        <DemoBadge show={cert.isDemo} />
      </div>

      <div className="mt-6 flex flex-col gap-6">
        <div className="order-2 min-w-0">
          {renderable ? (
            cert.type === "academy" ? <AcademyCertificate {...academyProps(cert, cert.snapshot!, qr)} /> : <ConsultantCertificate {...consultantProps(cert, qr)} />
          ) : (
            <p className="rounded-2xl border border-line bg-white p-6 text-sm text-slate">Certificat délivré avant la mise en place du protocole de signature : les informations ci-contre font foi.</p>
          )}
          <p className="mt-2 text-center text-xs text-slate md:hidden">Faites pivoter votre appareil ou téléchargez le PDF pour une lecture confortable.</p>
        </div>
        <aside className="order-1 rounded-2xl border border-line bg-white p-5 shadow-card md:order-3">
          <h1 className="font-display text-lg font-extrabold text-ink">{cert.type === "academy" ? "Certificat de formation" : "Certification « Consultant vérifié »"}</h1>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs uppercase tracking-wide text-slate">{k}</dt>
                <dd className={k === "Numéro" ? "font-mono font-semibold" : "font-semibold text-ink"}>{v}</dd>
              </div>
            ))}
          </dl>
          {renderable && (
            <a href={`/api/v1/certificate-pdf/${cert.code}`} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 font-semibold text-white hover:bg-orange-700 sm:w-auto">
              <Download className="h-4 w-4" /> Télécharger le PDF
            </a>
          )}
        </aside>
      </div>
    </div>
  );
}
