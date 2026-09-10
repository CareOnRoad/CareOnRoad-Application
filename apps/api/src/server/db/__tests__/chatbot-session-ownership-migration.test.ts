import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const sql = readFileSync(resolve(process.cwd(), "../../supabase/migrations/202606250030_chatbot_session_ownership.sql"), "utf8").toLowerCase();
describe("chatbot session ownership migration", () => {
  it("stores only a constrained credential hash and claim time", () => {
    expect(sql).toContain("owner_credential_hash text"); expect(sql).toContain("^[a-f0-9]{64}$");
    expect(sql).toContain("owner_claimed_at timestamptz"); expect(sql).not.toContain("owner_credential text");
  });
});
