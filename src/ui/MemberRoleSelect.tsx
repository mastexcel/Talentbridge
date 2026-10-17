"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ORG_ROLE_LABELS, type OrgRole } from "@/domain/permissions";
import { api, ApiError } from "./api";
import { useToast } from "./Toast";

/** Changement de rôle d'un membre (contrôlé côté serveur : propriétaire unique protégé). */
export function MemberRoleSelect({ userId, role, allowOwner }: { userId: string; role: OrgRole; allowOwner: boolean }) {
  const [value, setValue] = useState(role);
  const toast = useToast();
  const router = useRouter();
  return (
    <select
      aria-label="Rôle"
      value={value}
      className="h-9 rounded-lg border border-line px-2 text-sm"
      onChange={async (e) => {
        const next = e.target.value as OrgRole;
        try {
          await api("/api/v1/org/member-role", { body: { userId, role: next } });
          setValue(next);
          toast("success", "Rôle mis à jour.");
          router.refresh();
        } catch (err) {
          toast("error", err instanceof ApiError ? err.message : "Erreur.");
        }
      }}
    >
      {(Object.keys(ORG_ROLE_LABELS) as OrgRole[]).filter((r) => allowOwner || r !== "OWNER" || r === role).map((r) => <option key={r} value={r}>{ORG_ROLE_LABELS[r]}</option>)}
    </select>
  );
}
