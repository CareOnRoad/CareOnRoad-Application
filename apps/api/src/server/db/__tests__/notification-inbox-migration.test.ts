import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "../../supabase/migrations/202606250024_notification_inbox_index.sql"),
  "utf8"
).toLowerCase();

describe("notification inbox migration", () => {
  it("adds an owner-scoped partial unread cursor index", () => {
    expect(sql).toContain("notifications_user_unread_created_idx");
    expect(sql).toContain("user_id, created_at desc, id desc");
    expect(sql).toContain("where read_at is null");
  });
});
