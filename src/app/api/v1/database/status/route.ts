import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ ok: true, configured: false, persistence: false }, { headers: { "cache-control": "no-store" } });
  }
  try {
    const { getPrisma } = await import("@db/prisma/client");
    const prisma = getPrisma();
    await prisma.$queryRawUnsafe("SELECT 1");
    return NextResponse.json({ ok: true, configured: true, persistence: process.env.DATABASE_PERSISTENCE_ENABLED === "true" }, { headers: { "cache-control": "no-store" } });
  } catch (cause) {
    return NextResponse.json({ ok: false, configured: true, error: cause instanceof Error ? cause.message : "Database health check failed." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
