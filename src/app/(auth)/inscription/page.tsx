import type { Metadata } from "next";
import Link from "next/link";
import { Building2, GraduationCap, Landmark, Briefcase, HeartHandshake, UserRound } from "lucide-react";

export const metadata: Metadata = { title: "Inscription" };

const CHOICES = [
  { href: "/inscription/consultant", icon: UserRound, title: "Consultant indépendant", text: "Créez votre profil d'expert, faites-le vérifier, candidatez." },
  { href: "/inscription/organisation?type=CONSULTING_FIRM", icon: Briefcase, title: "Cabinet de conseil", text: "Mobilisez des experts et répondez aux appels d'offres." },
  { href: "/inscription/organisation?type=COMPANY", icon: Building2, title: "Entreprise / PME", text: "Publiez vos besoins et recrutez des experts." },
  { href: "/inscription/organisation?type=NGO", icon: HeartHandshake, title: "ONG / organisation internationale", text: "Mobilisez des experts pour vos programmes." },
  { href: "/inscription/organisation?type=INSTITUTION", icon: Landmark, title: "Institution publique", text: "Accédez à l'expertise en toute transparence." },
  { href: "/inscription/organisation?type=TRAINING_PROVIDER", icon: GraduationCap, title: "Organisme de formation", text: "Publiez vos formations sur l'Academy." },
];

export default function SignupChoice() {
  return (
    <>
      <h1 className="text-3xl font-extrabold">Rejoindre Talent Bridge</h1>
      <p className="mt-1 text-slate">Choisissez le type de compte. Vous pourrez appartenir à plusieurs organisations par la suite.</p>
      <div className="mt-6 grid gap-3">
        {CHOICES.map((c) => (
          <Link key={c.href} href={c.href} className="flex items-start gap-4 rounded-2xl border border-line p-4 transition hover:border-orange-500 hover:bg-orange-50">
            <c.icon className="h-6 w-6 shrink-0 text-bordeaux-700" />
            <div><p className="font-display font-bold">{c.title}</p><p className="text-sm text-slate">{c.text}</p></div>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-slate">Déjà inscrit ? <Link href="/connexion" className="font-semibold text-orange-700">Se connecter</Link></p>
    </>
  );
}
