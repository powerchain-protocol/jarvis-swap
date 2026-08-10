import { getDeploymentStatus } from "@/services/system/deployment";
import { apiErrorResponse, jsonNoStore } from "@/utils/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = getDeploymentStatus();
    return jsonNoStore(status, { status: status.appReady ? 200 : 503 });
  } catch (cause) {
    return apiErrorResponse(cause, "Deployment status is unavailable.");
  }
}
