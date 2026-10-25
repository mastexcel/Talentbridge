import Image from "next/image";
import { BarChart3, Building2, Users } from "lucide-react";
import { Logo } from "@/ui/Logo";

/** Gabarit des écrans d'accès : fond d'écran officiel « accueil / connexion ». */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <aside className="bg-hero relative hidden overflow-hidden text-white lg:block">
        <Image src="/backgrounds/connexion.webp" alt="" fill priority sizes="50vw" className="object-cover object-center" />
        {/* Dégradés : logo et rubriques sur des zones calmes, image visible au centre */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#3a0710] via-transparent to-[#3a0710]" aria-hidden />
        <div className="relative flex h-full flex-col justify-between p-10">
          <Logo variant="dark" tagline className="h-14 w-auto xl:h-16" taglineClassName="text-xs" />
          <ul className="space-y-5">
            {[[Users, "Experts", "Des compétences vérifiées"], [Building2, "Organisations", "Des solutions sur mesure"], [BarChart3, "Résultats", "Un impact concret"]].map(([Icon, t, d]) => {
              const I = Icon as typeof Users;
              return (
                <li key={t as string} className="flex items-center gap-3">
                  <I className="h-8 w-8 text-orange-400" />
                  <div><p className="font-display font-bold uppercase">{t as string}</p><p className="text-sm text-white/80">{d as string}</p></div>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
      <main id="contenu" className="flex items-center justify-center bg-white px-4 py-10 sm:px-8">
        <div className="w-full max-w-lg">
          <div className="mb-8 lg:hidden"><Logo className="h-10 w-auto" /></div>
          {children}
        </div>
      </main>
    </div>
  );
}
