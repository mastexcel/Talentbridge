import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/infrastructure/db";
import { requireUser } from "@/lib/session";
import { academyProps, qrFor } from "@/lib/certificate-view";
import { AcademyCertificate } from "@/ui/certificates/CertificateViews";
import { PageHeader } from "@/ui/Page";

export const metadata: Metadata = { title: "Aperçu du certificat" };

/** Spécimen du certificat avec les éléments renseignés (non valable, filigrane « Spécimen »). */
export default async function CertificatePreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/academy/formateur/${id}/certificat`);
  const c = await prisma.course.findUnique({ where: { id }, include: { issuer: true, tbSignatory: true } });
  if (!c || (c.instructorId !== user.id && user.platformRole !== "ADMIN")) notFound();
  const i = c.issuer;
  const props = academyProps(
    { code: "TBA-SPECIMEN", holderName: "Prénom NOM", courseTitle: c.title, issuedAt: new Date() },
    {
      issuer: { name: i?.name ?? "Institution à renseigner", tagline: i?.tagline ?? null, logoFileId: i?.logoFileId ?? "", sealFileId: i?.sealFileId ?? "", signatoryName: i?.signatoryName ?? "Signataire de l'institution", signatoryTitle: i?.signatoryTitle ?? "Fonction", signatureFileId: i?.signatureFileId ?? "" },
      tb: { fullName: c.tbSignatory?.fullName ?? "Cosignataire Talent Bridge", title: c.tbSignatory?.title ?? "À désigner par Talent Bridge", signatureFileId: c.tbSignatory?.signatureFileId ?? "", sealFileId: null },
      durationHours: c.durationHours,
    },
    await qrFor("TBA-SPECIMEN"),
    true,
  );
  return (
    <>
      <PageHeader back={{ href: `/academy/formateur/${id}`, label: c.title }} title="Aperçu du certificat" description="Spécimen sans valeur, construit avec les éléments actuellement renseignés. Les apprenants reçoivent la version définitive, figée au moment de la délivrance." />
      <AcademyCertificate {...props} />
    </>
  );
}
