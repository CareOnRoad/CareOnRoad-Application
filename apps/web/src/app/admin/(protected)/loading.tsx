import { AdminLayout } from "@/components/admin/admin-layout";

/**
 * The loading skeleton of the whole protected admin area.
 *
 * One skeleton at the `(protected)` segment covers all 13 tabs: the sidebar
 * and topbar render instantly, and only the content area shows the placeholder
 * blocks while the server fetches the data. A per-tab skeleton would have
 * duplicated the same markup 13 times and drifted.
 *
 * The blocks are deliberately SHAPELESS — no fake numbers, no fake names. A
 * skeleton that shows "12 yêu cầu đang chờ" during the load would be a lie
 * that briefly becomes a fact on screen.
 */
export default function AdminLoading() {
  return (
    <AdminLayout crumb={["CareOnRoad", "Điều hành"]}>
      <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
        <span className="sr-only">Đang tải dữ liệu điều hành…</span>

        <div className="flex flex-col gap-2">
          <div
            className="h-6 w-56 animate-pulse rounded-lg"
            style={{ backgroundColor: "#e5e9ef" }}
          />
          <div
            className="h-3 w-80 animate-pulse rounded-lg"
            style={{ backgroundColor: "#f1f4f8" }}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm"
              style={{ border: "1px solid #e5e9ef" }}
            >
              <div
                className="h-3 w-28 animate-pulse rounded"
                style={{ backgroundColor: "#e5e9ef" }}
              />
              <div
                className="h-8 w-20 animate-pulse rounded"
                style={{ backgroundColor: "#f1f4f8" }}
              />
              <div
                className="h-3 w-40 animate-pulse rounded"
                style={{ backgroundColor: "#f1f4f8" }}
              />
            </div>
          ))}
        </div>

        <div
          className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm"
          style={{ border: "1px solid #e5e9ef" }}
        >
          <div
            className="h-4 w-40 animate-pulse rounded"
            style={{ backgroundColor: "#e5e9ef" }}
          />
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-9 w-full animate-pulse rounded"
              style={{ backgroundColor: "#f1f4f8" }}
            />
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
