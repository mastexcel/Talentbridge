"use client";
import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export function MobileMenu({ links, cta }: { links: { href: string; label: string }[]; cta: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="xl:hidden">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} className="rounded-lg p-2 text-ink hover:bg-mist">
        {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-40 border-b border-line bg-white px-4 pb-5 shadow-lift animate-fade-in">
          <nav className="flex flex-col py-2" aria-label="Navigation mobile">
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-2 py-3 font-medium text-ink hover:bg-mist">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="grid gap-2">
            {cta.map((c, i) => (
              <Link key={c.href} href={c.href} onClick={() => setOpen(false)} className={`rounded-xl px-4 py-3 text-center font-semibold ${i === 0 ? "bg-orange-600 text-white" : "border border-line text-ink"}`}>
                {c.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
