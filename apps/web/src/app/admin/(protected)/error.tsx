"use client";

import { useEffect } from "react";

import { AdminLayout } from "@/components/admin/admin-layout";

/**
 * The error boundary of the whole protected admin area.
 *
 * It lives at the `(protected)` segment, so one boundary covers all 13 tabs
 * and every detail page under them. A tab that throws therefore shows a
 * recoverable panel instead of a blank screen — and, importantly, the admin
 * chrome (sidebar + topbar) stays visible so the operator can navigate away
 * to another tab.
 *
 * The error MESSAGE is not rendered: in production a Server Component error
 * carries only a generic message plus `digest`, and printing it would either
 * leak internals or show a useless "An error occurred". The `digest` is shown
 * instead, because it is the identifier that ties the browser view to the
 * server log.
 */
export default function AdminError({
  error,
  retry
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Metadata only — never the message, never a stack, never a token.
    console.error(
      `[admin] route error digest=${error.digest ?? "unknown"} name=${error.name}`
    );
  }, [error]);

  return (
    <AdminLayout crumb={["CareOnRoad", "Điều hành"]}>
      <div className="flex flex-col items-start gap-4 rounded-2xl bg-white p-8 shadow-sm" style={{ border: "1px solid #e5e9ef" }}>
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-bold" style={{ color: "#162130" }}>
            Không tải được nội dung trang
          </h1>
          <p className="text-sm" style={{ color: "#3d4d63" }}>
            Trang gặp lỗi khi tải dữ liệu. Thử lại, hoặc chuyển sang tab khác
            trong thanh bên trái.
          </p>
        </div>

        {error.digest ? (
          <p className="font-mono text-[11px]" style={{ color: "#6b7a8d" }}>
            Mã lỗi: {error.digest}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => retry()}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ backgroundColor: "#162130" }}
        >
          Thử lại
        </button>
      </div>
    </AdminLayout>
  );
}
