import type { Metadata } from "next";

/**
 * Admin segment shell — no Header/Footer from the marketing site.
 *
 * Intentionally has NO auth guard. The guard lives in
 * `(protected)/layout.tsx` so that `/admin/login` stays reachable; see the note
 * there.
 */
export default function AdminSegmentLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen w-full">{children}</div>;
}
