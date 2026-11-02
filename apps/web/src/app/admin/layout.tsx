/**
 * Admin segment shell — no Header/Footer from the marketing site.
 *
 * Intentionally has NO auth guard. The guard lives in
 * `(protected)/layout.tsx` so that `/admin/login` stays reachable; see the note
 * there.
 *
 * It also exports no `metadata`: the admin console is not indexed and the
 * marketing metadata in the root layout would be misleading here.
 */
export default function AdminSegmentLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen w-full">{children}</div>;
}
