import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { verifyPersonalMessageSignature } from "@mysten/sui/verify";
import { AppError } from "@/utils/errors";
import { normalizeSuiAddress } from "@/services/sui/address";
import { getServerConfig } from "@/config/env";
import { createSuiGrpcClient } from "@/services/sui/grpc";
import type { WalletSession } from "@/types/sessions";

const PRODUCTION_COOKIE_PREFIX = process.env.NODE_ENV === "production" ? "__Host-" : "";
export const SESSION_COOKIE = `${PRODUCTION_COOKIE_PREFIX}jarvis_wallet_session`;
export const CHALLENGE_COOKIE = `${PRODUCTION_COOKIE_PREFIX}jarvis_wallet_challenge`;
const encoder = new TextEncoder();

function configuredOrigin() {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!value) {
    if (process.env.NODE_ENV === "production" && getServerConfig().requireWalletSession) {
      throw new AppError("CONFIGURATION_ERROR", "NEXT_PUBLIC_APP_URL is required for production wallet sessions.");
    }
    return "http://localhost:3000";
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      throw new Error("insecure origin");
    }
    return parsed.origin;
  } catch {
    throw new AppError("CONFIGURATION_ERROR", "NEXT_PUBLIC_APP_URL must be a valid application origin.");
  }
}

type ChallengeClaims = {
  kind: "wallet-challenge";
  address: string;
  network: "mainnet" | "testnet" | "devnet";
  origin: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
};

type SessionClaims = {
  kind: "wallet-session";
  address: string;
  network: "mainnet" | "testnet" | "devnet";
  origin: string;
  sessionId: string;
  issuedAt: number;
  expiresAt: number;
};

function secret(required = true) {
  const value = process.env.JARVIS_SESSION_SECRET?.trim();
  if (!value && required) throw new AppError("CONFIGURATION_ERROR", "Wallet session signing is not configured.");
  return value;
}

function b64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function signPayload(payload: object) {
  const encoded = b64url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret()!).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyPayload<T extends object>(token: string): T {
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) throw new AppError("UNAUTHORIZED", "Invalid wallet session token.");
  const expected = createHmac("sha256", secret()!).update(encoded).digest();
  let received: Buffer;
  try { received = Buffer.from(signature, "base64url"); } catch { throw new AppError("UNAUTHORIZED", "Invalid wallet session token."); }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new AppError("UNAUTHORIZED", "Invalid wallet session token.");
  try { return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as T; }
  catch { throw new AppError("UNAUTHORIZED", "Invalid wallet session token."); }
}


export function walletChallengeReplayKey(token: string) {
  if (typeof token !== "string" || token.length < 16 || token.length > 8_000) {
    throw new AppError("BAD_REQUEST", "Invalid wallet verification challenge.");
  }
  return `wallet-challenge:${createHash("sha256").update(token).digest("hex")}`;
}

function challengeMessage(claims: ChallengeClaims) {
  return [
    "JARVIS Swap wallet verification",
    "",
    "Sign this message to prove control of your Sui wallet. This does not submit a transaction or spend assets.",
    `Origin: ${claims.origin}`,
    `Address: ${claims.address}`,
    `Network: sui:${claims.network}`,
    `Nonce: ${claims.nonce}`,
    `Issued at: ${new Date(claims.issuedAt).toISOString()}`,
    `Expires at: ${new Date(claims.expiresAt).toISOString()}`,
  ].join("\n");
}

export function createWalletChallenge(addressInput: string) {
  const config = getServerConfig();
  if (!secret(false)) throw new AppError("CONFIGURATION_ERROR", "Wallet sessions are not configured.");
  const address = normalizeSuiAddress(addressInput);
  const issuedAt = Date.now();
  const claims: ChallengeClaims = {
    kind: "wallet-challenge",
    address,
    network: config.network,
    origin: configuredOrigin(),
    nonce: randomBytes(24).toString("hex"),
    issuedAt,
    expiresAt: issuedAt + config.sessionChallengeTtlMs,
  };
  return { token: signPayload(claims), message: challengeMessage(claims), address, network: config.network, expiresAt: claims.expiresAt };
}

export async function verifyWalletChallenge(input: { token: string; signature: string; address: string }) {
  const config = getServerConfig();
  const claims = verifyPayload<ChallengeClaims>(input.token);
  if (claims.kind !== "wallet-challenge") throw new AppError("UNAUTHORIZED", "Invalid wallet verification challenge.");
  if (Date.now() > claims.expiresAt || claims.expiresAt <= claims.issuedAt) throw new AppError("UNAUTHORIZED", "Wallet verification challenge expired.");
  if (claims.network !== config.network) throw new AppError("UNAUTHORIZED", "Wallet verification challenge belongs to another Sui network.");
  if (claims.origin !== configuredOrigin()) throw new AppError("UNAUTHORIZED", "Wallet verification challenge belongs to another application origin.");
  const address = normalizeSuiAddress(input.address);
  if (address !== claims.address) throw new AppError("UNAUTHORIZED", "Wallet verification address does not match the challenge.");
  const message = challengeMessage(claims);
  try {
    await verifyPersonalMessageSignature(encoder.encode(message), input.signature, { address, client: createSuiGrpcClient() as never });
  } catch {
    throw new AppError("UNAUTHORIZED", "Wallet verification signature is invalid.");
  }
  const issuedAt = Date.now();
  const session: SessionClaims = {
    kind: "wallet-session",
    address,
    network: config.network,
    origin: configuredOrigin(),
    sessionId: randomBytes(24).toString("hex"),
    issuedAt,
    expiresAt: issuedAt + config.sessionTtlMs,
  };
  return { token: signPayload(session), session };
}

export function readWalletSession(request: Request): WalletSession {
  const config = getServerConfig();
  const configured = Boolean(secret(false));
  const required = config.requireWalletSession;
  if (!configured) return { authenticated: false, configured, required };
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return { authenticated: false, configured, required };
  const token = decodeURIComponent(match.slice(SESSION_COOKIE.length + 1));
  try {
    const claims = verifyPayload<SessionClaims>(token);
    if (claims.kind !== "wallet-session" || claims.network !== config.network || claims.origin !== configuredOrigin() || Date.now() >= claims.expiresAt) return { authenticated: false, configured, required };
    return { authenticated: true, configured, required, address: claims.address, network: claims.network, issuedAt: claims.issuedAt, expiresAt: claims.expiresAt };
  } catch {
    return { authenticated: false, configured, required };
  }
}

export function assertWalletSession(request: Request, expectedAddress?: string) {
  const session = readWalletSession(request);
  if (!session.required) return session;
  if (!session.authenticated || !session.address) throw new AppError("UNAUTHORIZED", "Verify your connected wallet before submitting transactions.");
  if (expectedAddress && session.address !== normalizeSuiAddress(expectedAddress)) throw new AppError("UNAUTHORIZED", "Wallet session does not match the transaction sender.");
  return session;
}

export function sessionCookie(token: string, maxAgeSeconds: number) {
  const secure = process.env.NODE_ENV === "production";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}${secure ? "; Secure" : ""}`;
}

export function challengeCookie(token: string, maxAgeSeconds: number) {
  const secure = process.env.NODE_ENV === "production";
  return `${CHALLENGE_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}${secure ? "; Secure" : ""}`;
}

export function clearChallengeCookie() { return challengeCookie("", 0); }
export function clearSessionCookie() { return sessionCookie("", 0); }
