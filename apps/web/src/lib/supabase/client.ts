import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client. Used by client components that need to read or
 * refresh the session (for example the admin sign-out button).
 *
 * The publishable key is public by design; never use a service role key here.
 */

let cached: ReturnType<typeof createBrowserClient> | undefined;

export function supabaseBrowserClient() {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set. " +
        "See apps/web/.env.example."
    );
  }

  cached = createBrowserClient(url, publishableKey);
  return cached;
}
