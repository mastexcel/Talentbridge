import type { Metadata } from "next";
import QRCode from "qrcode";
import { BadgeCheck, XCircle } from "lucide-react";
import { verifyCertificate } from "@/application/academy.service";
import { env } from "@/infrastructure/env";
import { Logo } from "@/ui/Logo";

export const metadata: Metadata = { title: "Certificat Talent Bridge Academy" };
export const dynamic = "force-dynamic";

/** Page publique de vérification : authenticité, titulaire, formation, date et statut (révoqué ou non). */
export default async function CertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const cert = await verifyCertificate(code);
  if (!cert) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <XCircle className="mx-auto h-14 w-14 text-red-600" />
        <h1 className="mt-4 text-2xl font-extrabold">Certificat introuvable</h1>
        <p className="mt-2 text-slate">Aucun certificat ne correspond à l'identifiant « {code} ». Vérifiez la saisie.</p>
      </div>
    );
  }
  const url = `${env().APP_URL}/certificats/${cert.code}`;
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: "#7B1F2B" } });
  const valid = !cert.revokedAt;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className={`mb-4 flex items-center gap-2 rounded-xl p-3 text-sm font-semibold ${valid ? "bg-olive-100 text-olive-800" : "bg-red-100 text-red-800"}`}>
        {valid ? <BadgeCheck className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
        {valid ? "Certificat authentique et valide, délivré par Talent Bridge Academy." : `Certificat révoqué le ${cert.revokedAt!.toLocaleDateString("fr-FR")}${cert.revokeReason ? ` : ${cert.revokeReason}` : ""}.`}
      </div>
      <article className="rounded-3xl border-4 border-double border-bordeaux-200 bg-white p-8 text-center shadow-lift sm:p-12">
        <Logo variant="main" href={null} className="mx-auto h-16 w-auto" />
        <p className="mt-8 text-sm uppercase tracking-[0.3em] text-slate">Certificat de réussite</p>
        <p className="mt-6 text-slate">décerné à</p>
        <h1 className="mt-1 text-3xl font-extrabold text-bordeaux-700">{cert.holderName}</h1>
        <p className="mt-6 text-slate">pour avoir suivi avec succès la formation</p>
        <p className="mt-1 font-display text-xl font-bold">{cert.courseTitle}</p>
        <p className="mt-4 text-sm text-slate">Score à l'évaluation finale : {cert.scorePct} % · Délivré le {cert.issuedAt.toLocaleDateString("fr-FR")}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt={`QR code de vérification du certificat ${cert.code}`} className="mx-auto mt-8 h-32 w-32" />
        <p className="mt-2 font-mono text-sm font-semibold">{cert.code}</p>
      </article>
    </div>
  );
}
