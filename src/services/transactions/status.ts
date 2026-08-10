"use client";
import { API_ROUTES } from "@/constants/routes";

import { apiErrorMessage, readApiJson } from "@/utils/api-client";

export async function waitForSwapConfirmation(digest: string) {
  const response = await fetch(API_ROUTES.transaction(digest), { cache: "no-store" });
  const payload = await readApiJson<{ ok?: boolean; status?: string; error?: string | { code?: string; message?: string }; digest?: string }>(response);
  if (!response.ok || !payload?.ok) throw new Error(apiErrorMessage(payload, "Transaction was submitted but confirmation could not be verified."));
  return payload;
}
