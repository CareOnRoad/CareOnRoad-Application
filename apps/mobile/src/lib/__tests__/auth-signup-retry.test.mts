import assert from "node:assert/strict";
import { mock, test } from "node:test";

import { mockNativeModules } from "../../../scripts/__tests__/native-mocks.mjs";

/**
 * Kịch bản lỗi thật đã tái hiện trên production:
 *
 *   Lần 1 signup OK, session=True
 *   Lần 2 signup ERR => 422 Unprocessable Entity
 *   Login OK, session=True
 *
 * Nguyên nhân: `signUp` gọi Supabase TRƯỚC rồi mới bootstrap profile ở BE.
 * Nếu bootstrap lỗi (mạng chập chờn), tài khoản Supabase đã tạo nhưng
 * `app_users` chưa có. User thử đăng ký lại -> Supabase trả
 * "User already registered" -> app báo "Email này đã được sử dụng" và
 * user bị kẹt vĩnh viễn ở màn đăng ký, không biết phải đăng nhập.
 *
 * Hành vi mong muốn: khi Supabase báo user đã tồn tại, app phải tự thử
 * đăng nhập và bootstrap profile thay vì báo lỗi.
 */

type AuthClientStub = {
  auth: {
    signUp: (input: unknown) => Promise<{ data: { session: unknown }; error: { message: string } | null }>;
    signInWithPassword: (input: unknown) => Promise<{ data: { session: unknown }; error: { message: string } | null }>;
    getSession: () => Promise<{ data: { session: { access_token: string } | null } }>;
    signOut: () => Promise<{ error: unknown }>;
  };
};

const session = {
  access_token: "token-abc",
  user: {
    id: "11111111-1111-4111-8111-111111111111",
    email: "rider@example.com",
    user_metadata: { full_name: "Nguyen Van A", account_type: "rider" },
  },
};

const actor = {
  id: "11111111-1111-4111-8111-111111111111",
  display_name: "Nguyen Van A",
  roles: ["rider"],
  status: "active",
};

// `mock.module` chỉ được gọi 1 lần cho mỗi module, nên dùng holder để
// mỗi test đổi được client mà không mock lại.
const clientHolder: { current: AuthClientStub | null } = { current: null };

mockNativeModules();
mock.module("@/lib/supabase-client", {
  namedExports: {
    getSupabase: () => clientHolder.current,
  },
});

/**
 * Backend được giả lập bằng global `fetch`:
 *  - `GET /api/v1/auth/me` -> 404 (chưa có profile)
 *  - `POST /api/v1/auth/profile` -> 200 actor
 */
function stubBackendFetch(): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("/api/v1/auth/me")) {
      return new Response(
        JSON.stringify({ error_code: "NOT_FOUND", message: "Application profile not found." }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.endsWith("/api/v1/auth/profile")) {
      return new Response(JSON.stringify(actor), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

test("signUp falls back to signing in when the account already exists", async () => {
  clientHolder.current = {
    auth: {
      signUp: async () => ({
        data: { session: null },
        error: { message: "User already registered" },
      }),
      signInWithPassword: async () => ({ data: { session }, error: null }),
      getSession: async () => ({ data: { session } }),
      signOut: async () => ({ error: null }),
    },
  };

  const restoreFetch = stubBackendFetch();
  try {
    const { signUp } = await import("@/lib/auth-service");
    const result = await signUp({
      role: "rider",
      name: "Nguyen Van A",
      email: "rider@example.com",
      password: "Test@123456",
    });

    assert.equal(result.needsEmailConfirmation, false);
    if (result.needsEmailConfirmation) {
      throw new Error("Expected a full session.");
    }
    assert.equal(result.user.email, "rider@example.com");
    assert.equal(result.user.role, "rider");
  } finally {
    restoreFetch();
  }
});

test("signUp still surfaces a helpful error when the fallback sign-in fails", async () => {
  clientHolder.current = {
    auth: {
      signUp: async () => ({
        data: { session: null },
        error: { message: "User already registered" },
      }),
      signInWithPassword: async () => ({
        data: { session: null },
        error: { message: "Invalid login credentials" },
      }),
      getSession: async () => ({ data: { session: null } }),
      signOut: async () => ({ error: null }),
    },
  };

  const restoreFetch = stubBackendFetch();
  try {
    const { signUp } = await import("@/lib/auth-service");

    await assert.rejects(
      () =>
        signUp({
          role: "rider",
          name: "Nguyen Van A",
          email: "rider@example.com",
          password: "Test@123456",
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.ok(
          error.message.includes("Email này đã được sử dụng") ||
            error.message.includes("Email hoặc mật khẩu không đúng"),
          `Unexpected message: ${error.message}`,
        );
        return true;
      },
    );
  } finally {
    restoreFetch();
  }
});
