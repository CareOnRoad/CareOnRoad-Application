import assert from "node:assert/strict";
import { mock, test } from "node:test";

import { mockNativeModules } from "../../../scripts/__tests__/native-mocks.mjs";

/**
 * Tái hiện lỗi thật trên production:
 *
 *   User đăng ký với email ĐÃ TỒN TẠI ở Supabase + sai mật khẩu.
 *   → signUp trả 422 "User already registered"
 *   → app fallback sang signInWithExistingAccount
 *   → signInWithPassword trả 400 "Invalid login credentials"
 *   → mapSupabaseError map thành "Email hoặc mật khẩu không đúng"
 *
 * Message đó SAI ở màn đăng ký: Supabase đã xác nhận email tồn tại, nên
 * email không sai — chỉ có mật khẩu không khớp. User đọc xong tưởng mình
 * gõ sai email rồi thử đăng ký lại mãi, mỗi lần đều ra cùng lỗi.
 *
 * Hành vi mong muốn: báo đúng nguyên nhân và hướng sang màn Đăng nhập.
 */

type AuthClientStub = {
  auth: {
    signUp: (input: unknown) => Promise<{ data: { session: unknown }; error: { message: string; status?: number } | null }>;
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

const clientHolder: { current: AuthClientStub | null } = { current: null };

mockNativeModules();
mock.module("@/lib/supabase-client", {
  namedExports: {
    getSupabase: () => clientHolder.current,
  },
});

/** Backend giả lập: `/auth/me` 404 → `/auth/profile` 200 actor. */
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
      return new Response(
        JSON.stringify({
          id: "11111111-1111-4111-8111-111111111111",
          display_name: "Nguyen Van A",
          roles: ["rider"],
          status: "active",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

test("signUp explains that the email exists but the password does not match", async () => {
  clientHolder.current = {
    auth: {
      signUp: async () => ({
        data: { session: null },
        error: { message: "User already registered", status: 422 },
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
        // KHÔNG được báo chung "Email hoặc mật khẩu không đúng" ở màn đăng ký.
        assert.ok(
          !error.message.includes("Email hoặc mật khẩu không đúng"),
          `Sai ngữ nghĩa cho màn đăng ký: ${error.message}`,
        );
        assert.ok(
          error.message.includes("đã được sử dụng") && error.message.includes("mật khẩu khác"),
          `Unexpected message: ${error.message}`,
        );
        return true;
      },
    );
  } finally {
    restoreFetch();
  }
});

test("signUp tells the user to confirm the email when it exists but is unconfirmed", async () => {
  clientHolder.current = {
    auth: {
      signUp: async () => ({
        data: { session: null },
        error: { message: "User already registered", status: 422 },
      }),
      signInWithPassword: async () => ({
        data: { session: null },
        error: { message: "Email not confirmed" },
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
          error.message.includes("chưa xác nhận"),
          `Unexpected message: ${error.message}`,
        );
        return true;
      },
    );
  } finally {
    restoreFetch();
  }
});

test("signUp keeps the network message when the fallback sign-in cannot reach Supabase", async () => {
  clientHolder.current = {
    auth: {
      signUp: async () => ({
        data: { session: null },
        error: { message: "User already registered", status: 422 },
      }),
      signInWithPassword: async () => ({
        data: { session: null },
        error: { message: "fetch failed: The operation was aborted." },
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
        assert.equal(error.message, "Không thể kết nối tới máy chủ xác thực");
        return true;
      },
    );
  } finally {
    restoreFetch();
  }
});
