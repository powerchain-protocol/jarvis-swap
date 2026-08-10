import { NextRequest } from "next/server";
import { readWalletSession } from "@/services/session/server";
import { jsonNoStore } from "@/utils/api-response";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) { return jsonNoStore(readWalletSession(request)); }
