import "server-only";

import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/require-admin";
import { ApiClientError } from "@/lib/api/server-client";

/**
 * Shared plumbing for every admin page.
 *
 * The session token never leaves the server: pages pass the `session` object
 * to the `lib/api/admin` wrappers, which are `server-only` modules.
 */

/**
 * Resolves the admin session for a page.
 *
 * The `(protected)` layout already guards the route, but the page needs the
 * actor for the greeting and the token for the API calls. The Supabase
 * session lookup is cached per request, so calling it again is cheap.
 */
export async function getAdminSession() {
  const { actor, accessToken } = await requireAdmin();
  return { actor, session: { accessToken } };
}

/** The search parameters of an admin page, as a plain record. */
export type AdminSearchParams = Record<string, string | string[] | undefined>;

/**
 * Normalizes the search params of a page into a flat string record.
 *
 * Every admin list reads its filters from the URL so a filtered view can be
 * shared, bookmarked and paginated without losing state.
 */
export function flattenSearchParams(
  searchParams: AdminSearchParams
): Record<string, string | undefined> {
  const flat: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        flat[key] = trimmed;
      }
      continue;
    }
    if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
      flat[key] = value[0].trim();
    }
  }

  return flat;
}

/** Reads a single search parameter value. */
export function readParam(
  searchParams: AdminSearchParams,
  key: string
): string | undefined {
  const value = searchParams[key];
  if (typeof value === "string") {
    return value.trim() || undefined;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0].trim() || undefined;
  }
  return undefined;
}

/**
 * The result of a page read that may fail.
 *
 * A failed backend call must NEVER look like an empty list, so every read
 * goes through this helper: the caller branches on `ok` and renders either
 * the data or an explicit error panel.
 */
export type Settled<T> = { ok: true; data: T } | { ok: false; error: Error };

export async function settle<T>(promise: Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, data: await promise };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error
          : new Error("Đã xảy ra lỗi không xác định.")
    };
  }
}

/**
 * Like `settle`, but a 404 becomes a Next.js 404 screen instead of an error
 * panel.
 *
 * A detail page (`/admin/users/<id>`) must NOT render "the record has no
 * data" when the backend answers 404 — that is a different statement from
 * "this record does not exist". The 404 is therefore escalated to the router,
 * which renders the segment's `not-found.tsx`.
 *
 * Every other failure keeps the normal error-panel behaviour, because a
 * failed request must never look like an empty list.
 */
export async function settleOrNotFound<T>(
  promise: Promise<T>
): Promise<Settled<T>> {
  try {
    return { ok: true, data: await promise };
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      notFound();
    }
    return {
      ok: false,
      error:
        error instanceof Error
          ? error
          : new Error("Đã xảy ra lỗi không xác định.")
    };
  }
}
