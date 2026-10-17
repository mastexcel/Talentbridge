/**
 * Profils experts : édition par l'expert, complétude, annuaire (moteur de recherche),
 * profil public (sans coordonnées), favoris et comparaison.
 */
import type { Prisma } from "@prisma/client";
import { prisma, inTransaction, type Db } from "@/infrastructure/db";
import { DomainError } from "@/domain/errors";
import { computeCompleteness } from "@/domain/profile";
import { toMinor } from "@/domain/money";
import type { ExpertProfileInput, ExpertSearch } from "./schemas";
import type { SessionUser } from "./auth.service";
import { audit } from "./audit.service";

export const PAGE_SIZE = 12;

/** Badges actifs = non révoqués et non expirés. */
export const activeBadgeWhere = (now = new Date()): Prisma.ExpertBadgeWhereInput => ({ revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] });

export async function recomputeCompleteness(expertId: string, db: Db = prisma) {
  const p = await db.expertProfile.findUniqueOrThrow({
    where: { id: expertId },
    include: { _count: { select: { domains: true, skills: true, experiences: true, qualifications: true, references: true, portfolio: true } } },
  });
  const { score, missing } = computeCompleteness({
    hasPhoto: !!p.photoFileId,
    headline: p.headline,
    bio: p.bio,
    countryCode: p.countryCode,
    city: p.city,
    languages: p.languages,
    domains: p._count.domains,
    skills: p._count.skills,
    experiences: p._count.experiences,
    qualifications: p._count.qualifications,
    references: p._count.references,
    portfolio: p._count.portfolio,
    hasCv: !!p.cvFileId,
    hasRate: !!p.dailyRateMinor,
    yearsExperience: p.yearsExperience,
  });
  if (score !== p.completeness) await db.expertProfile.update({ where: { id: expertId }, data: { completeness: score } });
  return { score, missing };
}

export async function getMyProfile(expertId: string, db: Db = prisma) {
  const profile = await db.expertProfile.findUniqueOrThrow({
    where: { id: expertId },
    include: {
      user: { select: { firstName: true, lastName: true, email: true, phone: true } },
      domains: { include: { domain: true } },
      skills: { include: { skill: true }, orderBy: { level: "desc" } },
      experiences: { orderBy: { startDate: "desc" } },
      qualifications: { orderBy: { year: "desc" } },
      references: true,
      portfolio: true,
      availabilitySlots: { where: { endDate: { gte: new Date(Date.now() - 30 * 86_400_000) } }, orderBy: { startDate: "asc" } },
      badges: { where: activeBadgeWhere(), include: { badge: true } },
      verifications: { orderBy: { createdAt: "desc" } },
    },
  });
  const completeness = await recomputeCompleteness(expertId, db);
  return { profile, completeness };
}

export async function updateProfile(user: SessionUser, expertId: string, input: ExpertProfileInput, db: Db = prisma) {
  const currency = input.rateCurrency ?? "XOF";
  await inTransaction(db, async (tx) => {
    await tx.expertProfile.update({
      where: { id: expertId },
      data: {
        headline: input.headline,
        bio: input.bio,
        countryCode: input.countryCode,
        city: input.city,
        yearsExperience: input.yearsExperience,
        languages: input.languages,
        availability: input.availability,
        availableFrom: input.availableFrom,
        mobility: input.mobility,
        remoteOk: input.remoteOk,
        mobilityCountries: input.mobilityCountries,
        dailyRateMinor: input.dailyRate != null ? toMinor(input.dailyRate, currency) : null,
        rateCurrency: input.dailyRate != null ? currency : null,
        missionPreferences: input.missionPreferences,
        visibility: input.visibility,
      },
    });
    await tx.expertDomain.deleteMany({ where: { expertId } });
    if (input.domainIds.length) await tx.expertDomain.createMany({ data: input.domainIds.map((domainId) => ({ expertId, domainId })), skipDuplicates: true });
    if (input.visibility === "PUBLIC") {
      await tx.consent.create({ data: { userId: user.id, type: "PROFILE_PUBLIC", granted: true, version: "2026-10" } });
    }
  });
  return recomputeCompleteness(expertId, db);
}

