import { ArrowRightIcon } from "@/components/ui/icons";
import {
  JOIN_BETA_LABEL,
  PLAY_STORE_BETA_URL,
} from "@/lib/play-store";

export function CtaGlass() {
  return (
    <section className="container-page py-16">
      <div className="glass mx-auto flex max-w-5xl flex-col items-center gap-6 rounded-2xl border border-border bg-surface/60 px-12 py-12 text-center shadow-card backdrop-blur-md md:flex-row md:justify-between md:text-left">
        <div className="flex max-w-xl flex-col gap-3">
          <h2 className="text-2xl font-bold text-ink md:text-3xl">
            CareOnRoad đang trong giai đoạn thử nghiệm
          </h2>
          <p className="text-ink-muted">
            Tải app để trở thành một trong những người đầu tiên trải nghiệm dịch
            vụ cứu hộ và bảo dưỡng xe máy lưu động trên mobile.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href={PLAY_STORE_BETA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-surface shadow-pop transition-transform hover:-translate-y-0.5"
          >
            {JOIN_BETA_LABEL}
            <ArrowRightIcon className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}