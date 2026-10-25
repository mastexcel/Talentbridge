import type { Metadata } from "next";
import Image from "next/image";
import { Bell, Smartphone, WifiOff, Zap } from "lucide-react";
import { InstallAppPanel } from "@/ui/InstallApp";

export const metadata: Metadata = {
  title: "Application mobile",
  description: "Installez Talent Bridge sur votre téléphone, votre tablette ou votre ordinateur : icône sur l'écran d'accueil, ouverture en plein écran.",
};

const BENEFITS = [
  { icon: Smartphone, title: "Sur votre écran d'accueil", text: "Talent Bridge s'ouvre en un geste, en plein écran, comme une application." },
  { icon: Zap, title: "Rapide et léger", text: "Quelques centaines de kilo-octets, aucune place perdue sur le téléphone, mises à jour automatiques." },
  { icon: Bell, title: "Votre espace à portée de main", text: "Missions recommandées, candidatures, messages, formations et certificats." },
  { icon: WifiOff, title: "Connexion instable ?", text: "Un message clair s'affiche hors connexion ; vos données ne sont jamais conservées sur l'appareil." },
];

const STEPS = [
  { title: "Android (Chrome)", steps: ["Ouvrez le site Talent Bridge dans Chrome.", "Touchez « Installer » dans la bannière, ou menu ⋮ › « Installer l'application »."] },
  { title: "iPhone et iPad (Safari)", steps: ["Ouvrez le site dans Safari.", "Touchez Partager, puis « Sur l'écran d'accueil »."] },
  { title: "Ordinateur (Chrome, Edge)", steps: ["Cliquez sur l'icône d'installation à droite de la barre d'adresse.", "Ou menu › « Installer Talent Bridge »."] },
];

export default function ApplicationPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <Image src="/app/icon-512.png" alt="Icône de l'application Talent Bridge" width={112} height={112} unoptimized className="h-24 w-24 rounded-3xl border border-line shadow-card sm:h-28 sm:w-28" />
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-700">Application mobile</p>
          <h1 className="mt-1 text-3xl font-extrabold text-ink sm:text-4xl">Talent Bridge dans votre poche</h1>
          <p className="mt-2 max-w-2xl text-lg text-slate">Installez l&apos;application gratuitement sur votre téléphone, votre tablette ou votre ordinateur, sans passer par un magasin d&apos;applications.</p>
        </div>
      </div>

      <div className="mt-8"><InstallAppPanel /></div>

      <section className="mt-12 grid gap-5 sm:grid-cols-2" aria-label="Avantages">
        {BENEFITS.map((b) => (
          <div key={b.title} className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <b.icon className="h-7 w-7 text-bordeaux-700" aria-hidden />
            <h2 className="mt-3 font-display text-lg font-bold">{b.title}</h2>
            <p className="mt-1 text-sm text-slate">{b.text}</p>
          </div>
        ))}
      </section>

      <section className="mt-12" aria-labelledby="installer">
        <h2 id="installer" className="text-2xl font-extrabold">Installer en deux gestes</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.title} className="rounded-2xl bg-mist p-5">
              <h3 className="font-display font-bold">{s.title}</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate">{s.steps.map((x) => <li key={x}>{x}</li>)}</ol>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
