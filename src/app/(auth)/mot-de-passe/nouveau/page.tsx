import type { Metadata } from "next";
import { ApiForm } from "@/ui/ApiForm";
import { Field, Input } from "@/ui/Field";
import { Alert } from "@/ui/Feedback";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ jeton?: string }> }) {
  const { jeton } = await searchParams;
  if (!jeton) return <Alert tone="error">Lien incomplet. Refaites une demande de réinitialisation.</Alert>;
  return (
    <>
      <h1 className="text-3xl font-extrabold">Choisir un nouveau mot de passe</h1>
      <ApiForm action="/api/v1/auth/reset" submitLabel="Enregistrer" successMessage="Mot de passe modifié." className="mt-6 space-y-4">
        <input type="hidden" name="token" value={jeton} />
        <Field label="Nouveau mot de passe" htmlFor="password" required hint="10 caractères minimum, avec majuscule, minuscule et chiffre."><Input id="password" name="password" type="password" autoComplete="new-password" /></Field>
      </ApiForm>
      <p className="mt-4 text-xs text-slate">Par sécurité, toutes vos sessions ouvertes seront déconnectées.</p>
    </>
  );
}
