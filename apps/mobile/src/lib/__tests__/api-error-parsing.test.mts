import assert from "node:assert/strict";
import test from "node:test";

import { ApiError, apiRequest } from "@/lib/api";

/**
 * BE trả error body dạng PHẲNG: `{ error_code, message, details, request_id }`
 * (xem `apps/api/src/lib/api-error.ts` -> `createApiErrorBody`).
 *
 * `api.ts` trước đây chỉ đọc format NESTED (`body.error.code`), nên mọi
 * message BE trả về đều bị thay bằng chuỗi chung "Yêu cầu thất bại (HTTP xxx)".
 */
test("apiRequest preserves the backend error_code from a flat error body", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        error_code: "INVALID_TOKEN",
        message: "The Supabase access token is invalid.",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    )) as typeof fetch;

  try {
    await assert.rejects(
      () => apiRequest("/api/v1/auth/me"),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 401);
        assert.equal(error.code, "INVALID_TOKEN");
        assert.equal(error.message, "The Supabase access token is invalid.");
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("apiRequest still supports the legacy nested error body", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        error: {
          code: "CONFLICT",
          message: "The database rejected a conflicting change.",
          details: { reason: "state" },
        },
      }),
      { status: 409, headers: { "Content-Type": "application/json" } },
    )) as typeof fetch;

  try {
    await assert.rejects(
      () => apiRequest("/api/v1/assignments/abc/status"),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 409);
        assert.equal(error.code, "CONFLICT");
        assert.equal(error.message, "The database rejected a conflicting change.");
        assert.deepEqual(error.details, { reason: "state" });
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
