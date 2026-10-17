"use client";
import { ADMIN_PERMISSION_LABELS, type AdminPermission } from "@/domain/permissions";
import { ApiForm } from "./ApiForm";

/** Attribution des permissions d'administration (super-administrateur uniquement, contrôlé côté serveur). */
export function AdminRoleEditor({ userId, permissions }: { userId: string; permissions: AdminPermission[] }) {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-slate">Droits d'administration</summary>
      <ApiForm action="/api/v1/admin/admin-role" submitLabel="Enregistrer" successMessage="Droits mis à jour." className="mt-2 grid grid-cols-2 gap-1" transform={(d) => ({ userId, permissions: d.permissions ?? [] })}>
        {(Object.keys(ADMIN_PERMISSION_LABELS) as AdminPermission[]).map((p) => (
          <label key={p} className="flex items-center gap-1"><input type="checkbox" name="permissions" value={p} data-type="array" defaultChecked={permissions.includes(p)} className="accent-orange-600" />{ADMIN_PERMISSION_LABELS[p]}</label>
        ))}
      </ApiForm>
    </details>
  );
}
