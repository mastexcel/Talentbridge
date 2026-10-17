import type { Metadata } from "next";
import { requireOrgUser } from "@/lib/session";
import { listMembers } from "@/application/organization.service";
import { ORG_ROLE_LABELS, ORG_ROLE_PERMISSIONS, orgRoleCan, type OrgRole } from "@/domain/permissions";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { ApiForm } from "@/ui/ApiForm";
import { ActionButton } from "@/ui/ActionButton";
import { Field, Input, Select } from "@/ui/Field";
import { Table, TBody, Td, Th, THead } from "@/ui/Table";
import { Badge } from "@/ui/Badge";
import { MemberRoleSelect } from "@/ui/MemberRoleSelect";

export const metadata: Metadata = { title: "Collaborateurs" };
const ROLES = Object.keys(ORG_ROLE_LABELS) as OrgRole[];

export default async function TeamPage() {
  const { user, org, role } = await requireOrgUser("org.view");
  const { members, invitations } = await listMembers(user, org.id);
  const canManage = orgRoleCan(role, "members.manage");
  return (
    <>
      <PageHeader title="Collaborateurs" description="Chaque collaborateur dispose d'un rôle qui détermine ses droits dans l'organisation." />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader title={`Membres (${members.length})`} />
          <Table><THead><tr><Th>Nom</Th><Th>Email</Th><Th>Rôle</Th><Th /></tr></THead>
            <TBody>{members.map((m) => (
              <tr key={m.id}><Td className="font-semibold">{m.user.firstName} {m.user.lastName}{m.userId === user.id && <Badge className="ml-2">Vous</Badge>}</Td><Td className="text-slate">{m.user.email}</Td>
                <Td>{canManage && m.userId !== user.id ? <MemberRoleSelect userId={m.userId} role={m.role} allowOwner={role === "OWNER"} /> : ORG_ROLE_LABELS[m.role]}</Td>
                <Td>{canManage && m.userId !== user.id && <ActionButton action="/api/v1/org/member-role" body={{ userId: m.userId, role: null }} variant="ghost" confirm={`Retirer ${m.user.firstName} ${m.user.lastName} de l'organisation ?`} successMessage="Membre retiré.">Retirer</ActionButton>}</Td></tr>
            ))}</TBody></Table>
          {invitations.length > 0 && (
            <CardBody className="border-t border-line">
              <p className="mb-2 text-sm font-semibold">Invitations en attente</p>
              {invitations.map((i) => <div key={i.id} className="flex items-center justify-between py-1 text-sm"><span>{i.email} — {ORG_ROLE_LABELS[i.role]} (expire le {i.expiresAt.toLocaleDateString("fr-FR")})</span>{canManage && <ActionButton action="/api/v1/org/revoke-invitation" body={{ invitationId: i.id }} variant="ghost" successMessage="Invitation révoquée.">Révoquer</ActionButton>}</div>)}
            </CardBody>
          )}
        </Card>
        <div className="space-y-6">
          {canManage && (
            <Card><CardHeader title="Inviter un collaborateur" /><CardBody>
              <ApiForm action="/api/v1/org/invite" submitLabel="Envoyer l'invitation" successMessage="Invitation envoyée par email." className="space-y-3">
                <Field label="Email" htmlFor="inv-email" required><Input id="inv-email" name="email" type="email" /></Field>
                <Field label="Rôle" htmlFor="inv-role"><Select id="inv-role" name="role" defaultValue="MEMBER">{ROLES.filter((r) => role === "OWNER" || r !== "OWNER").map((r) => <option key={r} value={r}>{ORG_ROLE_LABELS[r]}</option>)}</Select></Field>
              </ApiForm>
            </CardBody></Card>
          )}
          <Card><CardHeader title="Droits par rôle" /><CardBody className="space-y-2 text-xs">{ROLES.map((r) => <p key={r}><strong>{ORG_ROLE_LABELS[r]}</strong> : {ORG_ROLE_PERMISSIONS[r].length} permission(s) — {ORG_ROLE_PERMISSIONS[r].join(", ")}</p>)}</CardBody></Card>
        </div>
      </div>
    </>
  );
}
