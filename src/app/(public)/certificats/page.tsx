import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/ui/Page";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Field";

export const metadata: Metadata = { title: "Vérifier un certificat" };

export default async function VerifyCertificate({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  if (code && /^[A-Z0-9-]{6,20}$/i.test(code.trim())) redirect(`/certificats/${code.trim().toUpperCase()}`);
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <PageHeader title="Vérifier un certificat" description="Saisissez l'identifiant unique figurant sur le certificat (ou scannez son QR code)." />
      <form className="flex gap-2"><Input name="code" placeholder="TB-XXXX-XXXX" aria-label="Identifiant du certificat" required /><Button type="submit">Vérifier</Button></form>
    </div>
  );
}
