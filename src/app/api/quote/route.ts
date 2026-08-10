import type { NextRequest } from "next/server";
import { POST as createQuote } from "@/app/api/v1/swap/quote/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const response = await createQuote(request);
  response.headers.set("deprecation", "true");
  response.headers.set("link", '</api/v1/swap/quote>; rel="successor-version"');
  return response;
}
