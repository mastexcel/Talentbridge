"use client";
import { useEffect } from "react";

/** Erreur inattendue : message neutre (aucun détail technique exposé), relance possible. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <main id="contenu" className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">Une erreur est survenue</h1>
      <p className="max-w-md text-slate">Nous n'avons pas pu afficher cette page. Réessayez ; si le problème persiste, contactez le support{error.digest ? ` (référence ${error.digest})` : ""}.</p>
      <button onClick={reset} className="rounded-xl bg-orange-600 px-5 py-2.5 font-semibold text-white">Réessayer</button>
    </main>
  );
}
