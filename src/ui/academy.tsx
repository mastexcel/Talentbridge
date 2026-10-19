/** Éléments d'affichage de la Talent Bridge Academy (catalogue, agenda, fiches). */
import Link from "next/link";
import { CalendarDays, Clock, MapPin, MonitorPlay, Users } from "lucide-react";
import { COURSE_FORMAT_LABELS, COURSE_KIND_LABELS, type CourseFormat, type CourseKind } from "@/domain/academy";
import { formatMoney } from "@/domain/money";
import { Badge, DemoBadge } from "./Badge";
import { LEVEL_LABELS } from "./labels";
import { cn } from "./cn";

export interface SessionView {
  id: string;
  title: string;
  startsAt: Date;
  durationMin: number;
  mode: string;
  venue: string | null;
  city: string | null;
  countryName: string | null;
  seatsLeft: number | null;
}

const TZ = "UTC";
export const fmtDay = (d: Date) => d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ });
export const fmtTime = (d: Date) => `${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ })} GMT`;

export function sessionPlace(s: Pick<SessionView, "mode" | "venue" | "city" | "countryName">): string {
  if (s.mode === "VIRTUAL") return "En ligne (classe virtuelle)";
  return [s.venue, s.city, s.countryName].filter(Boolean).join(", ") || "Présentiel";
}

export function seatsText(left: number | null): string {
  if (left == null) return "Places disponibles";
  if (left === 0) return "Complet";
  return `${left} place${left > 1 ? "s" : ""} restante${left > 1 ? "s" : ""}`;
}

export function KindBadge({ kind }: { kind: string }) {
  return <Badge tone={kind === "SEMINAR" ? "bordeaux" : "olive"}>{COURSE_KIND_LABELS[kind as CourseKind] ?? kind}</Badge>;
}

export const formatLabel = (f: string) => COURSE_FORMAT_LABELS[f as CourseFormat] ?? f;
export const priceLabel = (minor: number, currency: string) => (minor === 0 ? "Gratuit" : formatMoney(minor, currency));

/** Pavé date (jour + mois) des listes d'agenda. */
export function DateBlock({ date }: { date: Date }) {
  return (
    <div className="flex w-16 shrink-0 flex-col items-center self-start rounded-xl bg-bordeaux-700 py-2 text-white" aria-hidden>
      <span className="font-display text-2xl font-extrabold leading-none">{date.toLocaleDateString("fr-FR", { day: "2-digit", timeZone: TZ })}</span>
      <span className="text-xs uppercase tracking-wide">{date.toLocaleDateString("fr-FR", { month: "short", timeZone: TZ }).replace(".", "")}</span>
    </div>
  );
}

export interface CourseCardData {
  slug: string;
  title: string;
  summary: string;
  kind: string;
  format: string;
  level: string;
  durationHours: number;
  priceMinor: number;
  currency: string;
  isDemo: boolean;
  audience: string | null;
  open: boolean;
  domain: { nameFr: string } | null;
  providerOrg: { name: string } | null;
  instructor: { firstName: string; lastName: string };
  sessions: SessionView[];
  _count: { enrollments: number };
}

export function CourseCard({ c }: { c: CourseCardData }) {
  // Formation en ligne : accès immédiat ; ses éventuelles sessions en direct sont facultatives.
  const sessionBased = c.kind === "SEMINAR" || c.format !== "ONLINE";
  const next = sessionBased ? c.sessions[0] : undefined;
  return (
    <Link href={`/academy/${c.slug}`} className={cn("flex h-full flex-col rounded-2xl border border-line bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift", !c.open && "opacity-80")}>
      <div className="flex flex-wrap gap-2">
        <KindBadge kind={c.kind} />
        <Badge tone="neutral">{formatLabel(c.format)}</Badge>
        <DemoBadge show={c.isDemo} />
      </div>
      <h3 className="mt-3 font-display text-lg font-bold leading-snug text-ink">{c.title}</h3>
      <p className="mt-1 line-clamp-3 text-sm text-slate">{c.summary}</p>
      <div className="mt-4 flex-1 space-y-1.5 text-xs text-slate">
        {next ? (
          <>
            <div className="flex items-start gap-1.5"><CalendarDays className="mt-px h-3.5 w-3.5 shrink-0 text-orange-600" /><span className="sr-only">Prochaine session : </span><span className="first-letter:uppercase">{fmtDay(next.startsAt)}{c.sessions.length > 1 && ` · ${c.sessions.length - 1} autre${c.sessions.length > 2 ? "s" : ""} date${c.sessions.length > 2 ? "s" : ""}`}</span></div>
            <div className="flex items-start gap-1.5">{next.mode === "VIRTUAL" ? <MonitorPlay className="mt-px h-3.5 w-3.5 shrink-0" /> : <MapPin className="mt-px h-3.5 w-3.5 shrink-0" />}<span className="sr-only">Lieu : </span><span>{sessionPlace(next)} · <span className={cn(next.seatsLeft === 0 && "font-semibold text-red-700")}>{seatsText(next.seatsLeft)}</span></span></div>
          </>
        ) : sessionBased ? (
          <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /><span>Prochaines dates à venir</span></div>
        ) : (
          <div className="flex items-center gap-1.5"><MonitorPlay className="h-3.5 w-3.5" /><span>Accès immédiat après inscription</span></div>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{c.durationHours} h</span>
          <span>{LEVEL_LABELS[c.level] ?? c.level}</span>
          {c.domain && <span>{c.domain.nameFr}</span>}
          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{c._count.enrollments} inscrit(s)</span>
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3 border-t border-line pt-3">
        <p className="min-w-0 truncate text-xs text-slate">{c.providerOrg?.name ?? `${c.instructor.firstName} ${c.instructor.lastName}`}</p>
        <p className="shrink-0 font-display font-extrabold text-bordeaux-700">{priceLabel(c.priceMinor, c.currency)}</p>
      </div>
    </Link>
  );
}
