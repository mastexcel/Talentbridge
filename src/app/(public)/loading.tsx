import { Skeleton } from "@/ui/Feedback";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-10 sm:px-6" aria-busy="true" aria-label="Chargement">
      <Skeleton className="h-10 w-80" />
      <div className="grid gap-5 md:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-56" />)}</div>
    </div>
  );
}
