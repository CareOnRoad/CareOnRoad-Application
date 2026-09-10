import { describe, expect, it } from "vitest";

import {
  adminCommandEnvelopeSchema,
  adminCommonFilterSchema,
  adminDateRangeSchema,
  adminIdempotencyKeySchema,
  adminPaginationSchema,
  adminReasonSchema,
  adminRoleFilterSchema,
  adminUserStatusFilterSchema,
  adminUuidSchema
} from "../admin.schemas";
import {
  readAdminIdempotencyKey,
  readAdminJson,
  toAdminPageResponse
} from "../admin-route-helpers";

describe("admin shared schemas", () => {
  it("requires a trimmed reason between 10 and 500 characters", () => {
    expect(adminReasonSchema.safeParse({}).success).toBe(false);
    expect(adminReasonSchema.safeParse({ reason: "         " }).success).toBe(false);
    expect(adminReasonSchema.safeParse({ reason: "too short" }).success).toBe(false);
    expect(adminReasonSchema.parse({ reason: "  Operational correction  " })).toEqual({
      reason: "Operational correction"
    });
    expect(adminReasonSchema.safeParse({ reason: "x".repeat(501) }).success).toBe(false);
  });

  it("validates UUIDs and bounded cursor pagination", () => {
    expect(adminUuidSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(
      adminUuidSchema.safeParse("11111111-1111-4111-8111-111111111111").success
    ).toBe(true);
    expect(adminPaginationSchema.parse({})).toEqual({ limit: 50 });
    expect(adminPaginationSchema.parse({ cursor: "opaque", limit: "100" })).toEqual({
      cursor: "opaque",
      limit: 100
    });
    expect(adminPaginationSchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(adminPaginationSchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(adminPaginationSchema.safeParse({ cursor: "x".repeat(501) }).success).toBe(
      false
    );
  });

  it("validates ordered date ranges and closed enum filters", () => {
    expect(
      adminDateRangeSchema.safeParse({
        from: "2026-07-05T00:00:00+07:00",
        to: "2026-07-04T00:00:00+07:00"
      }).success
    ).toBe(false);
    expect(adminRoleFilterSchema.safeParse("owner").success).toBe(false);
    expect(adminRoleFilterSchema.safeParse("admin").success).toBe(true);
    expect(adminUserStatusFilterSchema.safeParse("disabled").success).toBe(false);
    expect(adminUserStatusFilterSchema.safeParse("suspended").success).toBe(true);
    expect(
      adminCommonFilterSchema.safeParse({ query: " rider ", role: "rider" }).success
    ).toBe(true);
  });

  it("validates idempotency headers and command envelopes", () => {
    expect(adminIdempotencyKeySchema.safeParse("short").success).toBe(false);
    expect(adminIdempotencyKeySchema.safeParse("valid-key").success).toBe(true);
    expect(
      adminCommandEnvelopeSchema.safeParse({
        reason: "Valid admin reason",
        idempotencyKey: "admin-key-001"
      }).success
    ).toBe(true);
  });

  it("parses shared admin route inputs and shapes cursor responses", async () => {
    const request = new Request("http://localhost/api/v1/admin/test", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-idempotency-key": "admin-key-001"
      },
      body: JSON.stringify({ reason: "Valid admin reason" })
    });

    expect(readAdminIdempotencyKey(request)).toBe("admin-key-001");
    await expect(readAdminJson(request)).resolves.toEqual({
      reason: "Valid admin reason"
    });
    expect(
      toAdminPageResponse({ items: [{ id: "one" }], limit: 1, nextCursor: "next" })
    ).toEqual({
      items: [{ id: "one" }],
      page: { limit: 1, has_more: true, next_cursor: "next" }
    });
  });
});
