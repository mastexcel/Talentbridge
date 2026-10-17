/**
 * Matching : chargement des candidats depuis la base (données déclarées/vérifiées uniquement),
 * exécution du moteur déterministe, persistance des scores pour validation humaine.
 *
 * Couche sémantique (facultative, non activée) : l'interface `SemanticReranker` permet
 * d'ajouter un ré-ordonnancement par similarité de texte (embeddings) sans modifier le moteur.
 * Elle ne peut que réordonner des candidats éligibles ; jamais ajouter de compétence.
 */
import type { Prisma } from "@prisma/client";
import { prisma, inTransaction, type Db } from "@/infrastructure/db";
import { DomainError } from "@/domain/errors";
import { extractSkills, MATCHING_ALGORITHM_VERSION, proposeTeam, rankCandidates, type CandidateProfile, type MatchResult, type MissionNeed, type TeamRole } from "@/domain/matching";
import { toMinor } from "@/domain/money";
import type { SessionUser } from "./auth.service";
import { requireOrgPermission } from "./access";
import { audit } from "./audit.service";
import { getMatchingWeights } from "./settings.service";

export interface SemanticReranker {
  rerank(needText: string, candidates: { expertId: string; text: string; score: number }[]): Promise<{ expertId: string; bonus: number }[]>;
}

const candidateSelect = {
  id: true,
  yearsExperience: true,
  availability: true,
  availableFrom: true,
  countryCode: true,
  mobility: true,
  mobilityCountries: true,
  remoteOk: true,
  languages: true,
  dailyRateMinor: true,
  rateCurrency: true,
  skills: { select: { skillId: true, level: true, years: true } },
  domains: { select: { domainId: true } },
  references: { select: { status: true } },
  availabilitySlots: { where: { kind: { in: ["BOOKED", "UNAVAILABLE"] } }, select: { startDate: true, endDate: true } },
} satisfies Prisma.ExpertProfileSelect;

type CandidateRow = Prisma.ExpertProfileGetPayload<{ select: typeof candidateSelect }>;

export function toCandidate(r: CandidateRow): CandidateProfile {
  return {
    expertId: r.id,
    skills: r.skills,
    yearsExperience: r.yearsExperience,
    domainIds: r.domains.map((d) => d.domainId),
    verifiedReferences: r.references.filter((x) => x.status === "VERIFIED").length,
    declaredReferences: r.references.filter((x) => x.status === "DECLARED").length,
    availability: r.availability,
    availableFrom: r.availableFrom,
    blockedSlots: r.availabilitySlots.map((s) => ({ start: s.startDate, end: s.endDate })),
    countryCode: r.countryCode,
    mobility: r.mobility,
    mobilityCountries: r.mobilityCountries,
    remoteOk: r.remoteOk,
    languages: r.languages,
    dailyRateMinor: r.dailyRateMinor,
    rateCurrency: r.rateCurrency,
  };
}

/** Pré-filtre SQL : experts actifs, visibles, partageant au moins une compétence requise. */
async function loadCandidates(skillIds: string[], excludeOrgId: string | null, db: Db) {
  const rows = await db.expertProfile.findMany({
    where: {
      visibility: { in: ["PUBLIC", "MEMBERS"] },
      user: { status: "ACTIVE", ...(excludeOrgId ? { memberships: { none: { organizationId: excludeOrgId } } } : {}) },
      ...(skillIds.length ? { skills: { some: { skillId: { in: skillIds } } } } : {}),
    },
    select: candidateSelect,
    take: 2000,
  });
  return rows.map(toCandidate);
}

async function missionNeed(missionId: string, db: Db) {
  const m = await db.mission.findUniqueOrThrow({ where: { id: missionId }, include: { requirements: { include: { skill: true } } } });
  const need: MissionNeed = {
    requirements: m.requirements.map((r) => ({ skillId: r.skillId, skillName: r.skill.nameFr, mandatory: r.mandatory, minLevel: r.minLevel })),
    experienceYearsMin: m.experienceYearsMin,
    domainId: m.domainId,
    languages: m.languages,
    countryCode: m.countryCode,
    workMode: m.workMode,
    startDate: m.startDate,
    durationDays: m.durationDays,
    budgetMaxMinor: m.budgetMaxMinor,
    currency: m.currency,
  };
  return { mission: m, need };
}

