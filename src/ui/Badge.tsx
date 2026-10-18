import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

const badge = cva("inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", {
  variants: {
    tone: {
      neutral: "bg-mist text-slate border border-line",
      bordeaux: "bg-bordeaux-100 text-bordeaux-800",
      orange: "bg-orange-100 text-orange-800",
      olive: "bg-olive-100 text-olive-800",
      red: "bg-red-100 text-red-800",
      blue: "bg-sky-100 text-sky-800",
      demo: "bg-amber-100 text-amber-900 border border-amber-300",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}

/** Marqueur obligatoire des données fictives. */
export function DemoBadge({ show = true }: { show?: boolean }) {
  if (!show) return null;
  return (
    <Badge tone="demo" title="Donnée fictive de démonstration">
      Démo
    </Badge>
  );
}

const STATUS_TONES: Record<string, VariantProps<typeof badge>["tone"]> = {
  ACTIVE: "olive", VERIFIED: "olive", PAID: "olive", SUCCEEDED: "olive", COMPLETED: "olive", SELECTED: "olive", CONTRACTED: "olive", APPROVED: "olive", READY: "olive", WON: "olive", PUBLISHED: "olive", OPEN: "olive", SIGNED: "olive", DONE: "olive", ACCEPTED: "olive",
  PENDING: "orange", PENDING_PAYMENT: "orange", ISSUED: "orange", PARTIALLY_PAID: "orange", IN_REVIEW: "blue", INFO_REQUESTED: "orange", SUBMITTED: "blue", SHORTLISTED: "blue", INTERVIEW: "blue", SHORTLISTING: "blue", INTERVIEWS: "blue", SELECTION: "blue", CONTRACTING: "blue", IN_PROGRESS: "blue", PAST_DUE: "red", SENT: "blue", PREPARING: "blue", REVIEW: "blue", IN_PROGRESS_REQ: "orange", REQUESTED: "orange",
  REJECTED: "red", FAILED: "red", SUSPENDED: "red", CANCELLED: "neutral", EXPIRED: "neutral", WITHDRAWN: "neutral", VOID: "neutral", DRAFT: "neutral", CLOSED: "neutral", LOST: "red", MISSING: "red", TERMINATED: "red", DECLINED: "neutral", NOT_SUBMITTED: "neutral",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={STATUS_TONES[status] ?? "neutral"}>{label ?? status}</Badge>;
}
