import { NextResponse } from "next/server";
import { APP_NAME, APP_VERSION } from "@/constants/release";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness only: no upstream/database calls. */
export async function GET() {
  return NextResponse.json(
    { ok: true, live: true, service: APP_NAME, version: APP_VERSION, time: new Date().toISOString() },
    { headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } },
  );
}
