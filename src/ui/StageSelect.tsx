"use client";
import { useRouter } from "next/navigation";
import { OPPORTUNITY_STAGE_LABELS, OPPORTUNITY_STAGES, type OpportunityStage } from "@/domain/workflows";
import { api, ApiError } from "./api";
import { useToast } from "./Toast";

/** Déplacement d'une opportunité dans le pipeline (motif exigé pour « Perdu »). */
export function StageSelect({ id, stage }: { id: string; stage: OpportunityStage }) {
  const router = useRouter();
  const toast = useToast();
  return (
    <select
      aria-label="Étape"
      defaultValue={stage}
      className="mt-2 h-8 w-full rounded-lg border border-line px-1 text-xs"
      onChange={async (e) => {
        const next = e.target.value as OpportunityStage;
        const lostReason = next === "LOST" ? window.prompt("Motif de perte ?") : null;
        if (next === "LOST" && !lostReason) {
          e.target.value = stage;
          return;
        }
        try {
          await api("/api/v1/crm/move", { body: { id, stage: next, lostReason } });
          toast("success", `Déplacée vers « ${OPPORTUNITY_STAGE_LABELS[next]} ».`);
          router.refresh();
        } catch (err) {
          toast("error", err instanceof ApiError ? err.message : "Erreur.");
          e.target.value = stage;
        }
      }}
    >
      {OPPORTUNITY_STAGES.map((s) => <option key={s} value={s}>{OPPORTUNITY_STAGE_LABELS[s]}</option>)}
    </select>
  );
}
