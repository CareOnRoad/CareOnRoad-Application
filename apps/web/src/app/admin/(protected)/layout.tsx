import { requireAdmin } from "@/lib/auth/require-admin";

/**
 * Layout for every protected admin page.
 *
 * The guard resolves the caller before rendering, so a non-admin request never
 * reaches the page. This is UX only — the backend re-checks authorization on
 * each admin API call, so bypassing this layout cannot expose data.
 *
 * The route group `(protected)` keeps `/admin/login` outside this guard;
 * otherwise the login page would redirect to itself in a loop.
 */
export default async function AdminProtectedLayout({
  children
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return <div className="min-h-screen w-full">{children}</div>;
}
