"use client";
import { useRouter } from "next/navigation";
import { TASK_STATUS_LABELS } from "./labels";
import { api, ApiError } from "./api";
import { useToast } from "./Toast";

/** Déplacement d'une carte Kanban (alternative accessible au clavier au glisser-déposer). */
export function TaskMove({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const toast = useToast();
  return (
    <select
      aria-label="Colonne"
      defaultValue={status}
      className="h-8 rounded-lg border border-line px-1 text-xs"
      onChange={async (e) => {
        try {
          await api(`/api/v1/tasks/${id}/move`, { body: { status: e.target.value } });
          router.refresh();
        } catch (err) {
          toast("error", err instanceof ApiError ? err.message : "Erreur.");
          e.target.value = status;
        }
      }}
    >
      {Object.entries(TASK_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
  );
}
