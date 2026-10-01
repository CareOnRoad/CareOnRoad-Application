import Image from "next/image";
import Link from "next/link";

/**
 * Featured Blog — theo frame figma node 38:1153.
 *
 * Cấu trúc:
 *  - Header: "CẨM NANG XE MÁY" eyebrow + "Tin Tức & Kinh Nghiệm" title
 *  - Right link "Xem tất cả bài viết"
 *  - 3 article cards: tag chip trên ảnh, ngày + author, tiêu đề, đoạn trích
 *  - Ảnh dùng next/image + placeholder
 */
const articles = [
  {
    tag: "KỸ THUẬT",
    date: "24 tháng 10, 2023",
    author: "Admin",
    title: "5 Dấu hiệu cho thấy xế yêu của bạn cần được bảo dưỡng ngay lập tức",
    excerpt:
      "Đừng để những hư hỏng nhỏ trở thành gánh nặng tài chính. Học cách nhận biết các biểu hiện bất thường từ động cơ...",
    href: "/tin-tuc/5-dau-hieu-bao-duong",
    tone: "primary" as const,
  },
  {
    tag: "TƯ VẤN",
    date: "18 tháng 10, 2023",
    author: "Chuyên gia",
    title: "Cách chọn dầu nhớt phù hợp cho từng dòng xe tay ga và xe số",
    excerpt:
      "Lựa chọn đúng loại dầu nhớt không chỉ giúp xe chạy êm hơn mà còn kéo dài tuổi thọ động cơ đáng kể...",
    href: "/tin-tuc/chon-dau-nhot",
    tone: "neutral" as const,
  },
  {
    tag: "CỨU HỘ",
    date: "12 tháng 10, 2023",
    author: "Admin",
    title: "Quy trình cứu hộ xe máy an toàn trong điều kiện đêm tối và mưa gió",
    excerpt:
      "Hướng dẫn các bước tự bảo vệ bản thân và xe của bạn khi gặp sự cố giữa đêm khuya trước khi đội cứu hộ đến...",
    href: "/tin-tuc/cuu-ho-dem-toi",
    tone: "neutral" as const,
  },
];

export function FeaturedBlog() {
  return (
    <section className="bg-surface py-16 md:py-20">
      <div className="container-page flex flex-col gap-10">
        {/* Section header */}
        <header className="flex items-end justify-between gap-6">
          <div className="flex flex-col gap-2">
            <span
              className="text-sm font-semibold uppercase"
              style={{ color: "#00a23a", letterSpacing: "0.1em" }}
            >
              CẨM NANG XE MÁY
            </span>
            <h2 className="text-3xl font-bold leading-tight text-ink md:text-4xl">
              Tin Tức &amp; Kinh Nghiệm
            </h2>
          </div>
          <Link
            href="/tin-tuc"
            className="hidden text-sm font-semibold text-brand-deep transition-opacity hover:opacity-70 md:inline-flex"
          >
            Xem tất cả bài viết →
          </Link>
        </header>

        {/* Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <article
              key={a.title}
              className="flex flex-col gap-4 overflow-hidden rounded-2xl border border-border-soft bg-surface shadow-card transition-shadow hover:shadow-pop"
            >
              <div className="relative h-[222px] w-full">
                <Image
                  src={`data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 340'><rect width='600' height='340' fill='%23d8e3db'/><text x='50%25' y='50%25' fill='%23162130' font-family='sans-serif' font-size='20' text-anchor='middle' dominant-baseline='middle'>${a.tag}</text></svg>`}
                  alt=""
                  role="presentation"
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                  unoptimized
                />
                <span
                  className="absolute left-4 top-4 inline-flex items-center rounded-md px-3 py-1 text-xs font-semibold tracking-wider text-surface"
                  style={{
                    backgroundColor:
                      a.tone === "primary" ? "#00a23a" : "#162130",
                  }}
                >
                  {a.tag}
                </span>
              </div>
              <div className="flex flex-col gap-3 px-5 pb-6">
                <div className="flex items-center gap-2 text-sm text-ink-muted">
                  <span>{a.date}</span>
                  <span aria-hidden>•</span>
                  <span>{a.author}</span>
                </div>
                <h3 className="line-clamp-2 text-lg font-bold leading-snug text-ink">
                  <Link href={a.href} className="hover:text-brand-deep">
                    {a.title}
                  </Link>
                </h3>
                <p className="line-clamp-3 text-sm leading-6 text-ink-muted">
                  {a.excerpt}
                </p>
              </div>
            </article>
          ))}
        </div>

        <div className="md:hidden">
          <Link
            href="/tin-tuc"
            className="inline-flex text-sm font-semibold text-brand-deep"
          >
            Xem tất cả bài viết →
          </Link>
        </div>
      </div>
    </section>
  );
}
