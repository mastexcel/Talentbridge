import Link from "next/link";
import Image from "next/image";
import { BadgeCheck, Briefcase, Clock, MapPin, Star } from "lucide-react";
import { formatMoney } from "@/domain/money";
import { Badge, DemoBadge } from "./Badge";
import { initials } from "@/domain/text";

export const AVAILABILITY_LABELS = { AVAILABLE: "Disponible", PARTIAL: "Disponibilité partielle", UNAVAILABLE: "Indisponible" } as const;
export const WORK_MODE_LABELS = { ONSITE: "Sur site", REMOTE: "À distance", HYBRID: "Hybride" } as const;
export const MOBILITY_LABELS = { LOCAL: "Locale", NATIONAL: "Nationale", REGIONAL: "Régionale", INTERNATIONAL: "Internationale" } as const;

export function Avatar({ first, last, photoFileId, size = 48 }: { first: string; last: string; photoFileId?: string | null; size?: number }) {
  if (photoFileId) return <Image src={`/api/v1/files/${photoFileId}`} alt="" width={size} height={size} unoptimized className="rounded-full object-cover" style={{ width: size, height: size }} />;
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-bordeaux-100 font-display font-bold text-bordeaux-700" style={{ width: size, height: size, fontSize: size / 2.8 }} aria-hidden>
      {initials(first, last)}
    </span>
  );
}

const BADGE_TONE: Record<string, "olive" | "blue" | "orange"> = { IDENTITY_VERIFIED: "olive", DOCUMENTS_VERIFIED: "blue", SKILLS_ASSESSED: "orange" };

export function VerificationBadges({ badges }: { badges: { badge: { code: string; nameFr: string } }[] }) {
  if (!badges.length) return <Badge tone="neutral">Non vérifié</Badge>;
  return (
    <>
      {badges.map((b) => (
        <Badge key={b.badge.code} tone={BADGE_TONE[b.badge.code] ?? "olive"} title={b.badge.nameFr}>
          <BadgeCheck className="h-3.5 w-3.5" /> {b.badge.nameFr}
        </Badge>
      ))}
    </>
  );
}

export interface ExpertCardData {
  id: string;
  slug: string;
  headline: string | null;
  countryCode: string | null;
  city: string | null;
  yearsExperience: number;
  availability: keyof typeof AVAILABILITY_LABELS;
  dailyRateMinor: number | null;
  rateCurrency: string | null;
  averageRating: number | null;
  ratingsCount: number;
  completedMissions: number;
  photoFileId: string | null;
  isDemo: boolean;
  user: { firstName: string; lastName: string };
  skills: { level: number; skill: { nameFr: string } }[];
  badges: { badge: { code: string; nameFr: string } }[];
}

export function ExpertCard({ e, actions }: { e: ExpertCardData; actions?: React.ReactNode }) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-line bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-start gap-3">
        <Avatar first={e.user.firstName} last={e.user.lastName} photoFileId={e.photoFileId} />
        <div className="min-w-0 flex-1">
          <Link href={`/experts/${e.slug}`} className="font-display font-bold text-ink hover:text-bordeaux-700">
            {e.user.firstName} {e.user.lastName}
          </Link>
          <p className="line-clamp-2 text-sm text-slate">{e.headline}</p>
        </div>
        <DemoBadge show={e.isDemo} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <VerificationBadges badges={e.badges} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {e.skills.slice(0, 4).map((s) => (
          <Badge key={s.skill.nameFr} tone="bordeaux">{s.skill.nameFr}</Badge>
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate">
        <div className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{e.city ? `${e.city}, ` : ""}{e.countryCode}</div>
        <div className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{e.yearsExperience} ans d'exp.</div>
        <div className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{AVAILABILITY_LABELS[e.availability]}</div>
        <div className="flex items-center gap-1"><Star className="h-3.5 w-3.5" />{e.averageRating ? `${e.averageRating.toFixed(1)} (${e.ratingsCount})` : "Pas encore d'avis"}</div>
      </dl>
      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        <span className="text-sm font-semibold text-ink">{e.dailyRateMinor && e.rateCurrency ? `${formatMoney(e.dailyRateMinor, e.rateCurrency)} / jour` : "Tarif sur demande"}</span>
        {actions ?? (
          <Link href={`/experts/${e.slug}`} className="text-sm font-semibold text-orange-700 hover:underline">
            Voir le profil
          </Link>
        )}
      </div>
    </article>
  );
}

export function MissionCard({ m }: { m: { reference: string; title: string; countryCode: string; workMode: keyof typeof WORK_MODE_LABELS; durationDays: number | null; budgetMaxMinor: number | null; currency: string; applicationDeadline: Date | null; isDemo: boolean; organization: { name: string; status?: string }; domain?: { nameFr: string } | null; requirements?: { skill: { nameFr: string } }[]; _count?: { applications: number } } }) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-line bg-white p-5 shadow-card transition hover:shadow-lift">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">{m.domain?.nameFr ?? "Mission"}</p>
        <DemoBadge show={m.isDemo} />
      </div>
      <Link href={`/missions/${m.reference}`} className="mt-1 font-display text-lg font-bold leading-snug text-ink hover:text-bordeaux-700">
        {m.title}
      </Link>
      <p className="mt-1 text-sm text-slate">
        {m.organization.name} {m.organization.status === "VERIFIED" && <BadgeCheck className="inline h-4 w-4 text-olive-700" aria-label="Organisation vérifiée" />}
      </p>
      {m.requirements && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {m.requirements.slice(0, 4).map((r) => <Badge key={r.skill.nameFr}>{r.skill.nameFr}</Badge>)}
        </div>
      )}
      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-4 text-xs text-slate">
        <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{m.countryCode} · {WORK_MODE_LABELS[m.workMode]}</span>
        {m.durationDays && <span>{m.durationDays} jours</span>}
        {m.budgetMaxMinor && <span>Jusqu'à {formatMoney(m.budgetMaxMinor, m.currency)}</span>}
        {m.applicationDeadline && <span>Clôture le {m.applicationDeadline.toLocaleDateString("fr-FR")}</span>}
        {m._count && <span>{m._count.applications} candidature(s)</span>}
      </div>
    </article>
  );
}
