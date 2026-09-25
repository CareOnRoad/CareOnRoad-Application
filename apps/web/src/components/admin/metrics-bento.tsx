/**
 * Bento Grid — Dashboard section #2 (figma node 253:10271).
 * 5 metric cards ngang hàng: yêu cầu chờ / kỹ thuật viên chờ duyệt / yêu cầu quá hạn / sự kiện thất bại / giao dịch tạm giữ.
 * Mỗi card có: title (caps mini), số lớn, mô tả ngắn, chip tone (xanh lá / xanh dương / đỏ / vàng).
 */

interface MetricCard {
  title: string;
  value: string;
  hint: string;
  chip: { text: string; tone: "green" | "blue" | "red" | "amber" };
}

const toneStyles: Record<MetricCard["chip"]["tone"], { bg: string; fg: string; dot: string }> = {
  green: { bg: "rgba(0,162,58,0.12)", fg: "#00a23a", dot: "#00a23a" },
  blue: { bg: "rgba(61,109,204,0.12)", fg: "#3d6dcc", dot: "#3d6dcc" },
  red: { bg: "rgba(147,0,10,0.10)", fg: "#93000a", dot: "#93000a" },
  amber: { bg: "rgba(217,119,6,0.12)", fg: "#d97706", dot: "#d97706" },
};

const metrics: MetricCard[] = [
  {
    title: "Yêu cầu chờ xử lý",
    value: "14",
    hint: "trong hàng chờ",
    chip: { text: "6 Khẩn cấp", tone: "red" },
  },
  {
    title: "Kỹ thuật viên chờ xác duyệt",
    value: "3",
    hint: "hồ sơ đang duyệt",
    chip: { text: "Xác thực giấy tờ", tone: "blue" },
  },
  {
    title: "Yêu cầu quá hạn ghép xe",
    value: "5",
    hint: "Bị tắc nghẽn > 8p",
    chip: { text: "Chờ phản hồi báo giá", tone: "red" },
  },
  {
    title: "Sự kiện thất bại tại",
    value: "2",
    hint: "sự kiện lỗi",
    chip: { text: "Cổng SMS gặp sự cố", tone: "red" },
  },
  {
    title: "Giao dịch tạm giữ cần soát xét",
    value: "4",
    hint: "cần duyệt thủ công",
    chip: { text: "Chênh lệch chẩn đoán", tone: "blue" },
  },
];

export function MetricsBento() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      {metrics.map((m) => {
        const t = toneStyles[m.chip.tone];
        return (
          <article
            key={m.title}
            className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm"
          >
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "#3d4d63" }}
            >
              {m.title}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold" style={{ color: "#162130" }}>
                {m.value}
              </span>
              <span className="text-xs" style={{ color: "#3d4d63" }}>
                {m.hint}
              </span>
            </div>
            <span
              className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold"
              style={{ backgroundColor: t.bg, color: t.fg }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.dot }} />
              {m.chip.text}
            </span>
          </article>
        );
      })}
    </div>
  );
}
