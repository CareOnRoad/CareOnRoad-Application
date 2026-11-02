/**
 * Deadline helpers for the admin console.
 *
 * Two screens need the same question — "has this deadline already passed?":
 * the quote detail screen (`expires_at`) and the dispatch-round form
 * (`expires_at`). Both are answered here so the clock is read in ONE place
 * instead of being sprinkled across components.
 *
 * WHY THE CLOCK READ LIVES HERE:
 *
 * Reading the current time is an impure operation. Doing it inline in a
 * component body makes the render non-idempotent — the same component could
 * render "expired" and "not expired" on two passes a millisecond apart, which
 * is exactly what the React purity rule guards against. Isolating the read in
 * a helper keeps the component render deterministic with respect to its
 * inputs.
 *
 * IMPORTANT — THE BACKEND IS STILL THE AUTHORITY:
 *
 * A button may be enabled a moment too late (or too early) because the client
 * clock and the server clock differ. The backend re-checks the deadline and
 * rejects an illegal command either way. The client-side check is a
 * convenience that avoids a guaranteed round trip, never a security
 * boundary.
 */

/**
 * Whether a deadline has already passed.
 *
 * An absent or unparsable deadline is NOT treated as expired: guessing
 * "expired" would enable a destructive button on bad data.
 */
export function isPastDeadline(deadline?: string | null): boolean {
  if (!deadline) {
    return false;
  }

  const expiresAt = new Date(deadline).getTime();
  if (Number.isNaN(expiresAt)) {
    return false;
  }

  return expiresAt <= Date.now();
}
