import { NextRequest } from "next/server";
import { GET as getPools } from "@/app/api/pools/route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: NextRequest) { return getPools(); }
