import { BadgeCheck } from "lucide-react";
import { publicFigures } from "@/application/figures.service";
import { ButtonLink } from "./Button";
import { Visual } from "./Visual";
import { visuals } from "./visuals";

/** Gabarit des pages par public cible (cabinets, entreprises, ONG & institutions). */
export async function AudiencePage({ eyebrow, title, intro, visual, benefits, steps, cta }: { eyebrow: string; title: string; intro: string; visual: "entreprises" | "ong" | "cabinets"; benefits: { title: string; text: string }[]; steps: string[]; cta: { label: string; href: string }[] }) {
  return (
    <>
      <section className="bg-white">
        <Visual def={visuals(await publicFigures())[visual]} priority rounded={false} className="mx-auto max-w-[1774px]" />
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <p className="font-semibold uppercase tracking-wide text-orange-700">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight text-ink">{title}</h1>
          <p className="mt-3 max-w-3xl text-lg text-slate">{intro}</p>
          <div className="mt-5 flex flex-wrap gap-3">{cta.map((c, i) => <ButtonLink key={c.href} href={c.href} variant={i === 0 ? "primary" : "outline"} size="lg">{c.label}</ButtonLink>)}</div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {benefits.map((b) => (
            <div key={b.title} className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <BadgeCheck className="h-6 w-6 text-olive-600" />
              <h2 className="mt-2 font-display font-bold">{b.title}</h2>
              <p className="mt-1 text-sm text-slate">{b.text}</p>
            </div>
          ))}
        </div>
        <h2 className="mt-14 text-2xl font-extrabold">Comment nous travaillons ensemble</h2>
        <ol className="mt-5 grid gap-4 md:grid-cols-4">
          {steps.map((s, i) => <li key={s} className="rounded-2xl bg-white p-5 shadow-card"><span className="font-display text-3xl font-extrabold text-orange-600">{i + 1}</span><p className="mt-2 text-sm">{s}</p></li>)}
        </ol>
      </section>
    </>
  );
}
