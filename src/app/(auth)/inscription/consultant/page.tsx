import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/infrastructure/db";
import { SignupForm } from "@/ui/SignupForm";

export const metadata: Metadata = { title: "Inscription consultant" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const countries = await prisma.country.findMany({ where: { isActive: true }, orderBy: { nameFr: "asc" }, select: { code: true, nameFr: true } });
  return (
    <>
      <Link href="/inscription" className="text-sm text-slate hover:text-bordeaux-700">← Changer de type de compte</Link>
      <h1 className="mt-2 text-3xl font-extrabold">Inscription consultant</h1>
      <p className="mb-6 mt-1 text-slate">Créez votre compte, puis complétez votre profil d'expert.</p>
      <SignupForm accountType="EXPERT" countries={countries} />
    </>
  );
}
