/**
 * Contrôle d'accès (RBAC) — deux niveaux indépendants :
 *  1. Plateforme : `platformRole` (USER | ADMIN) + permissions d'administration fines ;
 *  2. Organisation : rôle du membre dans CHAQUE organisation (un utilisateur peut en avoir plusieurs).
 * Les contrôles sont toujours appliqués côté serveur (services + routes API).
 */
export type OrgRole = "OWNER" | "ADMIN" | "RECRUITER" | "PROJECT_MANAGER" | "MEMBER" | "VIEWER";

export type AdminPermission =
  | "SUPER_ADMIN"
  | "USERS_MANAGE"
  | "EXPERTS_VERIFY"
  | "ORGS_VALIDATE"
  | "MARKETPLACE_MODERATE"
  | "FINANCE_MANAGE"
  | "CONFIG_MANAGE"
  | "CONTENT_MANAGE"
  | "COMMUNITY_MODERATE"
  | "CRM_MANAGE"
  | "ANALYTICS_VIEW"
  | "AUDIT_VIEW"
  | "ACADEMY_MANAGE";

export type OrgPermission =
  | "org.view"
  | "org.manage"
  | "members.manage"
  | "billing.manage"
  | "missions.manage"
  | "applications.review"
  | "experts.search"
  | "shortlists.manage"
  | "contracts.manage"
  | "projects.manage"
  | "tenders.manage"
  | "crm.use"
  | "reports.view";

/** Matrice rôle → permissions (documentée dans docs/ARCHITECTURE.md §RBAC). */
export const ORG_ROLE_PERMISSIONS: Record<OrgRole, readonly OrgPermission[]> = {
  OWNER: [
    "org.view", "org.manage", "members.manage", "billing.manage", "missions.manage", "applications.review",
    "experts.search", "shortlists.manage", "contracts.manage", "projects.manage", "tenders.manage", "crm.use", "reports.view",
  ],
  ADMIN: [
    "org.view", "org.manage", "members.manage", "billing.manage", "missions.manage", "applications.review",
    "experts.search", "shortlists.manage", "contracts.manage", "projects.manage", "tenders.manage", "crm.use", "reports.view",
  ],
  RECRUITER: ["org.view", "missions.manage", "applications.review", "experts.search", "shortlists.manage", "tenders.manage", "reports.view"],
  PROJECT_MANAGER: ["org.view", "experts.search", "shortlists.manage", "projects.manage", "tenders.manage", "reports.view"],
  MEMBER: ["org.view", "experts.search", "crm.use"],
  VIEWER: ["org.view", "reports.view"],
};

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  OWNER: "Propriétaire",
  ADMIN: "Administrateur",
  RECRUITER: "Recruteur",
  PROJECT_MANAGER: "Chef de projet",
  MEMBER: "Collaborateur",
  VIEWER: "Lecteur",
};

export const ADMIN_PERMISSION_LABELS: Record<AdminPermission, string> = {
  SUPER_ADMIN: "Super-administrateur",
  USERS_MANAGE: "Utilisateurs",
  EXPERTS_VERIFY: "Vérification des experts",
  ORGS_VALIDATE: "Validation des organisations",
  MARKETPLACE_MODERATE: "Modération marketplace",
  FINANCE_MANAGE: "Finances",
  CONFIG_MANAGE: "Configuration",
  CONTENT_MANAGE: "Contenus du site",
  COMMUNITY_MODERATE: "Modération communauté",
  CRM_MANAGE: "CRM Talent Bridge",
  ANALYTICS_VIEW: "Tableau de bord direction",
  AUDIT_VIEW: "Journal d'audit",
  ACADEMY_MANAGE: "Academy et certificats",
};

export function orgRoleCan(role: OrgRole | null | undefined, permission: OrgPermission): boolean {
  if (!role) return false;
  return ORG_ROLE_PERMISSIONS[role].includes(permission);
}

export interface PermissionSubject {
  platformRole: "USER" | "ADMIN";
  adminPermissions: readonly AdminPermission[];
  status?: string;
}

export function hasAdminPermission(user: PermissionSubject | null | undefined, permission: AdminPermission): boolean {
  if (!user || user.platformRole !== "ADMIN" || user.status === "SUSPENDED") return false;
  return user.adminPermissions.includes("SUPER_ADMIN") || user.adminPermissions.includes(permission);
}

/** Un propriétaire ne peut être retiré/rétrogradé que s'il en reste un autre. */
export function canChangeOwnerRole(ownersCount: number, targetIsOwner: boolean, newRole: OrgRole | null): boolean {
  if (!targetIsOwner) return true;
  if (newRole === "OWNER") return true;
  return ownersCount > 1;
}

/** Seul un OWNER peut nommer un autre OWNER ; un ADMIN gère les rôles inférieurs. */
export function canAssignRole(actorRole: OrgRole, newRole: OrgRole): boolean {
  if (actorRole === "OWNER") return true;
  if (actorRole === "ADMIN") return newRole !== "OWNER";
  return false;
}
