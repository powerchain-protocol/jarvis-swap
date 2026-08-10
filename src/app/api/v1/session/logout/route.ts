import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/services/session/server";
import { assertMutationRequest } from "@/services/security/request-security";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  assertMutationRequest(request);
  const response = NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  response.headers.append("set-cookie", clearSessionCookie());
  return response;
}
