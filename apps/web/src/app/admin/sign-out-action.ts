"use server";

import { redirect } from "next/navigation";

import { supabaseServerClient } from "@/lib/supabase/server";

/**
 * Clears the Supabase session and returns to the admin login page.
 *
 * The error is intentionally swallowed: the cookie is cleared either way, and
 * a failure here must not surface the raw Supabase message.
 */
export async function adminSignOutAction(): Promise<void> {
  const supabase = await supabaseServerClient();

  try {
    await supabase.auth.signOut();
  } catch {
    // Nothing to do — the redirect below still applies.
  }

  redirect("/admin/login");
}
