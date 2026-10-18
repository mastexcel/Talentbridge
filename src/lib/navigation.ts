/**
 * Navigation des espaces, calculée côté serveur selon les rôles (aucun lien vers une page
 * dont l'utilisateur ne peut pas se servir).
 */
import type { SessionUser } from "@/application/auth.service";
import { hasAdminPermission, orgRoleCan, type AdminPermission, type OrgRole } from "@/domain/permissions";
import type { NavSection } from "@/ui/Shell";

export function appNavigation(user: SessionUser): NavSection[] {
  const sections: NavSection[] = [];
  if (user.expertProfile) {
    sections.push({
      title: "Espace consultant",
      items: [
        { href: "/espace", label: "Tableau de bord", icon: "LayoutDashboard" },
        { href: "/espace/profil", label: "Mon profil", icon: "UserRound" },
        { href: "/espace/verification", label: "Vérification", icon: "ShieldCheck" },
        { href: "/espace/missions", label: "Missions recommandées", icon: "Sparkles" },
        { href: "/espace/candidatures", label: "Candidatures & invitations", icon: "Send" },
        { href: "/espace/contrats", label: "Contrats & revenus", icon: "FileSignature" },
        { href: "/espace/disponibilites", label: "Disponibilités", icon: "CalendarDays" },
        { href: "/espace/formations", label: "Formations & certificats", icon: "GraduationCap" },
        { href: "/espace/alertes", label: "Alertes appels d'offres", icon: "BellRing" },
      ],
    });
  }
  const m = user.memberships.find((x) => x.organizationId === user.activeOrgId);
  if (m) {
    const role = m.role as OrgRole;
    const can = (p: Parameters<typeof orgRoleCan>[1]) => orgRoleCan(role, p);
    sections.push({
      title: m.organization.name,
      items: [
        { href: "/organisation", label: "Tableau de bord", icon: "LayoutDashboard" },
        ...(can("missions.manage") || can("applications.review") ? [{ href: "/organisation/missions", label: "Missions", icon: "Briefcase" as const }] : []),
        ...(can("experts.search") ? [{ href: "/organisation/experts", label: "Rechercher des experts", icon: "Search" as const }, { href: "/organisation/shortlists", label: "Shortlists & favoris", icon: "ListChecks" as const }] : []),
        { href: "/projets", label: "Équipes projet", icon: "KanbanSquare" },
        { href: "/organisation/contrats", label: "Contrats", icon: "FileSignature" },
        ...(can("tenders.manage") ? [{ href: "/organisation/appels-offres", label: "Appels d'offres", icon: "FileSearch" as const }] : []),
        ...(can("crm.use") ? [{ href: "/organisation/crm", label: "CRM commercial", icon: "Handshake" as const }] : []),
        ...(can("reports.view") ? [{ href: "/organisation/rapports", label: "Rapports", icon: "BarChart3" as const }] : []),
        { href: "/organisation/equipe", label: "Collaborateurs", icon: "Users" },
        ...(can("org.manage") ? [{ href: "/organisation/parametres", label: "Paramètres", icon: "Settings" as const }] : []),
      ],
    });
  }
  sections.push({
    title: "Général",
    items: [
      ...(user.expertProfile && !m ? [{ href: "/projets", label: "Mes projets", icon: "KanbanSquare" as const }] : []),
      { href: "/messages", label: "Messages", icon: "MessageSquare" },
      { href: "/communaute", label: "Communauté", icon: "UsersRound" },
      { href: "/academy", label: "Academy", icon: "GraduationCap" },
      { href: "/facturation", label: "Abonnement & factures", icon: "CreditCard" },
      { href: "/parametres", label: "Paramètres", icon: "Settings" },
      ...(!m ? [{ href: "/organisation/creer", label: "Créer une organisation", icon: "Building2" as const }] : []),
      ...(user.platformRole === "ADMIN" ? [{ href: "/admin", label: "Administration", icon: "ShieldHalf" as const }] : []),
    ],
  });
  return sections;
}

export function adminNavigation(user: SessionUser): NavSection[] {
  const can = (p: AdminPermission) => hasAdminPermission(user, p);
  const pick = (items: (NavSection["items"][number] & { perm: AdminPermission })[]) => items.filter((i) => can(i.perm)).map((i) => ({ href: i.href, label: i.label, icon: i.icon }));
  return [
    { title: "Pilotage", items: [{ href: "/admin", label: "Vue d'ensemble", icon: "LayoutDashboard" }, ...pick([{ href: "/admin/direction", label: "CEO Dashboard", icon: "LineChart", perm: "ANALYTICS_VIEW" }, { href: "/admin/audit", label: "Journal d'audit", icon: "ScrollText", perm: "AUDIT_VIEW" }])] },
    {
      title: "Opérations",
      items: pick([
        { href: "/admin/utilisateurs", label: "Utilisateurs", icon: "Users", perm: "USERS_MANAGE" },
        { href: "/admin/verifications", label: "Vérifications", icon: "ShieldCheck", perm: "EXPERTS_VERIFY" },
        { href: "/admin/experts", label: "Experts", icon: "UserRound", perm: "EXPERTS_VERIFY" },
        { href: "/admin/organisations", label: "Organisations", icon: "Building2", perm: "ORGS_VALIDATE" },
        { href: "/admin/missions", label: "Marketplace", icon: "Briefcase", perm: "MARKETPLACE_MODERATE" },
        { href: "/admin/appels-offres", label: "Appels d'offres", icon: "FileSearch", perm: "MARKETPLACE_MODERATE" },
        { href: "/admin/moderation", label: "Modération", icon: "Flag", perm: "COMMUNITY_MODERATE" },
        { href: "/admin/certificats", label: "Academy & certificats", icon: "Award", perm: "ACADEMY_MANAGE" },
      ]),
    },
    {
      title: "Finances",
      items: pick([
        { href: "/admin/finances", label: "Tableau financier", icon: "Wallet", perm: "FINANCE_MANAGE" },
        { href: "/admin/factures", label: "Factures & paiements", icon: "Receipt", perm: "FINANCE_MANAGE" },
        { href: "/admin/offres", label: "Offres & tarifs", icon: "Tags", perm: "FINANCE_MANAGE" },
      ]),
    },
    {
      title: "Configuration",
      items: pick([
        { href: "/admin/configuration", label: "Paramètres & référentiels", icon: "SlidersHorizontal", perm: "CONFIG_MANAGE" },
        { href: "/admin/contenus", label: "Contenus du site", icon: "PanelsTopLeft", perm: "CONTENT_MANAGE" },
        { href: "/admin/contacts", label: "Demandes de contact", icon: "Inbox", perm: "CONTENT_MANAGE" },
      ]),
    },
    { title: "Retour", items: [{ href: "/parametres", label: "Mon compte", icon: "Settings" }, { href: "/", label: "Site public", icon: "Globe" }] },
  ].filter((s) => s.items.length > 0) as NavSection[];
}
