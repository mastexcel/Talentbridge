import { cn } from "./cn";

export function StatCard({ label, value, hint, icon: Icon, tone = "bordeaux", className }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ComponentType<{ className?: string }>; tone?: "bordeaux" | "orange" | "olive" | "ink"; className?: string }) {
  const tones = { bordeaux: "bg-bordeaux-100 text-bordeaux-700", orange: "bg-orange-100 text-orange-700", olive: "bg-olive-100 text-olive-700", ink: "bg-mist text-ink" };
  return (
    <div className={cn("rounded-2xl border border-line bg-white p-4 shadow-card", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate">{label}</p>
        {Icon && (
          <span className={cn("rounded-xl p-2", tones[tone])}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-2 font-display text-2xl font-extrabold tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate">{hint}</p>}
    </div>
  );
}

export function Progress({ value, className, tone = "olive" }: { value: number; className?: string; tone?: "olive" | "orange" | "bordeaux" }) {
  const v = Math.max(0, Math.min(100, value));
  const tones = { olive: "bg-olive-600", orange: "bg-orange-500", bordeaux: "bg-bordeaux-700" };
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-line", className)} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-all", tones[tone])} style={{ width: `${v}%` }} />
    </div>
  );
}
