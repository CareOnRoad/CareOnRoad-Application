"use server";

import { redirect } from "next/navigation";

import { authMeResponseSchema } from "@careonroad/api-contract/auth";

import { supabaseServerClient } from "@/lib/supabase/server";

export type AdminLoginState = {
  error: string | null;
};

const GENERIC_ERROR = "Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.";

/**
 * Signs an administrator in.
 *
 * The same generic message covers every failure — wrong password, unknown
 * email, or a non-admin account — so this endpoint cannot be used to discover
 * which email addresses exist.
 */
export async function adminLoginAction(
  _previous: AdminLoginState,
  formData: FormData
): Promise<AdminLoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: GENERIC_ERROR };
  }

  const supabase = await supabaseServerClient();

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (signInError) {
    return { error: GENERIC_ERROR };
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: GENERIC_ERROR };
  }

  // A successful Supabase login is not enough. The backend owns role and
  // status, so confirm the account is an active admin before letting it into
  // the admin shell — and sign it back out if it is not.
  const allowed = await isActiveAdmin(supabase, user.id);

  if (!allowed) {
    await supabase.auth.signOut();
    return { error: GENERIC_ERROR };
  }

  // The layout guard re-runs on the next request, so redirecting is safe.
  redirect("/admin");
}

async function isActiveAdmin(
  supabase: Awaited<ReturnType<typeof supabaseServerClient>>,
  userId: string
): Promise<boolean> {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) {
    return false;
  }

  const {
    data: { session }
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token;
  if (!accessToken) {
    return false;
  }

  try {
    const response = await fetch(`${baseUrl}/api/v1/auth/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store"
    });

    if (!response.ok) {
      return false;
    }

    const parsed = authMeResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return false;
    }

    return (
      parsed.data.id === userId &&
      parsed.data.status === "active" &&
      parsed.data.roles.includes("admin")
    );
  } catch {
    return false;
  }
}
