import Link from "next/link";
import { MailIcon, PhoneIcon } from "@/components/ui/icons";

const footerLinks = [
  {
    title: "Dịch vụ",
    items: [
      { label: "Cứu hộ ắc quy", href: "/dich-vu/cuu-ho-ac-quy" },
      { label: "Thay nhớt", href: "/dich-vu/thay-nhot" },
      { label: "Vá / thay ruột xe", href: "/dich-vu/thay-ruot-cam" },
      { label: "Kéo xe về garage", href: "/dich-vu/keo-xe-ve" },
    ],
  },
  {
    title: "Hỗ trợ",
    items: [
      { label: "Trung tâm hỗ trợ", href: "/lien-he" },
      { label: "Câu hỏi thường gặp", href: "/lien-he#faq" },
      { label: "Điều khoản sử dụng", href: "/dieu-khoan" },
      { label: "Chính sách bảo mật", href: "/chinh-sach" },
    ],
  },
  {
    title: "Công ty",
    items: [
      { label: "Về CareOnRoad", href: "/ve-chung-toi" },
      { label: "Tin tức", href: "/tin-tuc" },
      { label: "Tuyển kỹ thuật viên", href: "/tuyen-dung" },
      { label: "Liên hệ", href: "/lien-he" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-ink text-surface">
      <div className="container-page grid gap-12 py-16 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand">
              <span className="text-lg font-bold text-ink">CR</span>
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-base font-bold">CareOnRoad</span>
              <span className="text-xs text-surface/70">
                Cứu hộ xe máy 24/7
              </span>
            </div>
          </div>
          <p className="max-w-sm text-sm text-surface/70">
            Nền tảng kết nối kỹ thuật viên cứu hộ xe máy trên toàn quốc — nhanh
            chóng, minh bạch và an toàn.
          </p>
          <ul className="flex flex-col gap-2 text-sm text-surface/80">
            <li className="flex items-center gap-2">
              <PhoneIcon className="h-4 w-4" aria-hidden />
              <span>1900 6868</span>
            </li>
            <li className="flex items-center gap-2">
              <MailIcon className="h-4 w-4" aria-hidden />
              <span>support@careonroad.vn</span>
            </li>
          </ul>
        </div>

        {footerLinks.map((col) => (
          <div key={col.title} className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-surface">
              {col.title}
            </h3>
            <ul className="flex flex-col gap-2 text-sm text-surface/70">
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
      </div>

      <div className="border-t border-surface/10">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-6 text-xs text-surface/60 md:flex-row">
          <span>
            © 2026 CareOnRoad. Mọi quyền được bảo lưu.
          </span>
          <span>Phiên bản 1.0.0 — chờ kết nối backend.</span>
        </div>
      </div>
    </footer>
  );
}
