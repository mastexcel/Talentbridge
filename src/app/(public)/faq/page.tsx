import type { Metadata } from "next";
import { publicFaq } from "@/application/cms.service";
import { PageHeader } from "@/ui/Page";
export const metadata: Metadata = { title: "FAQ" };
export const dynamic = "force-dynamic";
const CAT: Record<string, string> = { GENERAL: "Général", EXPERTS: "Experts", ORGANISATIONS: "Organisations" };
export default async function FaqPage() {
  const items = await publicFaq();
  const cats = [...new Set(items.map((i) => i.category))];
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <PageHeader title="Questions fréquentes" />
      {cats.map((c) => (
        <section key={c} className="mb-8">
          <h2 className="mb-3 text-xl font-extrabold text-bordeaux-700">{CAT[c] ?? c}</h2>
          <div className="divide-y divide-line rounded-2xl border border-line bg-white">
            {items.filter((i) => i.category === c).map((f) => <details key={f.id} className="p-5"><summary className="cursor-pointer font-semibold">{f.question}</summary><p className="mt-2 text-sm text-slate">{f.answer}</p></details>)}
          </div>
        </section>
      ))}
    </div>
  );
}
