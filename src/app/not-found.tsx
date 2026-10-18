import Link from "next/link";
import { Logo } from "@/ui/Logo";

export default function NotFound() {
  return (
    <main id="contenu" className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo className="h-16 w-auto" />
      <p className="font-display text-6xl font-extrabold text-bordeaux-700">404</p>
      <h1 className="text-2xl font-bold">Page introuvable</h1>
      <p className="max-w-md text-slate">Cette page n'existe pas, ou vous n'avez pas les droits pour la consulter.</p>
      <Link href="/" className="rounded-xl bg-orange-600 px-5 py-2.5 font-semibold text-white">Retour à l'accueil</Link>
    </main>
  );
}
