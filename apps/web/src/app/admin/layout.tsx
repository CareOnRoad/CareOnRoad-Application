import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CareOnRoad — Điều hành",
  description: "Trung tâm điều hành CareOnRoad — dành cho quản trị viên / trưởng ca.",
};

/**
 * Admin route group layout — không render Header/Footer của marketing site.
 * Trang admin tự chứa AdminLayout riêng (sidebar + topbar).
 */
export default function AdminSegmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen w-full">{children}</div>;
}
