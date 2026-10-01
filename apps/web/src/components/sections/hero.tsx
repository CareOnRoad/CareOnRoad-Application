import Link from "next/link";
import { ArrowRightIcon, ShieldIcon } from "@/components/ui/icons";

interface HeroProps {
  highlights: string[];
  stats: { label: string; value: string }[];
}

export function Hero({ highlights, stats }: HeroProps) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-0 h-[520px] w-[640px] rounded-full"
        style={{ background: "var(--gradient-mint)" }}
      />
      <div className="container-page relative grid gap-12 py-20 lg:grid-cols-[1.2fr_1fr] lg:py-28">
        <div className="flex flex-col gap-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-ink">
            <ShieldIcon className="h-4 w-4 text-brand-deep" />
            Đối tác cứu hộ đáng tin cậy
          </span>
          <h1 className="text-4xl font-bold leading-tight text-ink md:text-5xl lg:text-6xl">
            Cứu hộ xe máy <br />
            <span className="text-brand-deep">trong 30 phút</span>
          </h1>
          <p className="max-w-xl text-base text-ink-muted md:text-lg">
            CareOnRoad kết nối bạn với hơn 1.200 kỹ thuật viên cứu hộ trên toàn
            quốc. Mô tả tình trạng xe, AI hỗ trợ chẩn đoán nhanh, và theo dõi
            kỹ thuật viên di chuyển đến vị trí của bạn theo thời gian thực.
          </p>

          <ul className="flex flex-wrap gap-2">
            {highlights.map((item) => (
              <li
                key={item}
                className="rounded-full border border-border bg-surface/70 px-3 py-1.5 text-sm text-ink-muted"
              >
                {item}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/yeu-cau"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-surface shadow-pop transition-transform hover:-translate-y-0.5"
            >
              Yêu cầu cứu hộ ngay
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/dich-vu"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-6 py-3 text-sm font-semibold text-ink transition-colors hover:border-ink"
            >
              Xem dịch vụ
            </Link>
          </div>
        </div>

        <div className="relative">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 rounded-3xl bg-brand"
          />
          <div className="glass rounded-3xl p-8 shadow-pop">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-ink-subtle">
                Yêu cầu gần đây
              </span>
              <span className="text-2xl font-bold text-ink">
                3 yêu cầu đang chờ
              </span>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-4">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl border border-border-soft bg-surface p-4"
                >
                  <dt className="text-xs uppercase tracking-wide text-ink-subtle">
                    {s.label}
                  </dt>
                  <dd className="mt-2 text-xl font-bold text-ink">
                    {s.value}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border-soft bg-surface px-4 py-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-info-soft text-info">
                <ArrowRightIcon className="h-4 w-4" />
              </span>
              <div className="flex flex-col text-sm">
                <span className="font-semibold text-ink">
                  Trung bình 18 phút tới nơi
                </span>
                <span className="text-ink-subtle">
                  Cập nhật theo dữ liệu tháng 9
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
