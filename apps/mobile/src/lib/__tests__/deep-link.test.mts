import assert from "node:assert/strict";
import test from "node:test";

import {
  CANONICAL_OAUTH_REDIRECT_URL,
  extractOAuthCode,
  isOAuthCallbackUrl,
  resolveDeepLinkPath,
} from "@/lib/deep-link";

/**
 * Regression tests cho lỗi "Unmatched Route" khi đăng nhập Google.
 *
 * Bối cảnh: Expo Router coi "host + pathname" của URL native là route path.
 * URL OAuth callback (`careonroad://auth/callback?code=...`) và URL dev client
 * (`careonroad://<ip>:<port>/...`) không khớp route nào trong `app/` → màn
 * "Unmatched Route" của Expo Router.
 *
 * Nguồn gốc lỗi: `createURL('auth/callback')` nhúng `hostUri` của dev server
 * vào URL, sinh ra `careonroad://<ip>:<port>auth/callback` — thiếu dấu `/`,
 * là URL KHÔNG hợp lệ, và thay đổi theo IP Wi-Fi nên không khai báo trước
 * được trong Supabase Dashboard.
 */

test("canonical OAuth redirect URL khớp intent filter Android", () => {
  assert.equal(CANONICAL_OAUTH_REDIRECT_URL, "careonroad://auth/callback");

  // Intent filter khai báo scheme=careonroad, host=auth, pathPrefix=/callback.
  const parsed = new URL(CANONICAL_OAUTH_REDIRECT_URL);
  assert.equal(parsed.protocol, "careonroad:");
  assert.equal(parsed.host, "auth");
  assert.equal(parsed.pathname, "/callback");
});

test("OAuth callback URL được đưa về route '/' (không phải +not-found)", () => {
  assert.equal(
    resolveDeepLinkPath("careonroad://auth/callback?code=abc123"),
    "/",
  );
});

test("OAuth callback của dev client cũng được đưa về route '/'", () => {
  assert.equal(
    resolveDeepLinkPath("careonroad://192.168.1.172:8081/auth/callback?code=abc123"),
    "/",
  );
});

test("OAuth callback của Expo Go cũng được đưa về route '/'", () => {
  assert.equal(
    resolveDeepLinkPath("exp://192.168.1.172:8081/--/auth/callback?code=abc123"),
    "/",
  );
});

test("root URL của dev client không còn rơi vào +not-found", () => {
  // `careonroad://192.168.1.172:8081/` từng được Expo Router hiểu thành
  // path "192.168.1.172:8081/" → không khớp route → "Unmatched Route".
  assert.equal(resolveDeepLinkPath("careonroad://192.168.1.172:8081/"), "/");
});

test("root URL của dev client không có dấu slash cuối cũng về '/'", () => {
  assert.equal(resolveDeepLinkPath("careonroad://192.168.1.172:8081"), "/");
});

test("deep link thường của dev client giữ lại path thật", () => {
  assert.equal(
    resolveDeepLinkPath("careonroad://192.168.1.172:8081/rider/history"),
    "/rider/history",
  );
});

test("deep link của Expo Go bỏ được tiền tố '/--/'", () => {
  assert.equal(
    resolveDeepLinkPath("exp://192.168.1.172:8081/--/rider/history"),
    "/rider/history",
  );
});

test("URL có hình dạng chuẩn (host không chứa port) được giữ nguyên", () => {
  assert.equal(
    resolveDeepLinkPath("careonroad://rider/history"),
    "careonroad://rider/history",
  );
});

test("URL rỗng không gây lỗi", () => {
  assert.equal(resolveDeepLinkPath(""), "");
});

test("isOAuthCallbackUrl nhận diện được mọi hình dạng URL callback", () => {
  assert.equal(isOAuthCallbackUrl("careonroad://auth/callback?code=abc"), true);
  assert.equal(isOAuthCallbackUrl("careonroad://192.168.1.172:8081/auth/callback?code=abc"), true);
  assert.equal(isOAuthCallbackUrl("exp://192.168.1.172:8081/--/auth/callback?code=abc"), true);
  assert.equal(isOAuthCallbackUrl("careonroad://rider/history"), false);
  assert.equal(isOAuthCallbackUrl(""), false);
});

test("extractOAuthCode lấy được code từ mọi hình dạng URL callback", () => {
  assert.equal(extractOAuthCode("careonroad://auth/callback?code=abc123"), "abc123");
  assert.equal(
    extractOAuthCode("careonroad://192.168.1.172:8081/auth/callback?code=abc123"),
    "abc123",
  );
  assert.equal(
    extractOAuthCode("exp://192.168.1.172:8081/--/auth/callback?code=abc123"),
    "abc123",
  );
});

test("extractOAuthCode đọc được code khi có thêm tham số khác", () => {
  assert.equal(
    extractOAuthCode("careonroad://auth/callback?error=denied&code=abc123"),
    "abc123",
  );
});

test("extractOAuthCode giải mã percent-encoding", () => {
  assert.equal(
    extractOAuthCode("careonroad://auth/callback?code=a%2Fb%2Bc"),
    "a/b+c",
  );
});

test("extractOAuthCode trả null khi URL không có code", () => {
  assert.equal(extractOAuthCode("careonroad://auth/callback"), null);
  assert.equal(extractOAuthCode("careonroad://auth/callback?error=denied"), null);
  assert.equal(extractOAuthCode("careonroad://auth/callback?code="), null);
  assert.equal(extractOAuthCode(""), null);
});

test("extractOAuthCode không throw với URL native không hợp lệ", () => {
  // URL do dev client sinh ra trước đây: `new URL()` sẽ throw.
  const malformed = "careonroad://192.168.1.172:8081auth/callback?code=abc123";
  assert.throws(() => new URL(malformed));
  assert.equal(extractOAuthCode(malformed), "abc123");
});