/** Calcule et enregistre les recommandations d'une mission (les décisions humaines existantes sont conservées). */
export async function runMatching(user: SessionUser, missionId: string, db: Db = prisma) {
  const { mission, need } = await missionNeed(missionId, db);
  requireOrgPermission(user, mission.organizationId, "experts.search");
  if (need.requirements.length === 0) throw new DomainError("VALIDATION", "Ajoutez des compétences requises à la mission pour lancer le matching.");
  const weights = await getMatchingWeights(db);
  const candidates = await loadCandidates(need.requirements.map((r) => r.skillId), mission.organizationId, db);
  const ranked = rankCandidates(need, candidates, weights);
  const top = ranked.slice(0, 50);
  await inTransaction(db, async (tx) => {
    for (const r of top) {
      const data = { score: r.score, breakdown: { criteria: r.breakdown, eligible: r.eligible, exclusionReasons: r.exclusionReasons, overBudget: r.overBudget, weights } as unknown as Prisma.InputJsonValue, missingSkills: r.missingSkills, algorithmVersion: MATCHING_ALGORITHM_VERSION, computedAt: new Date() };
      await tx.matchScore.upsert({ where: { missionId_expertId: { missionId, expertId: r.expertId } }, create: { missionId, expertId: r.expertId, ...data }, update: data });
    }
    await audit({ actorId: user.id, organizationId: mission.organizationId, action: "matching.run", entityType: "Mission", entityId: missionId, metadata: { candidates: candidates.length, stored: top.length, version: MATCHING_ALGORITHM_VERSION } }, tx);
  });
  return { evaluated: candidates.length, stored: top.length };
}

export async function getMatches(user: SessionUser, missionId: string, db: Db = prisma) {
  const mission = await db.mission.findUniqueOrThrow({ where: { id: missionId }, select: { organizationId: true } });
  requireOrgPermission(user, mission.organizationId, "experts.search");
  return db.matchScore.findMany({
    where: { missionId },
    orderBy: [{ score: "desc" }],
    include: {
      expert: {
        select: {
          id: true, slug: true, headline: true, countryCode: true, city: true, yearsExperience: true, dailyRateMinor: true, rateCurrency: true, availability: true, isDemo: true,
          user: { select: { firstName: true, lastName: true } },
          badges: { where: { revokedAt: null }, select: { badge: { select: { code: true, nameFr: true } } } },
        },
      },
    },
  });
}

/** Validation humaine : retenir (→ shortlist de la mission) ou écarter une recommandation. */
export async function decideMatch(user: SessionUser, matchId: string, decision: "ACCEPTED" | "DISMISSED", db: Db = prisma) {
  const match = await db.matchScore.findUnique({ where: { id: matchId }, include: { mission: { select: { id: true, organizationId: true, title: true } } } });
  if (!match) throw new DomainError("NOT_FOUND", "Recommandation introuvable.");
  requireOrgPermission(user, match.mission.organizationId, "shortlists.manage");
  await inTransaction(db, async (tx) => {
    await tx.matchScore.update({ where: { id: matchId }, data: { decision, decidedById: user.id, decidedAt: new Date() } });
    if (decision === "ACCEPTED") {
      let sl = await tx.shortlist.findFirst({ where: { organizationId: match.mission.organizationId, missionId: match.mission.id } });
      if (!sl) sl = await tx.shortlist.create({ data: { organizationId: match.mission.organizationId, missionId: match.mission.id, name: `Shortlist — ${match.mission.title}`.slice(0, 160), createdById: user.id } });
      await tx.shortlistEntry.upsert({ where: { shortlistId_expertId: { shortlistId: sl.id, expertId: match.expertId } }, create: { shortlistId: sl.id, expertId: match.expertId, note: `Matching ${match.score}/100` }, update: {} });
    }
    await audit({ actorId: user.id, organizationId: match.mission.organizationId, action: "matching.decision", entityType: "MatchScore", entityId: matchId, metadata: { decision, score: match.score } }, tx);
  });
}

/** Analyse d'un besoin exprimé en texte libre : compétences du référentiel repérées (rien n'est inventé). */
export async function analyzeNeed(text: string, db: Db = prisma) {
  const catalog = await db.skill.findMany({ where: { isActive: true }, select: { id: true, nameFr: true, nameEn: true, synonyms: true, domainId: true } });
  const found = extractSkills(text, catalog);
  const byId = new Map(catalog.map((s) => [s.id, s]));
  return found.map((f) => ({ skillId: f.id, nameFr: byId.get(f.id)!.nameFr, matched: f.matched, domainId: byId.get(f.id)!.domainId }));
}

