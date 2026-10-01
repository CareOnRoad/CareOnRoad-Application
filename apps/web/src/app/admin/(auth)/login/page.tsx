import type { Metadata } from "next";

import { AdminLoginForm } from "./admin-login-form";

export const metadata: Metadata = {
  title: "CareOnRoad — Đăng nhập quản trị"
};

/**
 * /admin/login — public by design, so it must sit outside the admin guard.
 * The guard lives in `src/app/admin/layout.tsx`; see the note there.
 */
export default function AdminLoginPage() {
  return <AdminLoginForm />;
}
