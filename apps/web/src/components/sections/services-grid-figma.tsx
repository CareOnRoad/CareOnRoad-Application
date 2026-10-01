import Link from "next/link";
import {
  BatteryIcon,
  EngineIcon,
  OilIcon,
  PhoneIcon,
  WrenchIcon,
} from "@/components/ui/icons";

/**
 * Services Grid — theo frame figma node 38:1092 + 38:1138.
 *
 * Cấu trúc:
 *  - Centered title "Dịch Vụ Chuyên Biệt"
 *  - Subhead mô tả ngắn
 *  - Grid 4 cards:
 *    1. Bảo dưỡng định kỳ (mint, icon wrench)
 *    2. Thay nhớt xe máy (mint, icon oil)
 *    3. Sửa chữa lưu động (mint, icon engine)
 *    4. Cứu hộ khẩn cấp (đỏ highlight, icon phone) — bg đỏ theo node 38:1138
 *  - Mỗi card có: icon tròn, tên, mô tả, link "CHI TIẾT" hoặc "GỌI NGAY"
 */
const services = [
  {
    icon: WrenchIcon,
    name: "Bảo dưỡng định kỳ",
    desc: "Kiểm tra tổng quát và tối ưu hóa hiệu suất động cơ theo tiêu chuẩn hãng.",
    cta: "CHI TIẾT",
    href: "/dich-vu/bao-duong",
    highlight: false,
  },
  {
    icon: OilIcon,
    name: "Thay nhớt xe máy",
    desc: "Cung cấp các dòng dầu nhớt cao cấp, thay nhớt tận nơi chuyên nghiệp.",
    cta: "CHI TIẾT",
    href: "/dich-vu/thay-nhot",
    highlight: false,
  },
  {
    icon: EngineIcon,
    name: "Sửa chữa lưu động",
    desc: "Kỹ thuật viên đến tận nhà hoặc cơ quan để xử lý các hư hỏng kỹ thuật.",
    cta: "CHI TIẾT",
    href: "/dich-vu/sua-chua-luu-dong",
    highlight: false,
  },
  {
    icon: PhoneIcon,
    name: "Cứu hộ khẩn cấp",
    desc: "Hỗ trợ nhanh các sự cố thủng lốp, hết bình, chết máy giữa đường 24/7.",
    cta: "GỌI NGAY",
    href: "/yeu-cau",
    highlight: true,
  },
];

export function ServicesGrid() {
  return (
    <section className="bg-brand-primary/30 py-16 md:py-20">
      <div className="container-page flex flex-col gap-10">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <h2 className="text-3xl font-bold leading-tight text-ink md:text-4xl">
            Dịch Vụ Chuyên Biệt
          </h2>
          <p className="max-w-3xl text-base leading-6 text-ink-muted">
            Giải pháp toàn diện từ bảo dưỡng định kỳ đến cứu hộ khẩn cấp, giúp
            xế yêu luôn trong tình trạng hoàn hảo.
          </p>
        </div>

        {/* Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {services.map((s) => {
            const Icon = s.icon;
            return (
              <article
                key={s.name}
                className="group flex flex-col gap-4 rounded-2xl p-7 transition-shadow"
                style={
                  s.highlight
                    ? { backgroundColor: "#fc555f", color: "#fff" }
                    : { backgroundColor: "#fff", border: "1px solid #e5e7eb" }
                }
              >
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-xl"
                  style={
                    s.highlight
                      ? { backgroundColor: "rgba(255,255,255,0.25)" }
                      : { backgroundColor: "#f0f9f4" }
                  }
                >
                  <Icon
                    className="h-7 w-7"
                    style={{
                      color: s.highlight ? "#fff" : "#00a23a",
                    }}
                  />
                </span>
                <h3
                  className="text-lg font-bold"
                  style={{ color: s.highlight ? "#fff" : "#162130" }}
                >
                  {s.name}
                </h3>
                <p
                  className="text-sm leading-6"
                  style={{
                    color: s.highlight ? "rgba(255,255,255,0.92)" : "#4b5563",
                  }}
                >
                  {s.desc}
                </p>
                <Link
                  href={s.href}
                  className="mt-auto inline-flex items-center gap-1 text-sm font-semibold"
                  style={{ color: s.highlight ? "#fff" : "#00a23a" }}
                >
                  {s.cta} →
                </Link>
              </article>
            );
          })}
        </div>

        {/* Extra: Battery services row (decorative empty to match 4-col). Có thể xoá nếu không cần */}
      </div>
    </section>
  );
}
