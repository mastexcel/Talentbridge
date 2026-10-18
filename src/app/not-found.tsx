import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <main id="contenu" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-4 text-center text-white">
      <Image src="/visuels/logo-lumineux.png" alt="Talent Bridge" width={1536} height={1024} className="h-auto w-72" priority />
      <p className="font-display text-6xl font-extrabold text-orange-500">404</p>
      <h1 className="text-2xl font-bold">Page introuvable</h1>
      <p className="max-w-md text-white/75">Cette page n'existe pas, ou vous n'avez pas les droits pour la consulter.</p>
      <Link href="/" className="rounded-xl bg-orange-600 px-5 py-2.5 font-semibold text-white">Retour à l'accueil</Link>
    </main>
  );
}
