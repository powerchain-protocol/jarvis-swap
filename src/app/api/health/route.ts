import { NextResponse } from "next/server";
import { APP_NAME, APP_VERSION } from "@/constants/release";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Backward-compatible liveness endpoint. */
export function GET() {
  return NextResponse.json(
    { service: APP_NAME, status: "ok", live: true, version: APP_VERSION },
    { headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } },
  );
}
