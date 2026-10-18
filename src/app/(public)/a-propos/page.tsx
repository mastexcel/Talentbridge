import type { Metadata } from "next";
import { getBlocks } from "@/application/cms.service";
import { publicFigures } from "@/application/figures.service";
import { Visual } from "@/ui/Visual";
import { visuals } from "@/ui/visuals";
import { PageHeader, RichText } from "@/ui/Page";
import { Card, CardBody } from "@/ui/Card";
export const metadata: Metadata = { title: "À propos" };
export const dynamic = "force-dynamic";
export default async function Page() {
  const [b, figures] = await Promise.all([getBlocks(["home.about", "about.vision", "about.values"]), publicFigures()]);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <PageHeader title="À propos de Talent Bridge" description="Connecter les experts. Transformer les compétences en résultats." />
      <Visual def={visuals(figures).reseauTalents} priority className="mb-8" />
      <div className="grid gap-6 md:grid-cols-2">
        {["home.about", "about.vision", "about.values"].map((k) => b[k] && <Card key={k} className={k === "about.values" ? "md:col-span-2" : ""}><CardBody><h2 className="mb-3 text-xl font-extrabold text-bordeaux-700">{b[k].title}</h2><RichText text={b[k].body} /></CardBody></Card>)}
      </div>
    </div>
  );
}
