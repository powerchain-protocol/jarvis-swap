import { NextRequest } from "next/server";
import { GET as networkStatus } from "@/app/api/v1/network/status/route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: NextRequest) { return networkStatus(); }
