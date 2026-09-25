import { PhoneIcon } from "@/components/ui/icons";

/**
 * Contact Quick Link — theo frame figma node 38:1210.
 *
 * Pill ngang full-width 1280×184, nền xanh lá #00a23a, radius 24.
 *  - Bên trái: title "Bạn Đang Gặp Sự Cố Trên Đường?" + đoạn mô tả
 *  - Bên phải: "HOTLINE CỨU HỘ 24/7" + số "1900 1234"
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
            <h3 className="text-xl font-bold md:text-2xl">
              Bạn Đang Gặp Sự Cố Trên Đường?
            </h3>
            <p className="max-w-2xl text-sm leading-6 text-surface/90 md:text-base">
              Đừng lo lắng, đội ngũ CareOnRoad luôn túc trực để hỗ trợ bạn ngay
              lập tức. Chỉ một cuộc gọi, chúng tôi có mặt!
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 md:items-end">
            <span
              className="text-xs font-semibold uppercase md:text-sm"
              style={{ letterSpacing: "0.3em" }}
            >
              HOTLINE CỨU HỘ 24/7
            </span>
            <a
              href="tel:19001234"
              className="flex items-center gap-2 text-2xl font-bold tracking-wide md:text-3xl"
            >
              <PhoneIcon className="h-6 w-6" />
              1900 1234
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
