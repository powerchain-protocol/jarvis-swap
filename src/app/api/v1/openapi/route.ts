import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET() {
  const body = await readFile(path.join(process.cwd(), "src/app/api/swagger.yaml"), "utf8");
  return new NextResponse(body, { headers: { "content-type": "application/yaml; charset=utf-8", "cache-control": "public, max-age=300" } });
}
