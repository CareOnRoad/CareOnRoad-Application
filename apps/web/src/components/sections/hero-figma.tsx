import Image from "next/image";
import Link from "next/link";
import { ClockIcon, LocationIcon } from "@/components/ui/icons";

/**
 * Hero — theo đúng frame figma "trang chủ" (node 38:1029 / 38:1035 / 38:1037 / 38:1038 / 38:1045).
 *
 * Cấu trúc từ figma:
 *  - Eyebrow chip "ĐỘI NGŨ PHẢN ỨNG NHANH" (mint, viền xanh lá, text xanh lá đậm)
 *  - H1 "Người Bảo Vệ Chuyên Nghiệp / Trên Mọi Cung Đường"
 *  - Body mô tả dịch vụ
 *  - 2 buttons: Primary đỏ CTA "CỨU HỘ KHẨP CẤP 24/7" + Secondary mint outline "Xem Bảng Giá Dịch Vụ"
 *  - Quick stats floating: 2 chip glass (Phản hồi < 15 Phút / Hỗ trợ Toàn Thành Phố)
 *  - Background: ảnh hero (placeholder) + gradient mint overlay
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background image placeholder (chờ hình thật) */}
      <div className="absolute inset-0 h-[640px] w-full">
        <Image
          src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 640'><rect width='1440' height='640' fill='%23cfe4dc'/><text x='50%25' y='50%25' fill='%23162130' font-family='sans-serif' font-size='24' text-anchor='middle' dominant-baseline='middle'>Ảnh hero — sẽ thêm sau</text></svg>"
          alt=""
          role="presentation"
          fill
          priority
          sizes="100vw"
          className="object-cover"
          unoptimized
        />
      </div>

      {/* Mint gradient overlay (từ node 38:1027: linear gradient mint 115deg, alpha giảm dần) */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[640px]"
        style={{
          background:
            "linear-gradient(115deg, #f0f9f4 0%, rgba(240,249,244,0.4) 42%, rgba(240,249,244,0) 90%)",
        }}
      />

      <div className="container-page relative flex flex-col gap-6 pt-16 pb-24 lg:pt-20 lg:pb-32">
        {/* Eyebrow chip */}
        <div className="inline-flex w-fit items-center gap-2 self-start rounded-full border border-brand-deep bg-brand-primary px-4 py-1.5 text-sm tracking-[0.1em] text-brand-deep">
          <LocationIcon className="h-4 w-4" />
          <span>ĐỘI NGŨ PHẢN ỨNG NHANH</span>
        </div>

        {/* H1 */}
        <h1 className="max-w-3xl text-[40px] font-bold leading-[1.1] text-ink md:text-[48px] lg:text-[56px]">
          Người Bảo Vệ Chuyên Nghiệp
          <br />
          <span className="text-brand-deep">Trên Mọi Cung Đường</span>
        </h1>

        {/* Body description */}
        <p className="max-w-xl text-base leading-6 text-ink md:text-lg">
          Dịch vụ bảo dưỡng và cứu hộ xe máy lưu động hàng đầu. Chúng tôi luôn
          sẵn sàng hỗ trợ bạn bất kể thời gian và địa điểm.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link
            href="/yeu-cau"
            className="inline-flex h-[60px] items-center gap-3 rounded-full px-8 text-base font-bold tracking-wide text-surface transition-transform hover:-translate-y-0.5"
            style={{ backgroundColor: "#fc555f" }}
          >
            CỨU HỘ KHẨP CẤP 24/7
          </Link>
          <Link
            href="/dich-vu/bang-gia"
            className="inline-flex h-[60px] items-center rounded-full border-2 border-brand-deep px-6 text-base font-bold transition-colors"
            style={{ backgroundColor: "rgba(210, 229, 219, 0.61)", color: "#00a23a" }}
          >
            Xem Bảng Giá Dịch Vụ
          </Link>
        </div>

        {/* Quick stats floating (node 38:1045) */}
        <div className="mt-6 flex flex-wrap items-stretch gap-3">
          <div className="flex items-center gap-3 rounded-full border border-border-soft bg-surface/80 px-5 py-3 shadow-card backdrop-blur">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-brand-deep">
              <ClockIcon className="h-4 w-4" />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-xs uppercase tracking-wide text-ink-subtle">
                Phản hồi
              </span>
              <span className="text-sm font-bold text-ink">
                &lt; 15 Phút
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-border-soft bg-surface/80 px-5 py-3 shadow-card backdrop-blur">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-brand-deep">
              <LocationIcon className="h-4 w-4" />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-xs uppercase tracking-wide text-ink-subtle">
                Hỗ trợ
              </span>
              <span className="text-sm font-bold text-ink">
                Toàn Thành Phố
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