export async function setSkills(expertId: string, skills: { skillId: string; level: number; years: number }[], db: Db = prisma) {
  const known = await db.skill.findMany({ where: { id: { in: skills.map((s) => s.skillId) }, isActive: true }, select: { id: true } });
  if (known.length !== new Set(skills.map((s) => s.skillId)).size) throw new DomainError("VALIDATION", "Compétence inconnue du référentiel.");
  await inTransaction(db, async (tx) => {
    await tx.expertSkill.deleteMany({ where: { expertId } });
    await tx.expertSkill.createMany({ data: skills.map((s) => ({ expertId, ...s })), skipDuplicates: true });
  });
  return recomputeCompleteness(expertId, db);
}

type SubItem = "experience" | "qualification" | "reference" | "portfolio" | "slot";

/** Ajout d'un élément au profil (toujours rattaché à l'expert connecté). */
export async function addItem(expertId: string, kind: SubItem, data: Record<string, unknown>, db: Db = prisma) {
  switch (kind) {
    case "experience":
      await db.professionalExperience.create({ data: { expertId, ...(data as Omit<Prisma.ProfessionalExperienceUncheckedCreateInput, "expertId">) } });
      break;
    case "qualification": {
      const fileId = data.fileId as string | null;
      if (fileId) {
        const f = await db.storedFile.findUnique({ where: { id: fileId }, include: { owner: { select: { expertProfile: { select: { id: true } } } } } });
        if (!f || f.owner.expertProfile?.id !== expertId) throw new DomainError("VALIDATION", "Justificatif invalide.");
      }
      // Toujours « déclaré » à la création : seule la vérification administrative peut passer à VERIFIED.
      await db.qualification.create({ data: { expertId, ...(data as Omit<Prisma.QualificationUncheckedCreateInput, "expertId">), status: "DECLARED" } });
      break;
    }
    case "reference":
      await db.expertReference.create({ data: { expertId, ...(data as Omit<Prisma.ExpertReferenceUncheckedCreateInput, "expertId">), status: "DECLARED" } });
      break;
    case "portfolio":
      await db.portfolioItem.create({ data: { expertId, ...(data as Omit<Prisma.PortfolioItemUncheckedCreateInput, "expertId">) } });
      break;
    case "slot":
      await db.availabilitySlot.create({ data: { expertId, ...(data as Omit<Prisma.AvailabilitySlotUncheckedCreateInput, "expertId">) } });
      break;
  }
  return recomputeCompleteness(expertId, db);
}

export async function removeItem(expertId: string, kind: SubItem, id: string, db: Db = prisma) {
  const where = { id, expertId };
  const res =
    kind === "experience" ? await db.professionalExperience.deleteMany({ where })
    : kind === "qualification" ? await db.qualification.deleteMany({ where: { ...where, status: { not: "VERIFIED" } } })
    : kind === "reference" ? await db.expertReference.deleteMany({ where: { ...where, status: { not: "VERIFIED" } } })
    : kind === "portfolio" ? await db.portfolioItem.deleteMany({ where })
    : await db.availabilitySlot.deleteMany({ where });
  if (res.count === 0) throw new DomainError("NOT_FOUND", "Élément introuvable (un élément vérifié ne peut pas être supprimé).");
  return recomputeCompleteness(expertId, db);
}

export async function setProfileFile(user: SessionUser, expertId: string, field: "photoFileId" | "cvFileId", fileId: string, db: Db = prisma) {
  const f = await db.storedFile.findUnique({ where: { id: fileId } });
  const purpose = field === "photoFileId" ? "PHOTO" : "CV";
  if (!f || f.ownerUserId !== user.id || f.purpose !== purpose) throw new DomainError("VALIDATION", "Fichier invalide.");
  await db.expertProfile.update({ where: { id: expertId }, data: { [field]: fileId } });
  return recomputeCompleteness(expertId, db);
}

// ── Annuaire ─────────────────────────────────────────────────

