import { redirect } from "next/navigation";

/**
 * /admin — entry point for the admin area.
 *
 * Lives in the `(protected)` group, so the guard runs first and an
 * unauthenticated visitor is sent to `/admin/login` before this redirect.
 */
export default function AdminIndexPage() {
  redirect("/admin/dashboard");
}
