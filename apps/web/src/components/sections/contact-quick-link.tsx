import { ArrowRightIcon } from "@/components/ui/icons";
import {
  JOIN_BETA_LABEL,
  PLAY_STORE_BETA_URL,
} from "@/lib/play-store";

/**
 * Contact Quick Link — theo frame figma node 38:1210.
 *
 * Pill ngang full-width 1280×184, nền xanh lá #00a23a, radius 24.
 *  - Bên trái: thông điệp kêu gọi tải app thử nghiệm
 *  - Bên phải: nút "Tham gia thử nghiệm ngay" mở tab mới tới Google Play
 *    closed beta (web đã là landing-only, không còn CTA hotline/yeu-cau).
 */
export function ContactQuickLink() {
  return (
    <section className="bg-surface pb-16 md:pb-20">
      <div className="container-page">
        <div
          className="flex flex-col items-stretch gap-6 rounded-3xl px-10 py-8 text-surface md:flex-row md:items-center md:justify-between md:gap-12"
          style={{ backgroundColor: "#00a23a" }}
        >
          <div className="flex flex-col gap-2">
            <span
              className="text-xs font-semibold uppercase md:text-sm"
              style={{ letterSpacing: "0.3em" }}
            >
              CAREBETA — MỜI BẠN THỬ NGHIỆM
            </span>
            <h3 className="text-xl font-bold md:text-2xl">
              CareOnRoad đang trong giai đoạn thử nghiệm
            </h3>
            <p className="max-w-2xl text-sm leading-6 text-surface/90 md:text-base">
              Tải app ngay hôm nay để trở thành một trong những người đầu tiên
              trải nghiệm dịch vụ cứu hộ và bảo dưỡng xe máy lưu động.
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 md:items-end">
            <a
              href={PLAY_STORE_BETA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-surface px-6 py-3 text-base font-bold text-brand-deep shadow-pop transition-transform hover:-translate-y-0.5 md:text-lg"
            >
              {JOIN_BETA_LABEL}
              <ArrowRightIcon className="h-5 w-5" />
            </a>
            <span className="text-xs text-surface/85">
              Mở Google Play closed beta
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}