/** Visibilités autorisées pour le lecteur (anonyme : PUBLIC ; connecté : + MEMBERS). */
function visibleTo(user: SessionUser | null): Prisma.ExpertProfileWhereInput {
  return { visibility: user ? { in: ["PUBLIC", "MEMBERS"] } : "PUBLIC", user: { status: "ACTIVE" } };
}

const BADGE_FILTER: Record<NonNullable<ExpertSearch["certified"]>, string> = { identity: "IDENTITY_VERIFIED", documents: "DOCUMENTS_VERIFIED", skills: "SKILLS_ASSESSED" };

export const directoryCardSelect = {
  id: true,
  slug: true,
  headline: true,
  countryCode: true,
  city: true,
  yearsExperience: true,
  languages: true,
  availability: true,
  mobility: true,
  dailyRateMinor: true,
  rateCurrency: true,
  averageRating: true,
  ratingsCount: true,
  completedMissions: true,
  photoFileId: true,
  isDemo: true,
  user: { select: { firstName: true, lastName: true } },
  domains: { select: { domain: { select: { nameFr: true, slug: true } } } },
  skills: { select: { level: true, skill: { select: { nameFr: true, slug: true } } }, orderBy: { level: "desc" as const }, take: 6 },
  badges: { where: activeBadgeWhere(), select: { badge: { select: { code: true, kind: true, nameFr: true } } } },
} satisfies Prisma.ExpertProfileSelect;

export type DirectoryCard = Prisma.ExpertProfileGetPayload<{ select: typeof directoryCardSelect }>;

