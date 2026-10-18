import { Skeleton } from "@/ui/Feedback";

/**
 * Squelette de chargement. Chaque segment qui a des sous-pages le réexporte (loading.tsx) :
 * sans frontière propre au segment, une navigation client vers une sous-page non préchargée
 * (ex. /espace -> /espace/profil) restait parfois en suspens (course interne au routeur,
 * reproduite dans 3 à 10 % des cas ; 0 sur 144 avec les frontières par segment).
 */
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Chargement">
      <Skeleton className="h-9 w-72" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      <Skeleton className="h-72" />
    </div>
  );
}
