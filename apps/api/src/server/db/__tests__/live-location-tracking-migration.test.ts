import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "../../supabase/migrations/202606250032_live_location_tracking.sql"),
  "utf8"
).toLowerCase();

describe("live location tracking migration", () => {
  it("stores exactly one constrained expiring point per assignment", () => {
    expect(sql).toContain("create table assignment_live_locations");
    expect(sql).toContain("assignment_id uuid primary key");
    expect(sql).toContain("geography(point, 4326)");
    expect(sql).toContain("accuracy_meters >= 0 and accuracy_meters <= 100");
    expect(sql).toContain("expires_at > received_at");
    expect(sql).toContain("assignment_live_locations_expiry_idx");
  });

  it("enforces assignment identity/lifecycle cleanup and RLS", () => {
    expect(sql).toContain("assignment_live_locations_assignment_mechanic_fk");
    expect(sql).toContain("validate_assignment_live_location");
    expect(sql).toContain("purge_assignment_live_location_on_status_change");
    expect(sql).toContain("new.status not in ('accepted', 'en_route')");
    expect(sql).toContain("alter table assignment_live_locations enable row level security");
    expect(sql).not.toMatch(/create policy .*assignment_live_locations/);
  });
});
