import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/infrastructure/db";
import { ORGANIZATION_TYPES, ORGANIZATION_TYPE_LABELS } from "@/application/schemas";
import { SignupForm } from "@/ui/SignupForm";

export const metadata: Metadata = { title: "Inscription organisation" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const t = (ORGANIZATION_TYPES as readonly string[]).includes(type ?? "") ? (type as (typeof ORGANIZATION_TYPES)[number]) : "COMPANY";
  const countries = await prisma.country.findMany({ where: { isActive: true }, orderBy: { nameFr: "asc" }, select: { code: true, nameFr: true } });
  return (
    <>
      <Link href="/inscription" className="text-sm text-slate hover:text-bordeaux-700">← Changer de type de compte</Link>
      <h1 className="mt-2 text-3xl font-extrabold">Inscription — {ORGANIZATION_TYPE_LABELS[t]}</h1>
      <p className="mb-6 mt-1 text-slate">Vous créez votre compte personnel et l'espace de votre organisation, dont vous serez propriétaire.</p>
      <SignupForm accountType={t} countries={countries} />
    </>
  );
}
