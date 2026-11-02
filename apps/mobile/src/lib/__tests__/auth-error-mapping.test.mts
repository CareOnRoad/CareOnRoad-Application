import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "@/lib/api";
import { mapActorError, mapSupabaseError } from "@/lib/auth-errors";

/**
 * `@supabase/auth-js` bọc lỗi native của Expo thành `AuthRetryableFetchError`
 * với message lấy nguyên từ lỗi gốc, tức là `"fetch failed: ..."`.
 *
 * `mapSupabaseError` trước đây chỉ dò chuỗi `'network'` nên không bắt được,
 * khiến nguyên chuỗi thô hiện lên UI.
 */
test("mapSupabaseError translates an Expo native fetch failure", () => {
  const error = mapSupabaseError({
    message: "fetch failed: The operation was aborted.",
  });

  assert.equal(error.message, "Không thể kết nối tới máy chủ xác thực");
  assert.ok(!error.message.includes("fetch failed"));
});

test("mapSupabaseError translates a plain network failure", () => {
  const error = mapSupabaseError({ message: "Network request failed" });
  assert.equal(error.message, "Không thể kết nối tới máy chủ xác thực");
});

test("mapSupabaseError translates a Cloudflare gateway timeout", () => {
  const error = mapSupabaseError({ message: "HTTP 524" });
  assert.equal(error.message, "Không thể kết nối tới máy chủ xác thực");
});

test("mapSupabaseError keeps the existing translations intact", () => {
  assert.equal(
    mapSupabaseError({ message: "Invalid login credentials" }).message,
    "Email hoặc mật khẩu không đúng",
  );
  assert.equal(
    mapSupabaseError({ message: "User already registered" }).message,
    "Email này đã được sử dụng",
  );
  assert.equal(
    mapSupabaseError({ message: "Email not confirmed" }).message,
    "Email chưa được xác nhận. Vui lòng kiểm tra hộp thư.",
  );
  assert.equal(
    mapSupabaseError({ message: "Rate limit exceeded" }).message,
    "Quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.",
  );
});

test("mapActorError keeps the root cause for a network failure", () => {
  const error = mapActorError(
    new ApiError(0, "NETWORK_ERROR", "fetch failed: The operation was aborted."),
  );

  assert.ok(!error.message.includes("fetch failed"));
  assert.equal(error.message, "Không thể kết nối tới máy chủ");
});

test("mapActorError reports a timeout distinctly from a generic network failure", () => {
  const error = mapActorError(
    new ApiError(0, "NETWORK_ERROR", "Yêu cầu bị huỷ do hết thời gian chờ"),
  );

  assert.equal(error.message, "Yêu cầu bị huỷ do hết thời gian chờ");
});

test("mapActorError still reports a locked account for 401 and 403", () => {
  for (const status of [401, 403]) {
    const error = mapActorError(new ApiError(status, "UNAUTHORIZED", "nope"));
    assert.equal(
      error.message,
      "Tài khoản đang bị khóa hoặc không còn hoạt động. Vui lòng liên hệ hỗ trợ.",
    );
  }
});
