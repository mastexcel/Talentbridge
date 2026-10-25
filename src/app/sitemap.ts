import type { MetadataRoute } from "next";
import { prisma } from "@/infrastructure/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const statics = ["", "/experts", "/missions", "/appels-offres", "/academy", "/application", "/services", "/tarifs", "/a-propos", "/notre-mission", "/cabinets", "/entreprises", "/ong-institutions", "/contact", "/faq", "/conditions-generales", "/confidentialite", "/mentions-legales"];
  const [experts, missions] = await Promise.all([
    prisma.expertProfile.findMany({ where: { visibility: "PUBLIC", completeness: { gte: 30 }, isDemo: false }, select: { slug: true, updatedAt: true }, take: 5000 }),
    prisma.mission.findMany({ where: { status: { in: ["PUBLISHED", "SHORTLISTING"] }, visibility: "PUBLIC", isDemo: false }, select: { reference: true, updatedAt: true }, take: 5000 }),
  ]);
  return [
    ...statics.map((p) => ({ url: `${base}${p}` })),
    ...experts.map((e) => ({ url: `${base}/experts/${e.slug}`, lastModified: e.updatedAt })),
    ...missions.map((m) => ({ url: `${base}/missions/${m.reference}`, lastModified: m.updatedAt })),
  ];
}
