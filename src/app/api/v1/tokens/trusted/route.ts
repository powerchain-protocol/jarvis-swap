import { createHash } from "node:crypto";
import { getServerConfig } from "@/config/env";
import { getTrustedTokenRegistryId } from "@/services/tokens/trusted";
import { getHydratedTrustedTokenList } from "@/services/tokens/trusted-metadata";
import { apiErrorResponse } from "@/utils/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function quoteEtag(value: string) { return `\"${value}\"`; }

export async function GET(request: Request) {
  try {
    const config = getServerConfig();
    const registryId = getTrustedTokenRegistryId();
    const hydrated = await getHydratedTrustedTokenList();
    const tokens = hydrated.map(({ coinType, symbol, name, decimals, verification, source, iconUrl, metadataStatus, metadataUpdatedAt }) => ({ coinType, symbol, name, decimals, verification, source, iconUrl, metadataStatus, metadataUpdatedAt }));
    const representationId = createHash("sha256").update(JSON.stringify([config.network, registryId, tokens.map(({ coinType, symbol, name, decimals, metadataStatus }) => ({ coinType, symbol, name, decimals, metadataStatus }))])).digest("hex");
    const etag = quoteEtag(representationId);
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: { etag, "cache-control": "private, max-age=0, must-revalidate", vary: "Accept" } });
    }
    return Response.json({
      network: config.network,
      cluster: config.cluster,
      registryId,
      representationId,
      count: tokens.length,
      tokens,
    }, { headers: { etag, "cache-control": "private, max-age=0, must-revalidate", "x-content-type-options": "nosniff", vary: "Accept" } });
  } catch (cause) {
    return apiErrorResponse(cause, "Trusted token registry is unavailable.");
  }
}
