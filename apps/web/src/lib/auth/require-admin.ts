import "server-only";

import { redirect } from "next/navigation";

import { authMeResponseSchema, type RequestActor } from "@careonroad/api-contract/auth";

import { supabaseServerClient } from "@/lib/supabase/server";

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Resolves the caller for any `/admin/**` page.
 *
 * Two independent checks, in order:
 *  1. Supabase session — proves a real, non-forged login.
 *  2. `GET /api/v1/auth/me` with that user's own access token — the backend is
 *     the only authority on roles and account status.
 *
 * The layout guard is UX only. The backend re-checks authorization on every
 * admin route, so a bypass here cannot expose data.
 *
 * The access token is returned for server-side API calls only. Never pass it
 * to a Client Component, never log it.
 */
export type AdminSession = {
  actor: RequestActor;
  accessToken: string;
};

export async function requireAdmin(): Promise<AdminSession> {
  const supabase = await supabaseServerClient();

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/admin/login");
  }

  const { data, error: sessionError } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (sessionError || !accessToken) {
    redirect("/admin/login");
  }

  const actor = await fetchAdminActor(accessToken);

  if (!actor.roles.includes("admin") || actor.status !== "active") {
    redirect("/admin/forbidden");
  }

  return { actor, accessToken };
}

/**
 * Reads the actor from the backend. The schema comes from the shared contract
 * package, so a response that does not match is treated as a failure rather
 * than rendered partially.
 */
async function fetchAdminActor(accessToken: string): Promise<RequestActor> {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) {
    throw new Error("API_BASE_URL must be set. See apps/web/.env.example.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/api/v1/auth/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Failed to load the admin actor. Status: ${response.status}.`);
    }

    const parsed = authMeResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new Error("The /api/v1/auth/me response did not match the shared contract.");
    }

    return parsed.data;
  } finally {
    clearTimeout(timeout);
  }
}
