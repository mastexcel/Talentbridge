import type { Metadata } from "next";
import { requireAdminUser } from "@/lib/session";
import { listUsers } from "@/application/admin.service";
import { ADMIN_PERMISSION_LABELS, ORG_ROLE_LABELS, type AdminPermission } from "@/domain/permissions";
import { PageHeader, Pagination } from "@/ui/Page";
import { Card } from "@/ui/Card";
import { Table, TBody, Td, Th, THead } from "@/ui/Table";
import { StatusBadge, DemoBadge, Badge } from "@/ui/Badge";
import { ActionButton } from "@/ui/ActionButton";
import { Input, Select } from "@/ui/Field";
import { Button } from "@/ui/Button";
import { AdminRoleEditor } from "@/ui/AdminRoleEditor";

export const metadata: Metadata = { title: "Utilisateurs" };

export default async function UsersAdmin({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const sp = await searchParams;
  const admin = await requireAdminUser("USERS_MANAGE");
  const page = Math.max(1, Number(sp.page) || 1);
  const r = await listUsers(admin, { q: sp.q?.slice(0, 80), status: ["ACTIVE", "SUSPENDED"].includes(sp.status ?? "") ? sp.status : undefined, page });
  const isSuper = admin.adminPermissions.includes("SUPER_ADMIN");
  return (
    <>
      <PageHeader title="Utilisateurs" description={`${r.total} compte(s)`} />
      <form className="mb-4 flex flex-wrap gap-2"><Input name="q" defaultValue={sp.q} placeholder="Nom ou email" className="max-w-xs" aria-label="Recherche" /><Select name="status" defaultValue={sp.status ?? ""} className="max-w-[180px]" aria-label="Statut"><option value="">Actifs et suspendus</option><option value="ACTIVE">Actifs</option><option value="SUSPENDED">Suspendus</option></Select><Button type="submit">Filtrer</Button></form>
      <Card>
        <Table><THead><tr><Th>Utilisateur</Th><Th>Profils</Th><Th>Statut</Th><Th>Dernière connexion</Th><Th>Actions</Th></tr></THead>
          <TBody>{r.items.map((u) => (
            <tr key={u.id}>
              <Td><p className="font-semibold">{u.firstName} {u.lastName} <DemoBadge show={u.isDemo} /></p><p className="text-xs text-slate">{u.email}{u.emailVerifiedAt ? " ✓" : " (non vérifié)"}</p></Td>
              <Td className="text-xs">{u.expertProfile && <Badge tone="orange">Consultant</Badge>} {u.memberships.map((m) => <span key={m.organization.name} className="block">{m.organization.name} — {ORG_ROLE_LABELS[m.role]}</span>)}{u.platformRole === "ADMIN" && <span className="block text-bordeaux-700">Admin : {u.adminPermissions.map((p) => ADMIN_PERMISSION_LABELS[p as AdminPermission]).join(", ")}</span>}</Td>
              <Td><StatusBadge status={u.status} label={u.status === "ACTIVE" ? "Actif" : "Suspendu"} /></Td>
              <Td className="text-xs">{u.lastLoginAt?.toLocaleString("fr-FR") ?? "—"}</Td>
              <Td className="space-y-1">
                {u.id !== admin.id && (u.status === "ACTIVE"
                  ? <ActionButton action="/api/v1/admin/user-status" body={{ userId: u.id, status: "SUSPENDED" }} variant="danger" prompt={{ key: "reason", label: "Motif de la suspension", required: true }} successMessage="Compte suspendu.">Suspendre</ActionButton>
                  : <ActionButton action="/api/v1/admin/user-status" body={{ userId: u.id, status: "ACTIVE" }} prompt={{ key: "reason", label: "Motif de la réactivation", required: true }} successMessage="Compte réactivé.">Réactiver</ActionButton>)}
                {isSuper && <AdminRoleEditor userId={u.id} permissions={u.adminPermissions as AdminPermission[]} />}
              </Td>
            </tr>
          ))}</TBody></Table>
      </Card>
      <Pagination page={page} pages={Math.max(1, Math.ceil(r.total / r.pageSize))} params={{ q: sp.q, status: sp.status }} basePath="/admin/utilisateurs" />
    </>
  );
}
