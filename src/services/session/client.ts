"use client";
import { API_ROUTES } from "@/constants/routes";
import type { WalletChallenge, WalletSession } from "@/types/sessions";
import { apiErrorMessage, readApiJson } from "@/utils/api-client";

export async function fetchWalletSession(signal?: AbortSignal): Promise<WalletSession> {
  const response = await fetch(API_ROUTES.sessionCurrent, { cache: "no-store", credentials: "same-origin", signal });
  const payload = await readApiJson<WalletSession & { error?: unknown }>(response);
  if (!response.ok || !payload) throw new Error(apiErrorMessage(payload, "Unable to read wallet session."));
  return payload;
}

export async function requestWalletChallenge(address: string): Promise<WalletChallenge> {
  const response = await fetch(API_ROUTES.sessionChallenge, {
    method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", cache: "no-store",
    body: JSON.stringify({ address }),
  });
  const payload = await readApiJson<WalletChallenge & { error?: unknown }>(response);
  if (!response.ok || !payload?.token || !payload.message) throw new Error(apiErrorMessage(payload, "Unable to create wallet verification challenge."));
  return payload;
}

export async function verifyWalletSession(input: { address: string; token: string; signature: string }): Promise<WalletSession> {
  const response = await fetch(API_ROUTES.sessionVerify, {
    method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", cache: "no-store",
    body: JSON.stringify(input),
  });
  const payload = await readApiJson<WalletSession & { error?: unknown }>(response);
  if (!response.ok || !payload?.authenticated) throw new Error(apiErrorMessage(payload, "Wallet verification failed."));
  return payload;
}

export async function logoutWalletSession() {
  await fetch(API_ROUTES.sessionLogout, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", cache: "no-store", body: "{}" }).catch(() => undefined);
}
