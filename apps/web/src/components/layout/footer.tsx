import Link from "next/link";
import { MailIcon, PhoneIcon } from "@/components/ui/icons";

/**
 * Footer — theo frame figma node 38:2081 (Component "footer" từ Design System).
 *
 * Cấu trúc 1440×204, nền đậm:
 *  - Col 1 (1.5fr): Logo + tagline + liên hệ
 *  - Col 2 (Về chúng tôi) — 3 link
 *  - Col 3 (Dịch vụ) — 3 link
 *  - Col 4 (Hỗ trợ) — 3 link
 *  - Col 5 (Kết nối) — Hotline / Địa chỉ / Email
 *
 * Lưu ý: figma có 5 cột khi tính riêng logo col; layout code tách 4 cột nav
 * (Về chúng tôi / Dịch vụ / Hỗ trợ / Kết nối) + 1 col logo đầu.
 */
const navColumns = [
  {
    title: "Về chúng tôi",
    items: [
      { label: "Câu chuyện thương hiệu", href: "/ve-chung-toi/cau-chuyen" },
      { label: "Đội ngũ kỹ thuật", href: "/ve-chung-toi/doi-ngu" },
      { label: "Tuyển dụng", href: "/tuyen-dung" },
    ],
  },
  {
    title: "Dịch vụ",
    items: [
      { label: "Cứu hộ khẩn cấp", href: "/dich-vu/cuu-ho-khan-cap" },
      { label: "Bảo dưỡng tận nơi", href: "/dich-vu/bao-duong-tan-noi" },
      { label: "Phụ tùng chính hãng", href: "/dich-vu/phu-tung" },
    ],
  },
  {
    title: "Hỗ trợ",
    items: [
      { label: "Trung tâm trợ giúp", href: "/tro-giup" },
      { label: "Chính sách bảo mật", href: "/chinh-sach/bao-mat" },
      { label: "Điều khoản sử dụng", href: "/chinh-sach/dieu-khoan" },
    ],
  },
];

export function Footer() {
  return (
    <footer
      className="text-surface"
      style={{ backgroundColor: "#0e1a2e" }}
    >
      <div className="container-page grid gap-12 py-12 md:grid-cols-[1.5fr_repeat(3,1fr)_1fr]">
        {/* Logo column */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-brand text-base font-bold text-ink">
              CR
            </span>
            <span className="text-base font-bold text-surface">CareOnRoad</span>
          </div>
          <p className="max-w-sm text-sm leading-5 text-surface/80">
            Chuyên gia bảo dưỡng và cứu hộ xe máy hàng đầu. Sứ mệnh của chúng
            tôi là mang lại sự an tâm cho mỗi hành trình của bạn.
          </p>
        </div>

        {/* Nav columns */}
        {navColumns.map((col) => (
          <div key={col.title} className="flex flex-col gap-3">
            <h3 className="text-base font-bold text-surface">{col.title}</h3>
            <ul className="flex flex-col gap-2 text-sm text-surface/80">
              {col.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="transition-colors hover:text-surface"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Kết nối column */}
        <div className="flex flex-col gap-3">
          <h3 className="text-base font-bold text-surface">Kết nối</h3>
          <ul className="flex flex-col gap-2 text-sm text-surface/80">
            <li className="flex items-center gap-2">
              <PhoneIcon className="h-4 w-4" aria-hidden />
              <span>Hotline: 1900 xxxx</span>
            </li>
            <li className="flex items-start gap-2">
              <MailIcon className="mt-0.5 h-4 w-4" aria-hidden />
              <span>contact@careonroad.vn</span>
            </li>
            <li className="leading-5">
              TP. Hồ Chí Minh, Việt Nam
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-surface/10">
        <div className="container-page flex flex-col items-center justify-between gap-1 py-5 text-xs text-surface/60 md:flex-row">
          <span>© 2026 CareOnRoad. Mọi quyền được bảo lưu.</span>
          <span>Phiên bản 1.0.0 — chờ kết nối backend.</span>
        </div>
      </div>
    </footer>
  );
}
