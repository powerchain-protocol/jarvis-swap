import { apiErrorMessage, readApiJson } from "@/utils/api-client";
import { API_ROUTES } from "@/constants/routes";

export type ImportedTokenMetadata = {
  coinType: string;
  name: string;
  symbol: string;
  decimals: number;
  iconUrl: string | null;
  verified: boolean;
};

export async function resolveCustomToken(coinType: string): Promise<ImportedTokenMetadata> {
  const response = await fetch(API_ROUTES.tokenResolve, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ coinType }),
  });
  const data = await readApiJson<ImportedTokenMetadata | { error?: string | { code?: string; message?: string } }>(response);
  if (!response.ok) throw new Error(apiErrorMessage(data, "Unable to import token"));
  if (!data || !("coinType" in data) || typeof data.coinType !== "string" || typeof data.verified !== "boolean") throw new Error("Token metadata response is invalid.");
  return data as ImportedTokenMetadata;
}
