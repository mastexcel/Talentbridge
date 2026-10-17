import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, homePathFor } from "@/lib/session";
import { ApiForm } from "@/ui/ApiForm";
import { Field, Input } from "@/ui/Field";
import { Alert } from "@/ui/Feedback";

export const metadata: Metadata = { title: "Connexion" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ suite?: string; reinitialise?: string }> }) {
  const sp = await searchParams;
  const user = await currentUser();
  if (user) redirect(homePathFor(user));
  const demo = process.env.NODE_ENV !== "production";
  return (
    <>
      <h1 className="text-3xl font-extrabold">Connexion</h1>
      <p className="mt-1 text-slate">Accédez à votre espace Talent Bridge.</p>
      {sp.reinitialise && <Alert tone="success" className="mt-4">Mot de passe modifié. Vous pouvez vous connecter.</Alert>}
      <ApiForm action={`/api/v1/auth/login${sp.suite ? `?suite=${encodeURIComponent(sp.suite)}` : ""}`} submitLabel="Se connecter" successMessage={null} className="mt-6 space-y-4">
        <Field label="Adresse email" htmlFor="email" required><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
        <Field label="Mot de passe" htmlFor="password" required><Input id="password" name="password" type="password" autoComplete="current-password" required /></Field>
        <p className="text-right text-sm"><Link href="/mot-de-passe-oublie" className="text-orange-700 hover:underline">Mot de passe oublié ?</Link></p>
      </ApiForm>
      <p className="mt-6 text-center text-sm text-slate">Pas encore de compte ? <Link href="/inscription" className="font-semibold text-orange-700 hover:underline">Rejoindre Talent Bridge</Link></p>
      {demo && (
        <Alert tone="warning" title="Comptes de démonstration (environnement local uniquement)" className="mt-6">
          <p>Mot de passe : valeur de <code>DEMO_PASSWORD</code> (par défaut <code>Demo2026!TB</code>).</p>
          <ul className="mt-1 list-disc pl-4 text-xs">
            <li>consultant@demo.talentbridge.africa — consultant vérifié</li>
            <li>ong@demo.talentbridge.africa — ONG (propriétaire)</li>
            <li>cabinet@demo.talentbridge.africa — cabinet + CRM</li>
            <li>recruteur@demo.talentbridge.africa — recruteur (2 organisations)</li>
            <li>verificateur@demo.talentbridge.africa — vérification</li>
            <li>ceo@demo.talentbridge.africa — direction générale</li>
            <li>admin@demo.talentbridge.africa — super-administrateur</li>
          </ul>
        </Alert>
      )}
    </>
  );
}
