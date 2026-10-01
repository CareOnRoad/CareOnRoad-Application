/* global console, fetch, URL, AbortSignal */
import process from "node:process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";

for (const relative of ["../.env.local", "../../../.env.local"]) {
  const file = fileURLToPath(new URL(relative, import.meta.url));
  if (existsSync(file)) process.loadEnvFile(file);
}
const check = process.argv.includes("--check");
const watch = process.argv.includes("--watch");
const origin = new URL(process.env.WORKER_API_BASE_URL || "http://localhost:3000");
if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash ||
  (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname)))) {
  throw new Error("WORKER_API_BASE_URL must be an HTTPS origin or local HTTP origin.");
}
if (!process.env.INTERNAL_WORKER_SECRET?.trim()) throw new Error("INTERNAL_WORKER_SECRET is required.");
const paymentsEnabled = process.env.PAYMENTS_ENABLED === "true";
const missing = ["PAYOS_CLIENT_ID", "PAYOS_API_KEY", "PAYOS_CHECKSUM_KEY", "PAYOS_RETURN_URL", "PAYOS_CANCEL_URL"]
  .filter((name) => !process.env[name]?.trim());
if (paymentsEnabled && missing.length) throw new Error(`Missing configuration: ${missing.join(", ")}.`);
if (check) {
  console.log(JSON.stringify({ worker_secret_configured: true, payments_enabled: paymentsEnabled,
    payment_configuration_complete: missing.length === 0 }));
} else {
  await Promise.all(["reminders/run", "outbox/run", "dispatch/run", ...(paymentsEnabled ? ["payments/reconcile?limit=1"] : [])]
    .map(async (route) => {
      do {
        try {
          const response = await fetch(new URL(`/api/v1/internal/workers/${route}`, origin), {
            method: "POST", headers: { "X-Worker-Secret": process.env.INTERNAL_WORKER_SECRET }, signal: AbortSignal.timeout(300_000)
          });
          const result = await response.json().catch(() => ({}));
          const counts = Object.fromEntries(Object.entries(result).filter(([key, value]) =>
            ["claimed", "generated", "queued", "processed", "retried", "deadLettered", "leaseLost", "succeeded", "needs_review", "still_pending", "failed"].includes(key) && Number.isSafeInteger(value)));
          const ok = response.ok && !(counts.failed > 0 || counts.deadLettered > 0 || counts.retried > 0 || counts.leaseLost > 0);
          if (!ok && !watch) process.exitCode = 1;
          console.log(JSON.stringify({ worker: route.split("?")[0], http_status: response.status, ok, ...counts }));
        } catch {
          if (!watch) process.exitCode = 1;
          console.error(JSON.stringify({ worker: route.split("?")[0], ok: false, error: "worker_request_failed" }));
        }
        if (!watch) break;
        await setTimeout(30_000);
      } while (watch);
    }));
}
