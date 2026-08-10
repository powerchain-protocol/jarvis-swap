import { GET as getConfig } from "@/app/api/v1/swap/config/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const response = await getConfig();
  response.headers.set("deprecation", "true");
  response.headers.set("link", '</api/v1/swap/config>; rel="successor-version"');
  return response;
}
