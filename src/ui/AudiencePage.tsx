import Image from "next/image";
import { BadgeCheck } from "lucide-react";
import { ButtonLink } from "./Button";

/** Gabarit des pages par public cible (cabinets, entreprises, ONG & institutions). */
export function AudiencePage({ eyebrow, title, intro, image, benefits, steps, cta }: { eyebrow: string; title: string; intro: string; image: string; benefits: { title: string; text: string }[]; steps: string[]; cta: { label: string; href: string }[] }) {
  return (
    <>
      <section className="bg-hero text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-14 sm:px-6 md:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="font-semibold uppercase tracking-wide text-orange-300">{eyebrow}</p>
            <h1 className="mt-2 text-4xl font-extrabold leading-tight">{title}</h1>
            <p className="mt-4 text-lg text-white/85">{intro}</p>
            <div className="mt-6 flex flex-wrap gap-3">{cta.map((c, i) => <ButtonLink key={c.href} href={c.href} variant={i === 0 ? "primary" : "light"} size="lg">{c.label}</ButtonLink>)}</div>
          </div>
          <Image src={image} alt="" width={420} height={420} className="mx-auto hidden h-72 w-auto rounded-3xl object-cover md:block" />
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
