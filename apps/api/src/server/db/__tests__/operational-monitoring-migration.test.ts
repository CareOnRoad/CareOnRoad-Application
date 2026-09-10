import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "../../supabase/migrations/202606250028_operational_monitoring.sql"), "utf8").toLowerCase();

describe("operational monitoring migration", () => {
  it("creates an append-only worker run model and bounded queue indexes", () => {
    for (const value of [
      "create table worker_run_records",
      "worker_run_records_completed_idx",
      "outbox_events_dead_letter_created_idx",
      "payment_orders_needs_review_updated_idx",
      "service_requests_dispatch_stuck_idx",
      "worker_run_records_reject_update",
      "alter table worker_run_records enable row level security"
    ]) expect(sql).toContain(value);
    expect(sql).not.toMatch(/payload\s+json/);
  });
});
