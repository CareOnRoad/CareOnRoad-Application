import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "../../supabase/migrations/202606250023_notification_provider_delivery.sql"
  ),
  "utf8"
).toLowerCase();

describe("notification provider delivery migration", () => {
  it("deduplicates each notification and immutable credential version", () => {
    expect(sql).toContain("create table notification_delivery_receipts");
    expect(sql).toContain(
      "unique (notification_id, credential_id, credential_version)"
    );
    expect(sql).toContain("notification_delivery_receipts_notification_status_idx");
    expect(sql).toContain("retryable_failed");
  });

  it("keeps credentials and raw provider payloads out of receipts", () => {
    expect(sql).not.toMatch(/\b(raw_token|credential_ciphertext|authorization_header|provider_payload)\b/);
    expect(sql).toContain("alter table notification_delivery_receipts enable row level security");
    expect(sql).toContain(
      "revoke all on table notification_delivery_receipts from anon, authenticated"
    );
  });
});
