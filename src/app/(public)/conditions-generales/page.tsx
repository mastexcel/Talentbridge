import type { Metadata } from "next";
import { getBlock } from "@/application/cms.service";
import { PageHeader, RichText } from "@/ui/Page";
export const metadata: Metadata = { title: "Conditions générales" };
export const dynamic = "force-dynamic";
export default async function Page() {
  const b = await getBlock("legal.terms");
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <PageHeader title={b?.title ?? "Conditions générales"} description={b ? `Dernière mise à jour : ${b.updatedAt.toLocaleDateString("fr-FR")}` : undefined} />
      <div className="rounded-2xl border border-line bg-white p-6 shadow-card"><RichText text={b?.body ?? "Contenu à rédiger dans l'administration (Contenus du site)."} /></div>
    </div>
  );
}
