import { AlertTriangle, CheckCircle2, Info, Inbox, XCircle } from "lucide-react";
import { cn } from "./cn";

export function Alert({ tone = "info", title, children, className }: { tone?: "info" | "success" | "warning" | "error"; title?: string; children?: React.ReactNode; className?: string }) {
  const styles = {
    info: ["border-sky-200 bg-sky-50 text-sky-900", Info],
    success: ["border-olive-200 bg-olive-50 text-olive-800", CheckCircle2],
    warning: ["border-amber-200 bg-amber-50 text-amber-900", AlertTriangle],
    error: ["border-red-200 bg-red-50 text-red-900", XCircle],
  } as const;
  const [cls, Icon] = styles[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl border p-4 text-sm", cls, className)}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div>
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-1" : ""}>{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ title, description, action, icon: Icon = Inbox }: { title: string; description?: string; action?: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-white px-6 py-12 text-center">
      <Icon className="h-10 w-10 text-slate/50" />
      <p className="mt-3 font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-slate">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-line/70", className)} aria-hidden />;
}

/** Fonctionnalité prévue mais non encore disponible : jamais de bouton factice. */
export function NotAvailable({ feature }: { feature: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg border border-dashed border-line px-2 py-1 text-xs text-slate" title="Fonctionnalité prévue, non encore disponible">
      {feature} — bientôt disponible
    </span>
  );
}
