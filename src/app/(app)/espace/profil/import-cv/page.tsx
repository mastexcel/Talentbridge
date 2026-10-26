import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { prisma } from "@/infrastructure/db";
import { requireExpertUser } from "@/lib/session";
import { cvDraftForExpert } from "@/application/cv-import.service";
import { DomainError } from "@/domain/errors";
import { PageHeader } from "@/ui/Page";
import { Alert } from "@/ui/Feedback";
import { ButtonLink } from "@/ui/Button";
import { CvImportForm } from "@/ui/CvImportForm";

export const metadata: Metadata = { title: "Remplir mon profil depuis mon CV" };
export const dynamic = "force-dynamic";

export default async function ImportCvPage() {
  const user = await requireExpertUser("/espace/profil/import-cv");
  const expertId = user.expertProfile.id;
  let result: Awaited<ReturnType<typeof cvDraftForExpert>> | null = null;
  let error: string | null = null;
  try {
    result = await cvDraftForExpert(user, expertId);
  } catch (e) {
    if (!(e instanceof DomainError)) throw e;
    error = e.message;
  }
  const back = { href: "/espace/profil", label: "Mon profil" };
  if (!result) {
    return (
      <>
        <PageHeader back={back} title="Remplir mon profil depuis mon CV" />
        <Alert tone="warning">{error}</Alert>
        <div className="mt-4"><ButtonLink href="/espace/profil" variant="outline">Retour au profil</ButtonLink></div>
      </>
    );
  }
  const [profile, domains, countries] = await Promise.all([
    prisma.expertProfile.findUniqueOrThrow({ where: { id: expertId }, select: { headline: true, bio: true, yearsExperience: true, countryCode: true, languages: true } }),
    prisma.expertiseDomain.findMany({ select: { id: true, nameFr: true } }),
    prisma.country.findMany({ where: { isActive: true }, orderBy: { nameFr: "asc" }, select: { code: true, nameFr: true } }),
  ]);
  const { draft, already } = result;
  const skipped = already.skills + already.experiences + already.qualifications;
  return (
    <>
      <PageHeader back={back} title="Remplir mon profil depuis mon CV" description="Voici les informations trouvées dans votre CV. Relisez-les, corrigez si besoin et cochez ce que vous voulez ajouter : rien n'est enregistré sans votre validation." />
      <p className="mb-2 flex items-center gap-2 text-sm text-slate"><FileText className="h-4 w-4" aria-hidden /> {result.fileName}</p>
      {skipped > 0 && <p className="mb-4 text-sm text-slate">{skipped} élément(s) déjà présent(s) dans votre profil ne sont pas reproposés.</p>}
      <Alert tone="info" className="mb-6">La lecture automatique peut se tromper (mise en page, abréviations). Les diplômes et références importés restent « déclarés » jusqu&apos;à leur vérification par Talent Bridge.</Alert>
      <CvImportForm
        draft={draft}
        current={profile}
        domainNames={Object.fromEntries(domains.map((d) => [d.id, d.nameFr]))}
        countryNames={Object.fromEntries(countries.map((c) => [c.code, c.nameFr]))}
      />
    </>
  );
}
