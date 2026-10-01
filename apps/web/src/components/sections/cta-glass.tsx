import Link from "next/link";
import { ArrowRightIcon } from "@/components/ui/icons";

export function CtaGlass() {
  return (
    <section className="container-page py-16">
      <div className="glass mx-auto flex max-w-5xl flex-col items-center gap-6 rounded-2xl border border-border bg-surface/60 px-12 py-12 text-center shadow-card backdrop-blur-md md:flex-row md:justify-between md:text-left">
        <div className="flex max-w-xl flex-col gap-3">
          <h2 className="text-2xl font-bold text-ink md:text-3xl">
            Sẵn sàng trợ giúp 24/7 — chỉ với một cuộc gọi
          </h2>
          <p className="text-ink-muted">
            Đội ngũ kỹ thuật viên và tổng đài viên luôn trực chiếm, sẵn sàng
            phản hồi trong vòng vài phút.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="tel:19006868"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-surface transition-colors hover:bg-brand-deep"
          >
            Gọi 1900 6868
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link
            href="/yeu-cau"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-surface px-6 py-3 text-sm font-semibold text-ink transition-colors hover:border-ink"
          >
            Tạo yêu cầu online
          </Link>
        </div>
      </div>
    </section>
  );
}
