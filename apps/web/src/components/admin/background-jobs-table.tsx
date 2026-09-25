/**
 * Section 2: Most Recent Background Jobs — Dashboard section #5 (figma node 253:10612).
 * Bảng 4 hàng: TÊN TIẾN TRÌNH / TRẠNG THÁI THỰC THI / SỐ MỤC XỬ LÝ / ĐỘ TRỄ / LẦN CHẠY CUỐI / NHÃN
 * Jobs: dispatch_timeout_sweeper / technician_heartbeat_sync / quote_expiry_notifier / payment_settlement_batch
 */
const jobs = [
  {
    name: "dispatch_timeout_sweeper",
    nameTone: { fg: "#162130", bg: "transparent" },
    schedule: "CRON-2M",
    scheduleTone: { fg: "#3d6dcc", bg: "rgba(61,109,204,0.12)" },
    status: "Thành công (200 OK)",
    statusTone: { fg: "#00a23a", bg: "rgba(0,162,58,0.12)" },
    processed: "42 bản ghi",
    delay: "1.1 giây",
    lastRun: "Hôm nay 14:36:12",
    label: { text: "Tự động", tone: "blue" as const },
  },
  {
    name: "technician_heartbeat_sync",
    nameTone: { fg: "#162130", bg: "transparent" },
    schedule: "WS-PUSH",
    scheduleTone: { fg: "#3d6dcc", bg: "rgba(61,109,204,0.12)" },
    status: "Thành công (200 OK)",
    statusTone: { fg: "#00a23a", bg: "rgba(0,162,58,0.12)" },
    processed: "150 tọa độ",
    delay: "2.4 giây",
    lastRun: "Hôm nay 14:35:00",
    label: { text: "Tự động", tone: "blue" as const },
  },
  {
    name: "quote_expiry_notifier",
    nameTone: { fg: "#ba1f35", bg: "rgba(186,31,53,0.10)" },
    schedule: "KHẨN",
    scheduleTone: { fg: "#fff", bg: "#93000a" },
    status: "Lỗi: ERR_SMS_GATEWAY_503",
    statusTone: { fg: "#93000a", bg: "rgba(147,0,10,0.10)" },
    processed: "8 mục (2 bị chặn)",
    processedTone: "#ba1f35",
    delay: "14.2 giây (Hết giờ)",
    delayTone: "#ba1f35",
    lastRun: "Hôm nay 14:31:45",
    label: { text: "Cần can thiệp", tone: "red" as const },
    actionLabel: "Xem Log",
  },
  {
    name: "payment_settlement_batch",
    nameTone: { fg: "#162130", bg: "transparent" },
    schedule: "HÀNG NGÀY 14H",
    scheduleTone: { fg: "#3d6dcc", bg: "rgba(61,109,204,0.12)" },
    status: "Thành công (200 OK)",
    statusTone: { fg: "#00a23a", bg: "rgba(0,162,58,0.12)" },
    processed: "89 giao dịch",
    delay: "5.8 giây",
    lastRun: "Hôm nay 14:00:00",
    label: { text: "Tự động", tone: "blue" as const },
  },
];

export function BackgroundJobsTable() {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-bold" style={{ color: "#162130" }}>
          Tiến trình chạy ngầm gần nhất
        </h2>
        <p className="text-xs" style={{ color: "#3d4d63" }}>
          Tiến trình định kỳ cron, luồng đồng bộ hàng loạt và hàng chờ thử lại
        </p>
      </header>

      <div className="flex items-center gap-2">
        <span
          className="rounded-md px-2 py-1 text-xs font-semibold"
          style={{ backgroundColor: "rgba(61,109,204,0.14)", color: "#3d6dcc" }}
        >
          Kích hoạt: Quạt hết hơi
        </span>
        <span className="text-xs" style={{ color: "#3d4d63" }}>
          Tự động — đang chạy
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="border-b text-left text-xs uppercase tracking-wide"
              style={{ borderColor: "#e5e9ef", color: "#3d4d63" }}
            >
              <th className="py-2 pr-3">Tên tiến trình</th>
              <th className="py-2 pr-3">Trạng thái thực thi</th>
              <th className="py-2 pr-3">Số mục xử lý</th>
              <th className="py-2 pr-3">Độ trễ</th>
              <th className="py-2 pr-3">Lần chạy cuối</th>
              <th className="py-2 text-right">Nhãn</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j, idx) => (
              <tr
                key={j.name}
                className="border-b align-middle"
                style={{ borderColor: "#e5e9ef" }}
              >
                <td className="py-3 pr-3">
                  <div className="flex flex-col gap-1">
                    <code
                      className="rounded px-1.5 py-0.5 text-xs font-bold"
                      style={{
                        fontFamily: "'Liberation Mono', monospace",
                        backgroundColor: j.nameTone.bg,
                        color: j.nameTone.fg,
                      }}
                    >
                      {j.name}
                    </code>
                    <span
                      className="w-fit rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                      style={{
                        backgroundColor: j.scheduleTone.bg,
                        color: j.scheduleTone.fg,
                      }}
                    >
                      {j.schedule}
                    </span>
                  </div>
                </td>
                <td className="py-3 pr-3">
                  <span
                    className="inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold"
                    style={{
                      backgroundColor: j.statusTone.bg,
                      color: j.statusTone.fg,
                    }}
                  >
                    {j.status}
                  </span>
                </td>
                <td className="py-3 pr-3">
                  <span className="text-sm" style={{ color: j.processedTone ?? "#162130" }}>
                    {j.processed}
                  </span>
                </td>
                <td className="py-3 pr-3">
                  <span className="text-sm" style={{ color: j.delayTone ?? "#3d4d63" }}>
                    {j.delay}
                  </span>
                </td>
                <td className="py-3 pr-3">
                  <span className="text-sm" style={{ color: "#3d4d63" }}>
                    {j.lastRun}
                  </span>
                </td>
                <td className="py-3 text-right">
                  {j.actionLabel ? (
                    <button
                      type="button"
                      className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold text-white"
                      style={{ backgroundColor: "#93000a" }}
                    >
                      {j.actionLabel}
                    </button>
                  ) : (
                    <span
                      className="inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold"
                      style={{
                        backgroundColor:
                          j.label.tone === "red"
                            ? "rgba(147,0,10,0.10)"
                            : "rgba(61,109,204,0.14)",
                        color: j.label.tone === "red" ? "#93000a" : "#3d6dcc",
                      }}
                    >
                      {j.label.text}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
