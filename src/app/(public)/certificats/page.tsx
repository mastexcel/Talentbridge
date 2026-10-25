import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { CERTIFICATE_MODELS } from "@/ui/visuals";
import { PageHeader } from "@/ui/Page";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Field";

export const metadata: Metadata = { title: "Vérifier un certificat" };

export default async function VerifyCertificate({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  if (code && /^[A-Z0-9-]{6,20}$/i.test(code.trim())) redirect(`/certificats/${code.trim().toUpperCase()}`);
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-xl">
        <PageHeader title="Vérifier un certificat" description="Saisissez l'identifiant unique figurant sur le certificat (ou scannez son QR code)." />
        <form className="flex gap-2"><Input name="code" placeholder="TB-XXXX-XXXX" aria-label="Identifiant du certificat" required /><Button type="submit">Vérifier</Button></form>
      </div>
      <section className="mt-14">
        <h2 className="text-2xl font-extrabold text-ink">Modèles de certificats</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate">Exemples de présentation. Les noms, numéros et QR codes figurant sur ces modèles sont fictifs et ne peuvent pas être vérifiés : seul un identifiant saisi ci-dessus fait foi.</p>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {CERTIFICATE_MODELS.map((m) => (
            <figure key={m.src} className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
              <Image src={m.src} alt={m.alt} width={m.width} height={m.height} sizes="(min-width: 768px) 50vw, 100vw" className="h-auto w-full" />
              <figcaption className="flex items-center justify-between gap-2 px-4 py-3 text-sm"><span className="font-semibold">{m.title}</span><span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Exemple fictif</span></figcaption>
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}
