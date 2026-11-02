import assert from "node:assert/strict";
import test from "node:test";

import { ApiError, apiRequest } from "@/lib/api";

/**
 * Lỗi "fetch failed" chỉ xảy ra trên bản RELEASE.
 *
 * Ở release build, `fetch` là native của Expo
 * (`expo/src/winter/fetch/fetch.ts`), và mọi lỗi đều bị bọc thành
 * `FetchError` với message `"fetch failed: <nguyên nhân>"` và `name === "Error"`.
 *
 * Vì vậy nhánh `err.name === 'AbortError'` của `api.ts` KHÔNG bao giờ khớp
 * trong release, và timeout bị đẩy nguyên chuỗi thô lên UI.
 */

async function captureFetchError(
  thrown: unknown,
): Promise<ApiError> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw thrown;
  }) as typeof fetch;

  try {
    await apiRequest("/api/v1/auth/me");
    throw new Error("Expected apiRequest to reject.");
  } catch (error) {
    assert.ok(error instanceof ApiError, "Expected an ApiError.");
    return error;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("a standard AbortError is reported as a timeout", async () => {
  const abortError = Object.assign(new Error("The operation was aborted."), {
    name: "AbortError",
  });
  const error = await captureFetchError(abortError);

  assert.equal(error.code, "NETWORK_ERROR");
  assert.equal(error.message, "Yêu cầu bị huỷ do hết thời gian chờ");
});

test("the Expo native fetch error for an aborted request is reported as a timeout", async () => {
  // Đây là lỗi thật của release build: Expo bọc mọi lỗi native thành
  // `FetchError` -> message "fetch failed: ...", `name` = "Error".
  const expoFetchError = new Error("fetch failed: The operation was aborted.");
  expoFetchError.name = "Error";

  const error = await captureFetchError(expoFetchError);

  assert.equal(error.code, "NETWORK_ERROR");
  assert.equal(error.message, "Yêu cầu bị huỷ do hết thời gian chờ");
  assert.ok(
    !error.message.includes("fetch failed"),
    "Raw 'fetch failed' text must never reach the UI.",
  );
});

test("a TimeoutError is reported as a timeout", async () => {
  const timeoutError = Object.assign(new Error("The operation timed out."), {
    name: "TimeoutError",
  });
  const error = await captureFetchError(timeoutError);

  assert.equal(error.code, "NETWORK_ERROR");
  assert.equal(error.message, "Yêu cầu bị huỷ do hết thời gian chờ");
});

test("a genuine connectivity failure is a network error, not a timeout", async () => {
  const networkError = new Error("fetch failed: Network request failed");
  networkError.name = "Error";

  const error = await captureFetchError(networkError);

  assert.equal(error.code, "NETWORK_ERROR");
  assert.notEqual(error.message, "Yêu cầu bị huỷ do hết thời gian chờ");
  assert.ok(
    !error.message.includes("fetch failed"),
    "Raw 'fetch failed' text must never reach the UI.",
  );
});
