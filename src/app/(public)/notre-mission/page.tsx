import type { Metadata } from "next";
import { getBlocks } from "@/application/cms.service";
import { publicFigures } from "@/application/figures.service";
import { Visual } from "@/ui/Visual";
import { visuals } from "@/ui/visuals";
import { PageHeader, RichText } from "@/ui/Page";
export const metadata: Metadata = { title: "Notre mission" };
export const dynamic = "force-dynamic";
export default async function Page() {
  const [b, figures] = await Promise.all([getBlocks(["about.mission", "home.promise"]), publicFigures()]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader title={b["about.mission"]?.title ?? "Notre mission"} />
      <RichText text={b["about.mission"]?.body ?? ""} className="text-lg" />
      <div className="my-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[["Croissance inclusive", "bg-olive-700"], ["Emploi des jeunes", "bg-orange-700"], ["Innovation par l'expertise", "bg-bordeaux-700"], ["Développement durable", "bg-olive-800"]].map(([t, c]) => <div key={t} className={`rounded-2xl p-4 text-center font-display font-bold text-white ${c}`}>{t}</div>)}
      </div>
      <Visual def={visuals(figures).reseauExperts} />
      {b["home.promise"] && <div className="mt-8 rounded-2xl border border-orange-200 bg-orange-50 p-6"><h2 className="font-display text-lg font-bold text-orange-800">{b["home.promise"].title}</h2><p className="mt-2 text-orange-900">{b["home.promise"].body}</p></div>}
    </div>
  );
}
