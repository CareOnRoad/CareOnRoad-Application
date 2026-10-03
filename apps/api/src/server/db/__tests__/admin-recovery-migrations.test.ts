import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const read = (name: string) => readFileSync(resolve(process.cwd(), "..", "..", "supabase", "migrations", name), "utf8").toLowerCase();
describe("admin recovery ordered migrations", () => {
  it("separates enum commits, protects provenance and preserves immutable domain/audit records", () => {
    for (const name of ["202606250040_admin_quote_status.sql", "202606250042_admin_delivery_statuses.sql"]) {
      const sql = read(name).replace(/--[^\n]*/g, ""); expect(sql).toMatch(/alter type .* add value/); expect(sql).not.toMatch(/create table|alter table|create function/);
    }
    expect(read("202606250039_admin_assignment_provenance.sql")).toContain("supersedes_assignment_id uuid unique");
    expect(read("202606250039_admin_assignment_provenance.sql")).toContain("source = 'offer' and accepted_candidate_id is not null");
    expect(read("202606250041_admin_supervision_actions.sql")).toContain("admin_supervision_append_only");
    expect(read("202606250041_admin_supervision_actions.sql")).toContain("admin_supervision_reject_truncate before truncate");
    expect(read("202606250043_admin_delivery_operations.sql")).toContain("outbox_domain_identity_guard");
    expect(read("202606250043_admin_delivery_operations.sql")).toContain("notifications_canceled_guard");
    expect(read("202606250043_admin_delivery_operations.sql")).not.toMatch(/update audit_logs|delete from audit_logs/);
  });
});
