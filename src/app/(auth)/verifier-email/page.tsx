import type { Metadata } from "next";
import { CheckCircle2, XCircle } from "lucide-react";
import { verifyEmail } from "@/application/auth.service";
import { ButtonLink } from "@/ui/Button";

export const metadata: Metadata = { title: "Vérification de l'adresse email" };
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ jeton?: string }> }) {
  const { jeton } = await searchParams;
  let ok = false;
  if (jeton) ok = await verifyEmail(jeton).then(() => true).catch(() => false);
  return (
    <div className="text-center">
      {ok ? <CheckCircle2 className="mx-auto h-14 w-14 text-olive-600" /> : <XCircle className="mx-auto h-14 w-14 text-red-600" />}
      <h1 className="mt-4 text-2xl font-extrabold">{ok ? "Adresse email confirmée" : "Lien invalide ou expiré"}</h1>
      <p className="mt-2 text-slate">{ok ? "Merci, votre adresse est vérifiée." : "Demandez un nouveau lien depuis vos paramètres de compte."}</p>
      <ButtonLink href={ok ? "/connexion" : "/parametres"} className="mt-6">{ok ? "Se connecter" : "Mes paramètres"}</ButtonLink>
    </div>
  );
}
