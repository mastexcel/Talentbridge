/** Accès à la session dans les Server Components / layouts. */
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserBySessionToken, SESSION_COOKIE, type SessionUser } from "@/application/auth.service";
import { homePathFor } from "./home";
import { hasAdminPermission, orgRoleCan, type AdminPermission, type OrgPermission, type OrgRole } from "@/domain/permissions";

/** Mémorisé pour la durée d'une requête : layout et page partagent une seule lecture. */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return getUserBySessionToken(token);
});

export async function requireUser(next = "/"): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect(`/connexion?suite=${encodeURIComponent(next)}`);
  return user;
}

export async function requireExpertUser(next = "/espace"): Promise<SessionUser & { expertProfile: NonNullable<SessionUser["expertProfile"]> }> {
  const user = await requireUser(next);
  if (!user.expertProfile) redirect(homePathFor(user));
  return user as SessionUser & { expertProfile: NonNullable<SessionUser["expertProfile"]> };
}

/** Organisation active + permission requise (sinon redirection). */
export async function requireOrgUser(permission: OrgPermission = "org.view", next = "/organisation") {
  const user = await requireUser(next);
  const membership = user.memberships.find((m) => m.organizationId === user.activeOrgId);
  if (!membership) redirect(homePathFor(user));
  if (!orgRoleCan(membership.role as OrgRole, permission)) redirect("/organisation?refus=1");
  return { user, membership, org: membership.organization, role: membership.role as OrgRole };
}

export async function requireAdminUser(permission: AdminPermission, next = "/admin"): Promise<SessionUser> {
  const user = await requireUser(next);
  if (user.platformRole !== "ADMIN") redirect(homePathFor(user));
  if (!hasAdminPermission(user, permission)) redirect("/admin?refus=1");
  return user;
}

export { homePathFor } from "./home";
