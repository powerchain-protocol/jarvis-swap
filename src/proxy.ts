import { NextResponse, type NextRequest } from "next/server";

const API_PREFIX = "/api/";

function requestIdFrom(headers: Headers) {
  const supplied = headers.get("x-request-id")?.trim();
  return supplied && /^[A-Za-z0-9._:-]{8,128}$/.test(supplied) ? supplied : crypto.randomUUID();
}

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const requestId = requestIdFrom(requestHeaders);
  requestHeaders.set("x-request-id", requestId);
  const configuredNetwork = process.env.NEXT_PUBLIC_SUI_NETWORK?.toLowerCase();
  requestHeaders.set("x-jarvis-network", configuredNetwork === "testnet" || configuredNetwork === "devnet" ? configuredNetwork : "mainnet");

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);
  if (request.nextUrl.pathname.startsWith(API_PREFIX)) {
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