export async function searchExperts(user: SessionUser | null, f: ExpertSearch, db: Db = prisma) {
  const and: Prisma.ExpertProfileWhereInput[] = [visibleTo(user), { completeness: { gte: 30 } }];
  if (f.q) {
    const q = f.q;
    and.push({
      OR: [
        { headline: { contains: q, mode: "insensitive" } },
        { bio: { contains: q, mode: "insensitive" } },
        { user: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }] } },
        { skills: { some: { skill: { OR: [{ nameFr: { contains: q, mode: "insensitive" } }, { nameEn: { contains: q, mode: "insensitive" } }] } } } },
      ],
    });
  }
  if (f.country) and.push({ countryCode: f.country });
  if (f.city) and.push({ city: { contains: f.city, mode: "insensitive" } });
  if (f.domain) and.push({ domains: { some: { domain: { slug: f.domain } } } });
  if (f.skill) and.push({ skills: { some: { skill: { slug: f.skill } } } });
  if (f.language) and.push({ languages: { has: f.language } });
  if (f.minYears) and.push({ yearsExperience: { gte: f.minYears } });
  if (f.availability) and.push({ availability: f.availability === "AVAILABLE" ? "AVAILABLE" : { in: ["AVAILABLE", "PARTIAL"] } });
  if (f.mobility) {
    const order = ["LOCAL", "NATIONAL", "REGIONAL", "INTERNATIONAL"] as const;
    and.push({ mobility: { in: order.slice(order.indexOf(f.mobility)) as unknown as (typeof order)[number][] } });
  }
  if (f.certified) and.push({ badges: { some: { ...activeBadgeWhere(), badge: { code: BADGE_FILTER[f.certified] } } } });
  // Fourchette tarifaire : comparée dans la devise XOF (les tarifs en autre devise sont exclus du filtre).
  if (f.maxRate != null || f.minRate != null) {
    and.push({ rateCurrency: "XOF", dailyRateMinor: { ...(f.minRate != null ? { gte: Math.round(f.minRate) } : {}), ...(f.maxRate != null ? { lte: Math.round(f.maxRate) } : {}) } });
  }
  const where: Prisma.ExpertProfileWhereInput = { AND: and };
  const orderBy: Prisma.ExpertProfileOrderByWithRelationInput[] =
    f.sort === "experience" ? [{ yearsExperience: "desc" }]
    : f.sort === "rating" ? [{ averageRating: { sort: "desc", nulls: "last" } }, { ratingsCount: "desc" }]
    : f.sort === "recent" ? [{ createdAt: "desc" }]
    : [{ completeness: "desc" }, { completedMissions: "desc" }, { yearsExperience: "desc" }];
  const [items, total] = await Promise.all([
    db.expertProfile.findMany({ where, orderBy: [...orderBy, { id: "asc" }], take: PAGE_SIZE, skip: (f.page - 1) * PAGE_SIZE, select: directoryCardSelect }),
    db.expertProfile.count({ where }),
  ]);
  return { items, total, page: f.page, pageSize: PAGE_SIZE, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Profil public : coordonnées et contacts des référents JAMAIS exposés. */
export async function getPublicProfile(user: SessionUser | null, slug: string, db: Db = prisma) {
  const p = await db.expertProfile.findUnique({
    where: { slug },
    select: {
      ...directoryCardSelect,
      bio: true,
      userId: true,
      visibility: true,
      availableFrom: true,
      remoteOk: true,
      mobilityCountries: true,
      missionPreferences: true,
      cvFileId: true,
      experiences: { orderBy: { startDate: "desc" }, select: { id: true, title: true, employer: true, countryCode: true, sector: true, startDate: true, endDate: true, description: true } },
      qualifications: { orderBy: { year: "desc" }, select: { id: true, kind: true, title: true, institution: true, year: true, status: true } },
      references: { select: { id: true, contactOrg: true, missionTitle: true, year: true, status: true } },
      portfolio: { select: { id: true, title: true, description: true, url: true, year: true } },
      skills: { select: { level: true, years: true, skill: { select: { nameFr: true, slug: true } } }, orderBy: { level: "desc" } },
      reviews: { where: { isPublic: true }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, rating: true, comment: true, createdAt: true, organization: { select: { name: true } } } },
      availabilitySlots: { where: { endDate: { gte: new Date() }, kind: { in: ["BOOKED", "UNAVAILABLE"] } }, select: { startDate: true, endDate: true, kind: true } },
    },
  });
  if (!p) return null;
  const isSelf = user?.id === p.userId;
  const isAdmin = user?.platformRole === "ADMIN";
  if (!isSelf && !isAdmin) {
    if (p.visibility === "PRIVATE") {
      // Visible seulement des organisations auprès desquelles l'expert a candidaté.
      const orgIds = user?.memberships.map((m) => m.organizationId) ?? [];
      const applied = orgIds.length ? await db.application.findFirst({ where: { expertId: p.id, mission: { organizationId: { in: orgIds } } }, select: { id: true } }) : null;
      if (!applied) return null;
    }
    if (p.visibility === "MEMBERS" && !user) return null;
  }
  return { ...p, isSelf };
}

export async function toggleFavorite(userId: string, expertId: string, db: Db = prisma) {
  const key = { userId_expertId: { userId, expertId } };
  const existing = await db.favorite.findUnique({ where: key });
  if (existing) {
    await db.favorite.delete({ where: key });
    return { favorite: false };
  }
  await db.expertProfile.findUniqueOrThrow({ where: { id: expertId }, select: { id: true } });
  await db.favorite.create({ data: { userId, expertId } });
  return { favorite: true };
}

export async function listFavorites(userId: string, db: Db = prisma) {
  return db.favorite.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, include: { expert: { select: directoryCardSelect } } });
}

/** Comparaison côte à côte (2 à 4 experts visibles). */
export async function compareExperts(user: SessionUser | null, ids: string[], db: Db = prisma) {
  if (ids.length < 2 || ids.length > 4) throw new DomainError("VALIDATION", "Sélectionnez de 2 à 4 experts à comparer.");
  return db.expertProfile.findMany({ where: { id: { in: ids }, ...visibleTo(user) }, select: { ...directoryCardSelect, references: { where: { status: "VERIFIED" }, select: { id: true } }, qualifications: { select: { title: true, status: true } } } });
}

export async function logProfileView(user: SessionUser | null, expertId: string, db: Db = prisma) {
  if (!user) return;
  await audit({ actorId: user.id, organizationId: user.activeOrgId, action: "expert.view", entityType: "ExpertProfile", entityId: expertId }, db);
}
