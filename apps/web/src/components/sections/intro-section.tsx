import Image from "next/image";
import { ClockIcon, ShieldIcon } from "@/components/ui/icons";

/**
 * Intro Section (Giới thiệu) — theo frame figma node 38:1066.
 *
 * Cấu trúc:
 *  - Eyebrow "VỀ CHÚNG TÔI" + heading "Tầm Nhìn & Sứ Mệnh CareOnRoad"
 *  - 2 đoạn body mô tả tầm nhìn / sứ mệnh
 *  - 2 mini-cards (Chuyên Nghiệp / Tốc Độ) với icon
 *  - Image tràn ra ngoài với overlay+border+shadow trắng nhạt
 */
export function IntroSection() {
  return (
    <section className="bg-surface py-16 md:py-20">
      <div className="container-page grid gap-10 md:grid-cols-2 md:items-center md:gap-12">
        {/* Image column (placeholder) */}
        <div className="relative">
          <div className="relative h-[420px] w-full overflow-hidden rounded-3xl border border-border-soft bg-surface-muted shadow-figma md:h-[520px]">
            <Image
              src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 520'><rect width='600' height='520' fill='%23eaeef2'/><text x='50%25' y='50%25' fill='%23162130' font-family='sans-serif' font-size='22' text-anchor='middle' dominant-baseline='middle'>Ảnh — sẽ thêm sau</text></svg>"
              alt=""
              role="presentation"
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
              unoptimized
            />
          </div>
          {/* Decorative overlay corner */}
          <div
            aria-hidden
            className="absolute -bottom-6 -right-6 hidden h-32 w-32 rounded-2xl border border-brand-soft bg-surface md:block"
          />
        </div>

        {/* Text column */}
        <div className="flex flex-col gap-5">
          <span
            className="text-sm font-semibold uppercase tracking-[0.2em] text-ink"
            style={{ letterSpacing: "0.2em" }}
          >
            VỀ CHÚNG TÔI
          </span>
          <h2 className="text-3xl font-bold leading-tight text-ink md:text-4xl">
            Tầm Nhìn &amp; Sứ Mệnh CareOnRoad
          </h2>
          <p className="text-base leading-7 text-ink-muted">
            Tại CareOnRoad, chúng tôi không chỉ sửa chữa xe máy; chúng tôi đảm
            bảo sự an tâm cho mỗi hành trình của bạn. Với đội ngũ kỹ thuật viên
            dày dạn kinh nghiệm và trang thiết bị hiện đại, chúng tôi cam kết
            mang đến dịch vụ bảo dưỡng và cứu hộ đạt tiêu chuẩn quốc tế ngay tại
            chỗ.
          </p>
          <p className="text-base leading-7 text-ink-muted">
            Sứ mệnh của chúng tôi là trở thành &ldquo;Người Bảo Vệ&rdquo; tin
            cậy cho cộng đồng người lái xe, xử lý mọi sự cố kỹ thuật một cách
            nhanh chóng, chuyên nghiệp và minh bạch nhất.
          </p>

          {/* Mini-cards */}
          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border-soft pt-6">
            <div className="flex flex-col gap-1">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-brand-deep">
                <ShieldIcon className="h-4 w-4" />
              </span>
              <h3 className="mt-2 text-base font-bold text-ink">
                Chuyên Nghiệp
              </h3>
              <p className="text-sm leading-6 text-ink-muted">
                Kỹ thuật viên chứng chỉ quốc tế.
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-brand-deep">
                <ClockIcon className="h-4 w-4" />
              </span>
              <h3 className="mt-2 text-base font-bold text-ink">Tốc Độ</h3>
              <p className="text-sm leading-6 text-ink-muted">
                Phản ứng nhanh trong mọi tình huống.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
