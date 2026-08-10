import type { NextRequest } from "next/server";
import { POST as resolveToken } from "@/app/api/v1/tokens/resolve/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const response = await resolveToken(request);
  response.headers.set("deprecation", "true");
  response.headers.set("link", '</api/v1/tokens/resolve>; rel="successor-version"');
  return response;
}
