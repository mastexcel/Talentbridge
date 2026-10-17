import type { Metadata } from "next";
import Image from "next/image";
import { getBlocks } from "@/application/cms.service";
import { PageHeader, RichText } from "@/ui/Page";
import { Card, CardBody } from "@/ui/Card";
export const metadata: Metadata = { title: "À propos" };
export const dynamic = "force-dynamic";
export default async function Page() {
  const b = await getBlocks(["home.about", "about.vision", "about.values"]);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <PageHeader title="À propos de Talent Bridge" description="Connecter les experts. Transformer les compétences en résultats." />
      <Image src="/images/hero.webp" alt="Experts africains et pont symbolisant la mise en relation" width={780} height={365} className="mb-8 w-full rounded-3xl object-cover" />
      <div className="grid gap-6 md:grid-cols-2">
        {["home.about", "about.vision", "about.values"].map((k) => b[k] && <Card key={k} className={k === "about.values" ? "md:col-span-2" : ""}><CardBody><h2 className="mb-3 text-xl font-extrabold text-bordeaux-700">{b[k].title}</h2><RichText text={b[k].body} /></CardBody></Card>)}
      </div>
    </div>
  );
}
