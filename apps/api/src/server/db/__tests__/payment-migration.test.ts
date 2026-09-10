import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "..",
  "..",
  "supabase",
  "migrations",
  "202606250020_payments.sql"
);
const migrationSql = readFileSync(migrationPath, "utf8").toLowerCase();

describe("payment migration", () => {
  it("adds payOS payment orders and events with closed statuses", () => {
    expect(migrationSql).toContain("create type payment_provider as enum ('payos')");
    expect(migrationSql).toContain("create type payment_order_status as enum");
    for (const status of [
      "created",
      "pending",
      "succeeded",
      "failed",
      "canceled",
      "needs_review"
    ]) {
      expect(migrationSql).toContain(`'${status}'`);
    }
    expect(migrationSql).toContain("create table payment_orders");
    expect(migrationSql).toContain("create table payment_events");
    expect(migrationSql).toContain("currency text not null default 'vnd' check (currency = 'vnd')");
    expect(migrationSql).toContain("unique (provider, provider_order_code)");
    expect(migrationSql).toContain("unique (provider, event_dedupe_key)");
  });

  it("keeps payment tables indexed, backend-owned, and RLS protected", () => {
    expect(migrationSql).toContain("payment_orders_active_quote_idx");
    expect(migrationSql).toContain("payment_events_order_received_idx");
    expect(migrationSql).toContain("alter table payment_orders enable row level security");
    expect(migrationSql).toContain("alter table payment_events enable row level security");
    expect(migrationSql).toContain("revoke all on payment_orders from anon");
    expect(migrationSql).toContain("revoke all on payment_events from authenticated");
    expect(migrationSql).toContain("create policy payment_orders_rider_select");
    expect(migrationSql).toContain("create policy payment_orders_mechanic_select");
  });

  it("does not add refund, payout, settlement, or card storage", () => {
    expect(migrationSql).not.toMatch(/\brefund(?:s|ed|_|\b)/);
    expect(migrationSql).not.toMatch(/\bpayout(?:s|_|\b)/);
    expect(migrationSql).not.toMatch(/\bsettlement(?:s|_|\b)/);
    expect(migrationSql).not.toMatch(/\b(card_number|cvv|pan|expiry)\b/);
  });
});
