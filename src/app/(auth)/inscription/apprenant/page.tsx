import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/infrastructure/db";
import { SignupForm } from "@/ui/SignupForm";

export const metadata: Metadata = { title: "Inscription apprenant" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const countries = await prisma.country.findMany({ where: { isActive: true }, orderBy: { nameFr: "asc" }, select: { code: true, nameFr: true } });
  return (
    <>
      <Link href="/inscription" className="text-sm text-slate hover:text-bordeaux-700">← Changer de type de compte</Link>
      <h1 className="mt-2 text-3xl font-extrabold">Inscription apprenant</h1>
      <p className="mb-6 mt-1 text-slate">Un compte gratuit pour suivre les formations et séminaires de la Talent Bridge Academy et obtenir vos certificats. Vous pourrez créer un profil d&apos;expert plus tard.</p>
      <SignupForm accountType="LEARNER" countries={countries} />
    </>
  );
}
