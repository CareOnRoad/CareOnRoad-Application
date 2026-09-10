import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "../../supabase/migrations/202606250029_distributed_runtime_controls.sql"), "utf8").toLowerCase();
describe("distributed runtime controls migration", () => {
  it("defines atomic, expiring and private shared controls", () => {
    expect(sql).toContain("create table runtime_rate_limit_buckets");
    expect(sql).toContain("create function consume_runtime_rate_limit_bucket");
    expect(sql).toContain("create table provider_circuit_states");
    expect(sql).toContain("create function record_provider_circuit_failure");
    expect(sql).toContain("cleanup_runtime_control_state");
    expect(sql.match(/enable row level security/g)).toHaveLength(2);
  });
});
