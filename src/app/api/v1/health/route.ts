import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db";

/** Sonde de disponibilité (base de données incluse). */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: "degraded" }, { status: 503 });
  }
}
