/**
 * Top Welcome Header — Dashboard section #1.
 *
 * The operator name comes from `GET /api/v1/auth/me` and the timestamp is
 * rendered on the server at request time, so nothing here is a fixture. There
 * is deliberately no "operational status: optimal" claim: the backend exposes
 * no such aggregate, and a hard-coded green pill would claim a health the
 * system has not measured.
 */
export function WelcomeHeader({ userName }: { userName: string }) {
  const generatedAt = new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "full",
    timeStyle: "medium",
    timeZone: "Asia/Ho_Chi_Minh"
  }).format(new Date());

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-ink">Chào mừng trở lại, {userName}</h1>
        <p className="text-sm text-ink-muted">
          Số liệu dưới đây được đọc trực tiếp từ các hàng đợi vận hành
          <code className="mx-1.5 rounded px-1.5 py-0.5 text-xs" style={{ backgroundColor: "#f3f5f8" }}>
            /api/v1/admin/operations
          </code>
          của backend.
        </p>
      </div>

      <div className="flex flex-col items-end gap-2 text-right">
        <span className="text-sm font-semibold text-ink">{generatedAt}</span>
        <span
          className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
          style={{ backgroundColor: "rgba(61,109,204,0.14)", color: "#3d6dcc" }}
        >
          Dữ liệu trực tiếp — không phải số liệu mô phỏng
        </span>
      </div>
    </div>
  );
}
