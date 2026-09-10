import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "../../supabase/migrations/202606250022_push_device_tokens.sql"),
  "utf8"
).toLowerCase();

describe("push device token migration", () => {
  it("isolates encrypted material and enforces one active credential", () => {
    expect(sql).toContain("create table device_delivery_credentials");
    for (const column of [
      "credential_ciphertext",
      "credential_iv",
      "credential_tag",
      "credential_fingerprint",
      "credential_version",
      "disabled_reason"
    ]) {
      expect(sql).toContain(column);
    }
    expect(sql).toContain("device_delivery_credentials_one_active_fingerprint_idx");
    expect(sql).toContain("device_delivery_credentials_one_active_device_idx");
    expect(sql).toContain("where enabled = true");
    expect(sql).toContain("credential_ciphertext is null");
  });

  it("keeps raw token columns and client access out of schema", () => {
    expect(sql).not.toMatch(/\b(raw_token|push_token_plaintext|delivery_token)\b/);
    expect(sql).not.toMatch(/grant\s+(insert|update|delete|all)/);
    expect(sql).toContain("alter table device_delivery_credentials enable row level security");
    expect(sql).toContain(
      "revoke all on table device_delivery_credentials from anon, authenticated"
    );
  });
});
