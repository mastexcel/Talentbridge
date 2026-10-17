"use client";
/** Inscription (React Hook Form + Zod, schéma partagé avec le serveur qui revalide). */
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { signupSchema, ORGANIZATION_TYPE_LABELS, type SignupInput } from "@/application/schemas";
import { api, ApiError } from "./api";
import { Button } from "./Button";
import { Checkbox, Field, Input, Select } from "./Field";
import { Alert } from "./Feedback";

export function SignupForm({ accountType, countries, invitationToken, email }: { accountType: SignupInput["accountType"]; countries: { code: string; nameFr: string }[]; invitationToken?: string; email?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, setError: setFieldError, watch, formState: { errors, isSubmitting } } = useForm<z.input<typeof signupSchema>, unknown, SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { accountType, countryCode: "CI", marketingEmail: false, email, invitationToken: invitationToken ?? null },
  });
  const type = watch("accountType");
  const isOrg = type !== "EXPERT";

  async function onSubmit(values: SignupInput) {
    setError(null);
    try {
      const r = await api<{ redirectUrl: string }>("/api/v1/auth/signup", { body: values });
      router.push(r.redirectUrl);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        e.issues.forEach((i) => setFieldError(i.path as "email", { message: i.message }));
        setError(e.message);
      } else setError("Erreur réseau.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      {isOrg && (
        <>
          <Field label="Type d'organisation" htmlFor="accountType" required>
            <Select id="accountType" {...register("accountType")}>
              {Object.entries(ORGANIZATION_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Raison sociale" htmlFor="organizationName" required error={errors.organizationName?.message}>
            <Input id="organizationName" autoComplete="organization" {...register("organizationName")} aria-invalid={!!errors.organizationName} />
          </Field>
        </>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom" htmlFor="firstName" required error={errors.firstName?.message}><Input id="firstName" autoComplete="given-name" {...register("firstName")} /></Field>
        <Field label="Nom" htmlFor="lastName" required error={errors.lastName?.message}><Input id="lastName" autoComplete="family-name" {...register("lastName")} /></Field>
      </div>
      <Field label={isOrg ? "Email professionnel" : "Email"} htmlFor="email" required error={errors.email?.message}><Input id="email" type="email" autoComplete="email" {...register("email")} readOnly={!!email} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Téléphone" htmlFor="phone" hint="Facultatif, jamais affiché publiquement."><Input id="phone" type="tel" autoComplete="tel" {...register("phone")} /></Field>
        <Field label="Pays" htmlFor="countryCode" required error={errors.countryCode?.message}>
          <Select id="countryCode" {...register("countryCode")}>{countries.map((c) => <option key={c.code} value={c.code}>{c.nameFr}</option>)}</Select>
        </Field>
      </div>
      <Field label="Mot de passe" htmlFor="password" required hint="10 caractères minimum, avec majuscule, minuscule et chiffre." error={errors.password?.message}>
        <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
      </Field>
      <div className="space-y-2 rounded-xl bg-mist p-4">
        <Checkbox {...register("acceptTerms")} label={<>J'accepte les <Link href="/conditions-generales" target="_blank" className="underline">conditions générales d'utilisation</Link>.</>} />
        {errors.acceptTerms && <p className="text-xs text-red-700">{errors.acceptTerms.message}</p>}
        <Checkbox {...register("acceptPrivacy")} label={<>J'ai lu la <Link href="/confidentialite" target="_blank" className="underline">politique de confidentialité</Link>.</>} />
        {errors.acceptPrivacy && <p className="text-xs text-red-700">{errors.acceptPrivacy.message}</p>}
        <Checkbox {...register("marketingEmail")} label="J'accepte de recevoir des informations sur les opportunités et nouveautés (facultatif)." />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />} Créer mon compte</Button>
      {isOrg && <p className="text-xs text-slate">Votre organisation sera vérifiée par notre équipe (immatriculation, documents justificatifs) avant d'obtenir le statut « validée ».</p>}
    </form>
  );
}
