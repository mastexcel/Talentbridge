import type { Metadata } from "next";
import { prisma } from "@/infrastructure/db";
import { invitationPreview } from "@/application/auth.service";
import { currentUser } from "@/lib/session";
import { ORG_ROLE_LABELS, type OrgRole } from "@/domain/permissions";
import { ActionButton } from "@/ui/ActionButton";
import { Alert } from "@/ui/Feedback";
import { ButtonLink } from "@/ui/Button";
import { SignupForm } from "@/ui/SignupForm";

export const metadata: Metadata = { title: "Invitation" };
export const dynamic = "force-dynamic";

export default async function InvitationPage({ searchParams }: { searchParams: Promise<{ jeton?: string }> }) {
  const { jeton } = await searchParams;
  const inv = jeton ? await invitationPreview(jeton) : null;
  if (!inv || !jeton) return <Alert tone="error" title="Invitation invalide ou expirée">Demandez une nouvelle invitation à l'organisation.</Alert>;
  const user = await currentUser();
  const intro = <p className="mt-1 text-slate">{inv.organizationName} vous invite à rejoindre son espace en tant que « {ORG_ROLE_LABELS[inv.role as OrgRole]} ».</p>;
  if (user) {
    return (
      <>
        <h1 className="text-3xl font-extrabold">Rejoindre {inv.organizationName}</h1>
        {intro}
        {user.email !== inv.email ? (
          <Alert tone="warning" className="mt-6">Cette invitation a été envoyée à {inv.email}. Connectez-vous avec ce compte.</Alert>
        ) : (
          <ActionButton action="/api/v1/auth/accept-invitation" body={{ token: jeton }} variant="primary" size="lg" className="mt-6 w-full" successMessage="Bienvenue dans l'organisation.">Accepter l'invitation</ActionButton>
        )}
      </>
    );
  }
  const existing = await prisma.user.findUnique({ where: { email: inv.email }, select: { id: true } });
  if (existing) return <><h1 className="text-3xl font-extrabold">Rejoindre {inv.organizationName}</h1>{intro}<ButtonLink href={`/connexion?suite=${encodeURIComponent(`/invitation?jeton=${jeton}`)}`} className="mt-6 w-full">Se connecter pour accepter</ButtonLink></>;
  const countries = await prisma.country.findMany({ where: { isActive: true }, orderBy: { nameFr: "asc" }, select: { code: true, nameFr: true } });
  return (
    <>
      <h1 className="text-3xl font-extrabold">Créer votre compte</h1>
      {intro}
      <div className="mt-6"><SignupForm accountType="EXPERT" countries={countries} invitationToken={jeton} email={inv.email} /></div>
    </>
  );
}
