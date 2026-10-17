/**
 * Contrôles d'accès serveur communs à tous les services.
 * Règle d'isolation : une donnée d'organisation n'est accessible qu'à ses membres
 * (selon leur rôle) ou à un administrateur plateforme disposant de la permission adéquate.
 */
import { DomainError } from "@/domain/errors";
import { hasAdminPermission, orgRoleCan, type AdminPermission, type OrgPermission, type OrgRole } from "@/domain/permissions";
import type { SessionUser } from "./auth.service";

export function membershipOf(user: SessionUser, organizationId: string) {
  return user.memberships.find((m) => m.organizationId === organizationId) ?? null;
}

export function roleIn(user: SessionUser, organizationId: string): OrgRole | null {
  return (membershipOf(user, organizationId)?.role as OrgRole | undefined) ?? null;
}

/** Exige une permission dans l'organisation (lève FORBIDDEN sinon). */
export function requireOrgPermission(user: SessionUser | null, organizationId: string | null | undefined, permission: OrgPermission): { organizationId: string; role: OrgRole } {
  if (!user) throw new DomainError("UNAUTHENTICATED", "Connectez-vous pour continuer.");
  if (!organizationId) throw new DomainError("FORBIDDEN", "Aucune organisation sélectionnée.");
  const role = roleIn(user, organizationId);
  if (!role || !orgRoleCan(role, permission)) throw new DomainError("FORBIDDEN", "Votre rôle dans cette organisation ne permet pas cette action.");
  return { organizationId, role };
}

/** Organisation active de la session + permission. */
export function requireActiveOrg(user: SessionUser | null, permission: OrgPermission) {
  return requireOrgPermission(user, user?.activeOrgId, permission);
}

export function requireAdmin(user: SessionUser | null, permission: AdminPermission): SessionUser {
  if (!user) throw new DomainError("UNAUTHENTICATED", "Connectez-vous pour continuer.");
  if (!hasAdminPermission(user, permission)) throw new DomainError("FORBIDDEN", "Permission d'administration insuffisante.");
  return user;
}

export function requireExpert(user: SessionUser | null): { user: SessionUser; expertId: string } {
  if (!user) throw new DomainError("UNAUTHENTICATED", "Connectez-vous pour continuer.");
  if (!user.expertProfile) throw new DomainError("FORBIDDEN", "Cette action est réservée aux consultants.");
  return { user, expertId: user.expertProfile.id };
}

export function isPlatformAdmin(user: SessionUser | null | undefined): boolean {
  return !!user && user.platformRole === "ADMIN";
}
