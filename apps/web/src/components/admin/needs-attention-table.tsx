/**
 * Section 1: Items Needing Immediate Attention — Dashboard section #4 (figma node 253:10448).
 * Bảng 5 hàng dữ liệu: MÃ YÊU CẦU / PHƯƠNG TIỆN VỊ TRÍ / ĐIỂM NGHẼN / TRẠNG THÁI / THỜI GIAN / THAO TÁC
 * Có filter chips: Tất cả (5) / Tắc nghẽn (3) / Tranh chấp (2)
 */
const rows = [
  {
    code: "YC-8921",
    vehicle: "Honda SH 150i ABS (2022)",
    location: "Tòa S1.05, Phân khu The Rainbow, Vinhomes Grand Park, TP. Thủ Đức, TP. HCM",
    issue: "Kỹ thuật viên không phản hồi báo giá (8 phút)",
    tag: { text: "Đã gửi báo giá", tone: "amber" as const },
    tagText: "Đã gửi báo giá",
    tagColor: { fg: "#d97706", bg: "rgba(217,119,6,0.14)" },
    time: "3 phút trước",
  },
  {
    code: "YC-8904",
    vehicle: "Honda Air Blade 125",
    location: "Tòa S6.02, Phân khu The Origami, Vinhomes Grand Park, TP. Thủ Đức, TP. HCM",
    issue: "Không tìm thấy thợ cứu hộ trong bán kính 15km",
    tagText: "Đang tìm thợ cứu hộ",
    tagColor: { fg: "#162130", bg: "#f3f5f8" },
    time: "6 phút trước",
  },
  {
    code: "YC-8889",
    vehicle: "Honda Vision 110cc (2022)",
    location: "Đường D2D, Phân khu Origami, Vinhomes Grand Park, TP. Thủ Đức, TP. HCM",
    issue: 'Khách khiếu nại phát chẩn đoán đề xuất (1.500.000đ)',
    tagText: "Cần xử lý thủ công",
    tagColor: { fg: "#93000a", bg: "rgba(147,0,10,0.10)" },
    time: "11 phút trước",
  },
  {
    code: "YC-8872",
    vehicle: "Honda Winner X 150 (2022)",
    location: "Đường Nguyễn Xiển, Phân khu The Rainbow, Vinhomes Grand Park, TP. Thủ Đức, TP. HCM",
    issue: "Lái xe kéo tới chỉ chờ điều phối từ động",
    tagText: "Đã gửi báo giá",
    tagColor: { fg: "#d97706", bg: "rgba(217,119,6,0.14)" },
    time: "14 phút trước",
  },
  {
    code: "YC-8850",
    vehicle: "Yamaha Exciter 155 VVA (2023)",
    location: "Hầm B2 Tòa S10.02, Phân khu Origami, Vinhomes Grand Park, TP. Thủ Đức, TP. HCM",
    issue: "Mất kết nối truyền động & phụ phương tiện hỏng sớm",
    tagText: "Cần xử lý thủ công",
    tagColor: { fg: "#93000a", bg: "rgba(147,0,10,0.10)" },
    time: "22 phút trước",
  },
];

const filters = [
  { label: "Tất cả (5)", active: true, tone: "dark" as const },
  { label: "Tắc nghẽn (3)", active: false, tone: "neutral" as const },
  { label: "Tranh chấp (2)", active: false, tone: "neutral" as const },
];

export function NeedsAttentionTable() {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-bold" style={{ color: "#162130" }}>
          Cần xử lý ngay
        </h2>
        <p className="text-xs" style={{ color: "#3d4d63" }}>
          Các điểm nghẽn nghiêm trọng đòi hỏi trưởng ca can thiệp thủ công
        </p>
      </header>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.label}
            type="button"
            className="rounded-full px-3 py-1.5 text-xs font-semibold"
            style={
              f.active
                ? { backgroundColor: "#162130", color: "#fff" }
                : { backgroundColor: "#f3f5f8", color: "#3d4d63" }
            }
          >
            {f.label}
          </button>
        ))}
        <a
          href="/admin/service-requests?filter=attention"
          className="ml-auto inline-flex items-center text-xs font-semibold"
          style={{ color: "#3d6dcc" }}
        >
          Xem tất cả →
        </a>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="border-b text-left text-xs uppercase tracking-wide"
              style={{ borderColor: "#e5e9ef", color: "#3d4d63" }}
            >
              <th className="py-2 pr-3">Mã yêu cầu</th>
              <th className="py-2 pr-3">Phương tiện / Vị trí</th>
              <th className="py-2 pr-3">Điểm nghẽn</th>
              <th className="py-2 pr-3">Trạng thái</th>
              <th className="py-2 pr-3">Thời gian trôi qua</th>
              <th className="py-2 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr
                key={r.code}
                className="border-b align-top"
                style={{ borderColor: "#e5e9ef" }}
              >
                <td className="py-3 pr-3">
                  <span
                    className="text-sm font-bold"
                    style={{ color: "#3d6dcc" }}
                  >
                    {r.code}
                  </span>
                </td>
                <td className="py-3 pr-3">
                  <div className="flex flex-col">
                    <span className="font-semibold" style={{ color: "#162130" }}>
                      {r.vehicle}
                    </span>
                    <span className="text-xs" style={{ color: "#3d4d63" }}>
                      {r.location}
                    </span>
                  </div>
                </td>
                <td className="py-3 pr-3">
                  <span className="text-sm" style={{ color: "#162130" }}>
                    {r.issue}
                  </span>
                </td>
                <td className="py-3 pr-3">
                  <span
                    className="inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold"
                    style={{
                      backgroundColor: r.tagColor.bg,
                      color: r.tagColor.fg,
                    }}
                  >
                    {r.tagText}
                  </span>
                </td>
                <td className="py-3 pr-3">
                  <span className="text-sm" style={{ color: "#3d4d63" }}>
                    {r.time}
                  </span>
                </td>
                <td className="py-3 text-right">
                  <a
                    href={`/admin/service-requests/${r.code}`}
                    className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold"
                    style={{ backgroundColor: "#f3f5f8", color: "#3d6dcc" }}
                  >
                    Kiểm tra chi tiết
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
