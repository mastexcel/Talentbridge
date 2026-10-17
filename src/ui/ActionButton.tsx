"use client";
/** Bouton relié à une action API réelle, avec confirmation optionnelle (actions sensibles). */
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "./api";
import { useToast } from "./Toast";
import { Button } from "./Button";

export function ActionButton({
  action,
  body,
  method = "POST",
  children,
  confirm,
  prompt,
  successMessage = "Action effectuée.",
  redirectTo,
  variant = "outline",
  size = "sm",
  className,
  download,
}: {
  action: string;
  body?: Record<string, unknown>;
  method?: "POST" | "PUT" | "DELETE" | "PATCH";
  children: React.ReactNode;
  confirm?: string;
  /** Demande un texte (motif, note) envoyé sous la clé indiquée */
  prompt?: { key: string; label: string; required?: boolean };
  successMessage?: string | null;
  redirectTo?: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "success" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
  download?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);

  async function run(extra: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      const data = await api<Record<string, unknown>>(action, { method, body: { ...(body ?? {}), ...extra } });
      if (successMessage) toast("success", successMessage);
      if (redirectTo) router.push(redirectTo);
      else if (typeof data?.redirectUrl === "string") router.push(data.redirectUrl);
      else router.refresh();
    } catch (e) {
      toast("error", e instanceof ApiError ? e.message : "Erreur réseau.");
    } finally {
      setBusy(false);
      setOpen(false);
      dialog.current?.close();
    }
  }

  function onClick() {
    if (download) {
      window.location.href = action;
      return;
    }
    if (confirm || prompt) {
      setOpen(true);
      dialog.current?.showModal();
      return;
    }
    void run();
  }

  return (
    <>
      <Button type="button" variant={variant} size={size} className={className} disabled={busy} onClick={onClick}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </Button>
      <dialog ref={dialog} className="m-auto w-[min(92vw,440px)] rounded-2xl p-0 shadow-lift backdrop:bg-ink/40" onClose={() => setOpen(false)}>
        {open && (
          <form
            method="dialog"
            className="p-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (prompt?.required && !text.trim()) return;
              void run(prompt ? { [prompt.key]: text } : {});
            }}
          >
            <p className="font-display text-lg font-bold text-ink">Confirmation</p>
            {confirm && <p className="mt-2 text-sm text-slate">{confirm}</p>}
            {prompt && (
              <label className="mt-3 block text-sm font-semibold">
                {prompt.label} {prompt.required && <span className="text-orange-700">*</span>}
                <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} className="mt-1 block min-h-20 w-full rounded-xl border border-line p-2 text-sm font-normal" />
              </label>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => dialog.current?.close()}>
                Annuler
              </Button>
              <Button type="submit" variant={variant === "danger" ? "danger" : "primary"} disabled={busy || (prompt?.required && !text.trim())}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirmer
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
