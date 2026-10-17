import { describe, expect, it } from "vitest";
import { canAssignRole, canChangeOwnerRole, hasAdminPermission, orgRoleCan } from "@/domain/permissions";

describe("RBAC organisation", () => {
  it("applique la matrice des rôles", () => {
    expect(orgRoleCan("VIEWER", "missions.manage")).toBe(false);
    expect(orgRoleCan("VIEWER", "reports.view")).toBe(true);
    expect(orgRoleCan("RECRUITER", "applications.review")).toBe(true);
    expect(orgRoleCan("RECRUITER", "billing.manage")).toBe(false);
    expect(orgRoleCan("PROJECT_MANAGER", "projects.manage")).toBe(true);
    expect(orgRoleCan("MEMBER", "contracts.manage")).toBe(false);
    expect(orgRoleCan(null, "org.view")).toBe(false);
  });
  it("protège le dernier propriétaire et la nomination des propriétaires", () => {
    expect(canChangeOwnerRole(1, true, "ADMIN")).toBe(false);
    expect(canChangeOwnerRole(2, true, null)).toBe(true);
    expect(canAssignRole("ADMIN", "OWNER")).toBe(false);
    expect(canAssignRole("OWNER", "OWNER")).toBe(true);
    expect(canAssignRole("RECRUITER", "VIEWER")).toBe(false);
  });
});

describe("permissions d'administration", () => {
  it("exige le rôle ADMIN et la permission (ou SUPER_ADMIN), jamais pour un compte suspendu", () => {
    expect(hasAdminPermission({ platformRole: "USER", adminPermissions: ["SUPER_ADMIN"] }, "AUDIT_VIEW")).toBe(false);
    expect(hasAdminPermission({ platformRole: "ADMIN", adminPermissions: ["EXPERTS_VERIFY"] }, "FINANCE_MANAGE")).toBe(false);
    expect(hasAdminPermission({ platformRole: "ADMIN", adminPermissions: ["SUPER_ADMIN"] }, "FINANCE_MANAGE")).toBe(true);
    expect(hasAdminPermission({ platformRole: "ADMIN", adminPermissions: ["SUPER_ADMIN"], status: "SUSPENDED" }, "FINANCE_MANAGE")).toBe(false);
  });
});
