"use client";
import { ActionButton } from "./ActionButton";

export function ResendVerification() {
  return <ActionButton action="/api/v1/auth/resend-verification" successMessage="Nouveau lien envoyé." variant="ghost" size="sm" className="underline">Renvoyer le lien</ActionButton>;
}
