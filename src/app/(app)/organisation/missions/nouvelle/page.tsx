import type { Metadata } from "next";
import { prisma } from "@/infrastructure/db";
import { requireOrgUser } from "@/lib/session";
import { PageHeader } from "@/ui/Page";
import { MissionForm } from "@/ui/MissionForm";

export const metadata: Metadata = { title: "Nouvelle mission" };

export default async function NewMission() {
  await requireOrgUser("missions.manage", "/organisation/missions/nouvelle");
  const [countries, domains, skills] = await Promise.all([
    prisma.country.findMany({ where: { isActive: true }, orderBy: { nameFr: "asc" }, select: { code: true, nameFr: true } }),
    prisma.expertiseDomain.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, nameFr: true } }),
    prisma.skill.findMany({ where: { isActive: true }, orderBy: { nameFr: "asc" }, select: { id: true, nameFr: true, domainId: true } }),
  ]);
  return (
    <>
      <PageHeader title="Publier une mission" description="La mission est créée en brouillon ; vous la publiez quand elle est prête." back={{ href: "/organisation/missions", label: "Missions" }} />
      <MissionForm countries={countries} domains={domains} skills={skills} />
    </>
  );
}
