"use client";
/**
 * Formulaire générique relié à une route API :
 *  - sérialise les champs (types via data-type="number|boolean|array|json" sur les éléments) ;
 *  - affiche les erreurs de validation renvoyées par le serveur, champ par champ ;
 *  - état de chargement, message de succès, redirection ou rafraîchissement.
 */
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "./api";
import { useToast } from "./Toast";
import { Button } from "./Button";
import { Alert } from "./Feedback";

export function serializeForm(form: HTMLFormElement): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const elements = Array.from(form.elements) as (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)[];
  for (const el of elements) {
    if (!el.name || el.disabled) continue;
    const type = el.dataset.type;
    if (el instanceof HTMLInputElement && el.type === "checkbox") {
      if (type === "array") {
        out[el.name] = (out[el.name] as string[] | undefined) ?? [];
        if (el.checked) (out[el.name] as string[]).push(el.value);
      } else out[el.name] = el.checked;
      continue;
    }
    if (el instanceof HTMLInputElement && el.type === "radio") {
      if (el.checked) out[el.name] = el.value;
      continue;
    }
    if (el instanceof HTMLSelectElement && el.multiple) {
      out[el.name] = Array.from(el.selectedOptions).map((o) => o.value);
      continue;
    }
    const v = el.value;
    if (type === "number") out[el.name] = v === "" ? null : Number(v);
    else if (type === "array") out[el.name] = v.split(",").map((x) => x.trim()).filter(Boolean);
    else if (type === "json") out[el.name] = v ? JSON.parse(v) : null;
    else out[el.name] = v;
  }
  return out;
}

export function ApiForm({
  action,
  method = "POST",
  children,
  submitLabel = "Enregistrer",
  successMessage = "Enregistré.",
  redirectTo,
  refresh = true,
  className,
  transform,
  extra,
  onSuccess,
  submitVariant = "primary",
  hideSubmit,
}: {
  action: string;
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  children: React.ReactNode;
  submitLabel?: string;
  successMessage?: string | null;
  redirectTo?: string | ((data: Record<string, unknown>) => string);
  refresh?: boolean;
  className?: string;
  /** Réservé aux composants client (une fonction ne traverse pas la frontière serveur/client). */
  transform?: (data: Record<string, unknown>) => unknown;
  /** Champs ajoutés au corps envoyé (utilisable depuis un composant serveur). */
  extra?: Record<string, unknown>;
  onSuccess?: (data: Record<string, unknown>) => void;
  submitVariant?: "primary" | "secondary" | "success" | "outline" | "danger";
  hideSubmit?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Clé d'idempotence stable jusqu'au succès : un double envoi (double clic, réseau instable) n'est traité qu'une fois.
  const idemKey = useRef<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    form.querySelectorAll("[data-field-error]").forEach((n) => n.remove());
    form.querySelectorAll("[aria-invalid]").forEach((n) => n.removeAttribute("aria-invalid"));
    setError(null);
    setBusy(true);
    try {
      const raw = { ...serializeForm(form), ...(extra ?? {}) };
      idemKey.current ??= Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
      const data = await api<Record<string, unknown>>(action, { method, body: transform ? transform(raw) : raw, idempotencyKey: idemKey.current });
      idemKey.current = null;
      if (successMessage) toast("success", successMessage);
      onSuccess?.(data);
      if (redirectTo) router.push(typeof redirectTo === "function" ? redirectTo(data) : redirectTo);
      else if (data && typeof data.redirectUrl === "string") router.push(data.redirectUrl);
      else if (refresh) router.refresh();
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : new ApiError("INTERNAL", "Erreur réseau. Vérifiez votre connexion.");
      for (const issue of apiErr.issues) {
        const field = form.querySelector(`[name="${issue.path.split(".")[0]}"]`);
        if (field) {
          field.setAttribute("aria-invalid", "true");
          const p = document.createElement("p");
          p.dataset.fieldError = "1";
          p.className = "mt-1 text-xs font-medium text-red-700";
          p.textContent = issue.message;
          field.insertAdjacentElement("afterend", p);
        }
      }
      setError(apiErr.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={className} noValidate>
      {error && <Alert tone="error" className="mb-4">{error}</Alert>}
      {children}
      {!hideSubmit && (
        <div className="mt-5 flex justify-end">
          <Button type="submit" disabled={busy} variant={submitVariant}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}
