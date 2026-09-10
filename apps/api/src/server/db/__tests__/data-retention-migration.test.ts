import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const sql = readFileSync(resolve(process.cwd(), "../../supabase/migrations/202606250031_data_retention_worker.sql"), "utf8").toLowerCase();
describe("data retention migration scope", () => {
  it("adds only lease and allowlisted retention indexes", () => {
    expect(sql).toContain("retention_worker_leases");
    for (const table of ["media_upload_intents", "device_delivery_credentials", "worker_run_records"]) expect(sql).toContain(table);
    for (const excluded of ["audit_logs", "payment_orders", "payment_events", "service_requests", "assignments", "quotes"]) expect(sql).not.toContain(excluded);
  });
});
