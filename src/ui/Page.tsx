import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "./cn";

export function PageHeader({ title, description, actions, back }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm text-slate hover:text-bordeaux-700">
          <ChevronLeft className="h-4 w-4" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-slate">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Pagination serveur : conserve les autres paramètres de recherche. */
export function Pagination({ page, pages, params, basePath }: { page: number; pages: number; params: Record<string, string | undefined>; basePath: string }) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries({ ...params, page: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `${basePath}?${q}`;
  };
  return (
    <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Pagination">
      <Link aria-disabled={page <= 1} href={href(Math.max(1, page - 1))} className={cn("rounded-lg border border-line bg-white p-2", page <= 1 && "pointer-events-none opacity-40")}>
        <ChevronLeft className="h-4 w-4" />
        <span className="sr-only">Page précédente</span>
      </Link>
      <span className="text-sm text-slate">
        Page {page} sur {pages}
      </span>
      <Link aria-disabled={page >= pages} href={href(Math.min(pages, page + 1))} className={cn("rounded-lg border border-line bg-white p-2", page >= pages && "pointer-events-none opacity-40")}>
        <ChevronRight className="h-4 w-4" />
        <span className="sr-only">Page suivante</span>
      </Link>
    </nav>
  );
}

/** Rendu Markdown minimal et sûr (paragraphes, listes, gras, titres) — aucun HTML injecté. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>));
  return (
    <div className={cn("prose-tb", className)}>
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => l.startsWith("- "))) return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.slice(2))}</li>)}</ul>;
        if (b.startsWith("## ")) return <h2 key={i}>{b.slice(3)}</h2>;
        return <p key={i}>{lines.map((l, j) => <span key={j}>{inline(l)}{j < lines.length - 1 && <br />}</span>)}</p>;
      })}
    </div>
  );
}
