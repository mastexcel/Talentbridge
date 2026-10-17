/** Utilitaires de texte (slugs, références lisibles). */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "element";
}

/** Référence lisible : TB-M-2026-00042 */
export function formatReference(kind: string, year: number, seq: number): string {
  return `TB-${kind}-${year}-${String(seq).padStart(5, "0")}`;
}

/** Masque une adresse email (jamais exposée sans autorisation). */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "•••";
  return `${user.slice(0, 1)}•••@${domain}`;
}

export function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

/** Remplace {{variable}} dans un modèle de notification (variables inconnues laissées vides). */
export function renderTemplate(tpl: string, vars: Record<string, string | number | null | undefined>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => String(vars[k] ?? ""));
}
