import type { Metadata } from "next";
import Image from "next/image";
import { getBlocks } from "@/application/cms.service";
import { PageHeader, RichText } from "@/ui/Page";
export const metadata: Metadata = { title: "Notre mission" };
export const dynamic = "force-dynamic";
export default async function Page() {
  const b = await getBlocks(["about.mission", "home.promise"]);
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <PageHeader title={b["about.mission"]?.title ?? "Notre mission"} />
      <RichText text={b["about.mission"]?.body ?? ""} className="text-lg" />
      <div className="my-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[["Croissance inclusive", "bg-olive-700"], ["Emploi des jeunes", "bg-orange-700"], ["Innovation par l'expertise", "bg-bordeaux-700"], ["Développement durable", "bg-olive-800"]].map(([t, c]) => <div key={t} className={`rounded-2xl p-4 text-center font-display font-bold text-white ${c}`}>{t}</div>)}
      </div>
      <Image src="/images/impact.webp" alt="Un impact durable pour l'Afrique" width={630} height={285} className="w-full rounded-3xl" />
      {b["home.promise"] && <div className="mt-8 rounded-2xl border border-orange-200 bg-orange-50 p-6"><h2 className="font-display text-lg font-bold text-orange-800">{b["home.promise"].title}</h2><p className="mt-2 text-orange-900">{b["home.promise"].body}</p></div>}
    </div>
  );
}
