import type { Metadata } from "next";
import Link from "next/link";
import { ApiForm } from "@/ui/ApiForm";
import { Field, Input } from "@/ui/Field";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPage() {
  return (
    <>
      <h1 className="text-3xl font-extrabold">Mot de passe oublié</h1>
      <p className="mt-1 text-slate">Indiquez votre adresse : si un compte existe, vous recevrez un lien valable 1 heure.</p>
      <ApiForm action="/api/v1/auth/forgot" submitLabel="Envoyer le lien" successMessage="Si un compte existe pour cette adresse, un lien vous a été envoyé." refresh={false} className="mt-6 space-y-4">
        <Field label="Adresse email" htmlFor="email" required><Input id="email" name="email" type="email" autoComplete="email" /></Field>
      </ApiForm>
      <p className="mt-6 text-sm"><Link href="/connexion" className="text-orange-700">← Retour à la connexion</Link></p>
    </>
  );
}
