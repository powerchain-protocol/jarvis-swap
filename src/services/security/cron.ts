import "server-only";
import { NextRequest } from "next/server";

export function assertCronAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) throw new Error("CRON_SECRET is not configured.");
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization !== `Bearer ${secret}`) throw new Error("Unauthorized cron request.");
}
