/**
 * Top Welcome & Tactical Shift Header — Dashboard main section #1 (figma node 253:10234).
 *
 * Bao gồm:
 *  - Heading "Chào mừng trở lại, Nhật Minh" + status pill "Tối ưu"
 *  - Mô tả lưu lượng cứu hộ cao dọc tuyến đường
 *  - Timestamp "Thứ 5, 24/10 — 19:49:57" + "Mock Pipeline (v2.4.1)"
 *  - Nút "Làm mới toàn bộ"
 */
export function WelcomeHeader() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-ink">
          Chào mừng trở lại, Nhật Minh
        </h1>
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <span>Trạng thái vận hành:</span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ backgroundColor: "rgba(0,162,58,0.12)", color: "#00a23a" }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#00a23a" }} />
            Tối ưu
          </span>
          <span>
            . Lưu lượng cứu hộ cao dọc tuyến đường Nguyễn Xiển - Phước Thiện
            (Khu đô thị Vinhomes Grand Park, TP. Thủ Đức, TP. Hồ Chí Minh).
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-2 text-right">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-ink">
            Thứ 5, 24/10 — 19:49:57
          </span>
          <span
            className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
            style={{ backgroundColor: "rgba(61,109,204,0.14)", color: "#3d6dcc" }}
          >
            Mock Pipeline (v2.4.1)
          </span>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: "#162130" }}
        >
          ↻ Làm mới toàn bộ
        </button>
      </div>
    </div>
  );
}
