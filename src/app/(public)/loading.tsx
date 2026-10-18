import { Skeleton } from "@/ui/Feedback";

/**
 * Squelette de chargement. Chaque segment qui a des sous-pages le réexporte (loading.tsx) :
 * sans frontière propre au segment, une navigation client vers une sous-page non préchargée
 * (ex. /espace -> /espace/profil) restait parfois en suspens (course interne au routeur,
 * reproduite dans 3 à 10 % des cas ; 0 sur 144 avec les frontières par segment).
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-10 sm:px-6" aria-busy="true" aria-label="Chargement">
      <Skeleton className="h-10 w-80" />
      <div className="grid gap-5 md:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-56" />)}</div>
    </div>
  );
}
