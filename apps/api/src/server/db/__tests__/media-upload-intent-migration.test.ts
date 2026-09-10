import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "../../supabase/migrations/202606250025_media_upload_intents.sql"),
  "utf8"
).toLowerCase();

describe("media upload intent migration", () => {
  it("enforces bound resources, private credentials, terminal state, and cleanup indexes", () => {
    expect(sql).toContain("create table media_upload_intents");
    expect(sql).toContain("resource_type in ('service_request', 'assignment')");
    expect(sql).toContain("content_type in ('image/jpeg', 'image/png', 'image/webp')");
    expect(sql).toContain("size_bytes between 1 and 8388608");
    expect(sql).toContain("sha256 ~ '^[0-9a-f]{64}$'");
    expect(sql).toContain("object_key text not null unique");
    expect(sql).toContain("media_upload_intents_cleanup_idx");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("revoke all on media_upload_intents from authenticated");
  });
});
