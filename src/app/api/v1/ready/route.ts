import { NextResponse } from "next/server";
import { APP_NAME, APP_VERSION } from "@/constants/release";
import { getServerConfig } from "@/config/env";
import { databasePersistenceEnabled } from "@/services/database/persistence";
import { getSuiNetworkStatus } from "@/services/sui/rpc";
import { getDeploymentStatus } from "@/services/system/deployment";
import { logEvent } from "@/services/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DependencyCheck = {
  name: "sui" | "database";
  required: boolean;
  ok: boolean;
  latencyMs: number;
};

async function assertDatabaseReadyWhenRequired() {
  const requested = process.env.DATABASE_PERSISTENCE_ENABLED === "true";
  const configured = Boolean(process.env.DATABASE_URL?.trim());
  if (!requested) return { configured, persistence: false };
  if (!configured) throw new Error("DATABASE_PERSISTENCE_ENABLED=true requires DATABASE_URL");
  if (!databasePersistenceEnabled()) throw new Error("Database persistence is not configured.");
  const { getPrisma } = await import("@db/prisma/client");
  await getPrisma().$queryRawUnsafe("SELECT 1");
  return { configured: true, persistence: true };
}

function timeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out.`)), timeoutMs);
    timer.unref?.();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function timedCheck<T>(
  name: DependencyCheck["name"],
  required: boolean,
  timeoutMs: number,
  work: () => Promise<T>,
): Promise<{ result?: T; check: DependencyCheck; error?: unknown }> {
  const startedAt = Date.now();
  try {
    const result = await timeout(work(), timeoutMs, `${name} readiness check`);
    return {
      result,
      check: { name, required, ok: true, latencyMs: Date.now() - startedAt },
    };
  } catch (error) {
    return {
      error,
      check: { name, required, ok: false, latencyMs: Date.now() - startedAt },
    };
  }
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const config = getServerConfig();
  const readiness = getDeploymentStatus();
  const persistenceRequired = process.env.DATABASE_PERSISTENCE_ENABLED === "true";

  if (!readiness.appReady) {
    logEvent("warn", "readiness.policy_blocked", {
      requestId: request.headers.get("x-request-id") ?? "missing",
      network: config.network,
      maintenanceMode: readiness.maintenanceMode ?? false,
    });
    return NextResponse.json(
      {
        ok: false,
        ready: false,
        service: APP_NAME,
        version: APP_VERSION,
        network: config.network,
        cluster: config.cluster,
        appReady: false,
        swapReady: readiness.swapReady,
        maintenanceMode: readiness.maintenanceMode,
        error: "Deployment policy is not ready.",
        latencyMs: Date.now() - startedAt,
      },
      {
        status: 503,
        headers: {
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
          "retry-after": "5",
        },
      },
    );
  }

  const [networkCheck, databaseCheck] = await Promise.all([
    timedCheck("sui", true, config.readinessTimeoutMs, () => getSuiNetworkStatus()),
    timedCheck("database", persistenceRequired, config.readinessTimeoutMs, () => assertDatabaseReadyWhenRequired()),
  ]);
  const checks = [networkCheck.check, databaseCheck.check];
  const requiredFailure = checks.some((check) => check.required && !check.ok);

  if (requiredFailure || !networkCheck.result || !databaseCheck.result) {
    const failed = checks.filter((check) => check.required && !check.ok).map((check) => check.name).join(",");
    logEvent("warn", "readiness.dependency_failed", {
      requestId: request.headers.get("x-request-id") ?? "missing",
      network: config.network,
      failedDependencies: failed || "unknown",
      latencyMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      {
        ok: false,
        ready: false,
        service: APP_NAME,
        version: APP_VERSION,
        network: config.network,
        cluster: config.cluster,
        appReady: readiness.appReady,
        swapReady: readiness.swapReady,
        maintenanceMode: readiness.maintenanceMode,
        checks,
        error: "Service dependencies are not ready.",
        latencyMs: Date.now() - startedAt,
      },
      {
        status: 503,
        headers: {
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
          "retry-after": "5",
        },
      },
    );
  }

  const network = networkCheck.result;
  const database = databaseCheck.result;
  return NextResponse.json(
    {
      ok: true,
      ready: true,
      service: APP_NAME,
      version: APP_VERSION,
      network: config.network,
      cluster: config.cluster,
      checkpoint: network.checkpoint,
      epoch: network.epoch,
      transport: network.transport,
      appReady: readiness.appReady,
      swapReady: readiness.swapReady,
      maintenanceMode: readiness.maintenanceMode,
      capabilities: readiness.capabilities,
      database,
      checks,
      warnings: readiness.warnings,
      latencyMs: Date.now() - startedAt,
    },
    { headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } },
  );
}
