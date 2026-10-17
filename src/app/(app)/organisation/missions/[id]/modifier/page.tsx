import type { Metadata } from "next";
import { prisma } from "@/infrastructure/db";
import { requireOrgUser } from "@/lib/session";
import { getOrgMission } from "@/application/mission.service";
import { fromMinor } from "@/domain/money";
import { PageHeader } from "@/ui/Page";
import { MissionForm } from "@/ui/MissionForm";

export const metadata: Metadata = { title: "Modifier la mission" };
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function EditMission({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireOrgUser("missions.manage");
  const m = await getOrgMission(user, id);
  const [countries, domains, skills] = await Promise.all([
    prisma.country.findMany({ where: { isActive: true }, orderBy: { nameFr: "asc" }, select: { code: true, nameFr: true } }),
    prisma.expertiseDomain.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, nameFr: true } }),
    prisma.skill.findMany({ where: { isActive: true }, orderBy: { nameFr: "asc" }, select: { id: true, nameFr: true, domainId: true } }),
  ]);
  return (
    <>
      <PageHeader title="Modifier la mission" back={{ href: `/organisation/missions/${id}`, label: m.title }} />
      <MissionForm missionId={id} countries={countries} domains={domains} skills={skills} initial={{
        title: m.title, description: m.description, objectives: m.objectives ?? "", expectedResults: m.expectedResults ?? "", domainId: m.domainId ?? "", experienceYearsMin: m.experienceYearsMin, languages: m.languages,
        countryCode: m.countryCode, city: m.city ?? "", workMode: m.workMode, durationDays: m.durationDays ?? undefined, startDate: iso(m.startDate) as never, applicationDeadline: iso(m.applicationDeadline) as never, // valeurs des champs date (chaînes ISO)
        budgetMin: m.budgetMinMinor != null ? fromMinor(m.budgetMinMinor, m.currency) : undefined, budgetMax: m.budgetMaxMinor != null ? fromMinor(m.budgetMaxMinor, m.currency) : undefined, currency: m.currency, visibility: m.visibility,
        requirements: m.requirements.map((r) => ({ skillId: r.skillId, mandatory: r.mandatory, minLevel: r.minLevel })),
      }} />
    </>
  );
}
