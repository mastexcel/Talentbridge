"use client";
/** Dépôt de fichier : envoi multipart vers /api/v1/files, puis action de rattachement facultative. */
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { api, ApiError } from "./api";
import { useToast } from "./Toast";
import { Button } from "./Button";

export function FileUpload({ purpose, accept, label = "Déposer un fichier", attach, organizationId, onUploaded }: { purpose: string; accept?: string; label?: string; attach?: { action: string; body?: Record<string, unknown>; key?: string; method?: "POST" | "PUT" }; organizationId?: string; onUploaded?: (file: { id: string; filename: string }) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast("error", "Fichier trop volumineux (10 Mo maximum).");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("purpose", purpose);
      if (organizationId) fd.set("organizationId", organizationId);
      const res = await api<{ file: { id: string; filename: string } }>("/api/v1/files", { body: fd });
      setName(res.file.filename);
      onUploaded?.(res.file);
      if (attach) await api(attach.action, { method: attach.method ?? "POST", body: { ...(attach.body ?? {}), [attach.key ?? "fileId"]: res.file.id } });
      toast("success", "Fichier déposé.");
      if (attach) router.refresh();
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Échec du dépôt.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      <input ref={input} type="file" className="sr-only" accept={accept} onChange={onChange} aria-label={label} />
      <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {label}
      </Button>
      {name && <span className="text-xs text-slate">{name}</span>}
    </div>
  );
}
