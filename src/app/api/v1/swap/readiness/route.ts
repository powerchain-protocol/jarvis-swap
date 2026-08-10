import { getSwapReadiness } from "@/services/system/readiness";
import { apiErrorResponse, jsonNoStore } from "@/utils/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const readiness = getSwapReadiness();
    return jsonNoStore(readiness, { status: readiness.executionEnabled ? 200 : 503 });
  } catch (cause) {
    return apiErrorResponse(cause, "Swap readiness is unavailable.");
  }
}
