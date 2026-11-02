import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { InMemoryOutboxRepository } from "@/server/repositories/testing/in-memory-outbox.repository";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { AuthService } from "../auth.service";

/**
 * `outbox_events.dedupe_key` là UNIQUE
 * (supabase/migrations/202606250002_outbox_audit_idempotency.sql:28).
 *
 * `bootstrapProfile` dùng dedupe key cố định
 * `user.profile.bootstrapped:${subject}`, nên nếu hai request bootstrap chạy
 * đồng thời (hoặc một request bootstrap chạy song song với một request
 * `GET /auth/me`) thì request thứ hai sẽ vi phạm unique `23505` ->
 * `DATABASE_CONFLICT` -> HTTP 409 thay vì trả actor.
 *
 * `append` phải idempotent theo dedupe key để loại bỏ nguồn lỗi này.
 */

const identity = {
  subject: "11111111-1111-4111-8111-111111111111",
  issuer: "https://careonroad.supabase.co/auth/v1",
  audience: ["authenticated"]
};

describe("outbox dedupe idempotency", () => {
  it("appends an event once per dedupe key and returns the existing event afterwards", async () => {
    const events: never[] = [];
    const repository = new InMemoryOutboxRepository(events as never);

    const input = {
      id: "22222222-2222-4222-8222-222222222222",
      topic: "user.profile.bootstrapped",
      aggregateType: "app_user",
      aggregateId: identity.subject,
      dedupeKey: `user.profile.bootstrapped:${identity.subject}`,
      payload: { resource_id: identity.subject },
      createdAt: new Date("2026-06-25T00:00:00Z"),
      nextAttemptAt: new Date("2026-06-25T00:00:00Z")
    };

    const first = await repository.append(input);
    const second = await repository.append({
      ...input,
      id: "33333333-3333-4333-8333-333333333333"
    });

    expect(first.id).toBe(input.id);
    expect(second.id).toBe(input.id);
    expect(events).toHaveLength(1);
  });

  it("keeps the postgres adapter idempotent on the unique dedupe_key column", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "src",
        "server",
        "repositories",
        "postgres",
        "outbox.repository.ts"
      ),
      "utf8"
    );

    expect(source).toMatch(/on conflict\s*\(\s*dedupe_key\s*\)\s*do nothing/i);
  });

  it("does not surface a dedupe conflict when the same profile is bootstrapped twice", async () => {
    const unitOfWork = new InMemoryUnitOfWork();
    const service = new AuthService(unitOfWork);

    const first = await service.bootstrapProfile(identity, { account_type: "rider" });
    const second = await service.bootstrapProfile(identity, { account_type: "rider" });

    expect(first.id).toBe(second.id);
    expect(second.roles).toContain("rider");

    const snapshot = unitOfWork.snapshot();
    expect(snapshot.outboxEvents).toHaveLength(1);
    expect(snapshot.userRoles).toHaveLength(1);
  });
});
