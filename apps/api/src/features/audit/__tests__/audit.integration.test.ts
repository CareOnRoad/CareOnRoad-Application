import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "../../supabase/migrations/202606250012_notifications_outbox_audit.sql"
  ),
  "utf8"
).toLowerCase();

describe("audit hardening integration", () => {
  it("declares audit update, delete, and truncate as append-only operations", () => {
    expect(migration).toContain("audit_logs_reject_update_delete");
    expect(migration).toContain("audit_logs_reject_truncate");
    expect(migration).toContain("before truncate on audit_logs");
  });

  it("sanitizes prohibited metadata at the repository boundary and enforces database checks", async () => {
    const unitOfWork = new InMemoryUnitOfWork();
    await unitOfWork.execute(({ audit }) =>
      audit.append({
        id: "audit-1",
        action: "notification.failed",
        entityType: "notification",
        metadata: {
          status: "failed",
          error_code: "TIMEOUT",
          authorization: "Bearer private",
          raw_audio: "private audio",
          diagnosis_text: "private diagnosis",
          payment_card: "4111111111111111"
        }
      })
    );
    expect(unitOfWork.snapshot().auditLogs[0]?.metadata).toEqual({
      status: "failed",
      error_code: "TIMEOUT"
    });
    expect(migration).toContain("contains_prohibited_metadata");
    expect(migration).toContain("audit_metadata_sanitized_check");
    expect(migration).toContain("outbox_payload_sanitized_check");
  });
});
