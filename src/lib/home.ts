/** Page d'accueil selon le profil (utilisable côté serveur comme dans les routes API). */
export function homePathFor(user: { platformRole: string; expertProfile: unknown; memberships: unknown[] }): string {
  if (user.platformRole === "ADMIN") return "/admin";
  if (user.memberships.length > 0 && !user.expertProfile) return "/organisation";
  if (user.expertProfile) return "/espace";
  return "/";
}
