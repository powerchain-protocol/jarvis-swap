import fs from "node:fs";
const read = (p) => fs.readFileSync(p, "utf8");
const failures = [];
const release = read("src/constants/release.ts");
const h1 = read("src/app/api/health/route.ts");
const h2 = read("src/app/api/v1/health/route.ts");
const ready = read("src/app/api/v1/ready/route.ts");
const env = read("src/config/env.ts");
const deployment = read("src/services/system/deployment.ts");
if (!release.includes('APP_VERSION = "1.0.0-rc.15"')) failures.push("Canonical release version missing.");
if (/1\.0\.0-rc\.(1|6)\b/.test(h1 + h2)) failures.push("Stale health endpoint version remains.");
if (!h1.includes("APP_VERSION") || !h2.includes("APP_VERSION")) failures.push("Health endpoints must use canonical release metadata.");
if (!ready.includes("JARVIS_READINESS_TIMEOUT_MS") && !env.includes("JARVIS_READINESS_TIMEOUT_MS")) failures.push("Readiness timeout must be configurable.");
if (!ready.includes("timeout(") || !ready.includes('"retry-after": "5"')) failures.push("Readiness must be bounded and retryable.");
if (!env.includes("JARVIS_MAINTENANCE_MODE") || !deployment.includes("maintenanceMode")) failures.push("Maintenance mode must gate readiness.");
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log("Lifecycle invariants: PASS");