/** Recherche rapide sans mission : classement d'experts pour une liste de compétences. */
export async function quickMatch(user: SessionUser | null, input: { skillIds: string[]; countryCode?: string; workMode?: MissionNeed["workMode"] }, db: Db = prisma): Promise<{ result: MatchResult; name: string; slug: string; headline: string | null }[]> {
  const skills = await db.skill.findMany({ where: { id: { in: input.skillIds } } });
  const need: MissionNeed = { requirements: skills.map((s) => ({ skillId: s.id, skillName: s.nameFr, mandatory: false, minLevel: 1 })), experienceYearsMin: 0, languages: [], countryCode: input.countryCode ?? "CI", workMode: input.workMode ?? "HYBRID" };
  const weights = await getMatchingWeights(db);
  const ranked = rankCandidates(need, await loadCandidates(input.skillIds, user?.activeOrgId ?? null, db), weights).filter((r) => r.eligible).slice(0, 10);
  const profiles = await db.expertProfile.findMany({ where: { id: { in: ranked.map((r) => r.expertId) } }, select: { id: true, slug: true, headline: true, user: { select: { firstName: true, lastName: true } } } });
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return ranked.map((r) => ({ result: r, name: `${byId.get(r.expertId)!.user.firstName} ${byId.get(r.expertId)!.user.lastName}`, slug: byId.get(r.expertId)!.slug, headline: byId.get(r.expertId)!.headline }));
}

/** Proposition d'équipe pluridisciplinaire pour une mission (rôles, compétences, budget, calendrier). */
export async function proposeTeamForMission(user: SessionUser, input: { missionId: string; budgetMax?: number | null; roles: { key: string; label: string; skillIds: string[]; days: number }[] }, db: Db = prisma) {
  const { mission, need } = await missionNeed(input.missionId, db);
  requireOrgPermission(user, mission.organizationId, "experts.search");
  const allSkillIds = [...new Set(input.roles.flatMap((r) => r.skillIds))];
  const skills = await db.skill.findMany({ where: { id: { in: allSkillIds } } });
  const byId = new Map(skills.map((s) => [s.id, s]));
  const roles: TeamRole[] = input.roles.map((r) => ({
    key: r.key,
    label: r.label,
    days: r.days,
    need: { ...need, requirements: r.skillIds.filter((id) => byId.has(id)).map((id) => ({ skillId: id, skillName: byId.get(id)!.nameFr, mandatory: true, minLevel: 1 })) },
  }));
  const weights = await getMatchingWeights(db);
  const candidates = await loadCandidates(allSkillIds, mission.organizationId, db);
  const budget = input.budgetMax != null ? toMinor(input.budgetMax, mission.currency) : mission.budgetMaxMinor;
  const proposal = proposeTeam(roles, candidates, budget, weights);
  const ids = proposal.assignments.map((a) => a.expertId).filter(Boolean) as string[];
  const profiles = await db.expertProfile.findMany({ where: { id: { in: ids } }, select: { id: true, slug: true, headline: true, user: { select: { firstName: true, lastName: true } } } });
  await audit({ actorId: user.id, organizationId: mission.organizationId, action: "matching.team", entityType: "Mission", entityId: mission.id, metadata: { roles: roles.length } }, db);
  return { proposal, profiles, currency: mission.currency };
}

/** Missions recommandées pour un expert : même moteur, appliqué aux missions ouvertes visibles. */
export async function recommendedMissions(expertId: string, limit = 10, db: Db = prisma) {
  const row = await db.expertProfile.findUniqueOrThrow({ where: { id: expertId }, select: { ...candidateSelect, userId: true } });
  const candidate = toCandidate(row);
  const skillIds = candidate.skills.map((s) => s.skillId);
  const missions = await db.mission.findMany({
    where: {
      status: { in: ["PUBLISHED", "SHORTLISTING"] },
      visibility: { in: ["PUBLIC", "MEMBERS"] },
      OR: [{ applicationDeadline: null }, { applicationDeadline: { gte: new Date() } }],
      requirements: { some: { skillId: { in: skillIds } } },
      applications: { none: { expertId } },
      organization: { members: { none: { userId: row.userId } } },
    },
    include: { requirements: { include: { skill: true } }, organization: { select: { name: true, status: true } }, domain: { select: { nameFr: true } } },
    take: 200,
  });
  const weights = await getMatchingWeights(db);
  return missions
    .map((m) => {
      const need: MissionNeed = {
        requirements: m.requirements.map((r) => ({ skillId: r.skillId, skillName: r.skill.nameFr, mandatory: r.mandatory, minLevel: r.minLevel })),
        experienceYearsMin: m.experienceYearsMin, domainId: m.domainId, languages: m.languages, countryCode: m.countryCode, workMode: m.workMode, startDate: m.startDate, durationDays: m.durationDays, budgetMaxMinor: m.budgetMaxMinor, currency: m.currency,
      };
      return { mission: m, match: rankCandidates(need, [candidate], weights)[0] };
    })
    .sort((a, b) => Number(b.match.eligible) - Number(a.match.eligible) || b.match.score - a.match.score)
    .slice(0, limit);
}
