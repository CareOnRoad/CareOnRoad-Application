import Link from "next/link";
import { iconRegistry } from "@/components/ui/icons";
import type { ServiceCategory } from "@/types";

const formatVnd = (n: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n);

interface Props {
  services: ServiceCategory[];
  showHeader?: boolean;
}

export function ServicesGrid({ services, showHeader = true }: Props) {
  return (
    <section className="container-page py-20">
      {showHeader && (
        <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <span className="text-sm font-semibold uppercase tracking-wider text-brand-deep">
              Dịch vụ nổi bật
            </span>
            <h2 className="mt-2 text-3xl font-bold text-ink md:text-4xl">
              Xử lý nhanh mọi sự cố xe máy
            </h2>
            <p className="mt-3 text-ink-muted">
              Chọn hạng mục phù hợp, hệ thống sẽ tự động đề xuất kỹ thuật viên
              gần bạn nhất.
            </p>
          </div>
          <Link
            href="/dich-vu"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-deep hover:underline"
          >
            Xem tất cả dịch vụ →
          </Link>
        </div>
      )}

      <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => {
          const Icon =
            (iconRegistry as Record<string, (typeof iconRegistry)[keyof typeof iconRegistry]>)[
              service.iconKey
            ] ?? iconRegistry.wrench;
          return (
            <li
              key={service.id}
              className="flex h-full flex-col gap-4 rounded-2xl border border-border-soft bg-surface p-6 shadow-card transition-shadow hover:shadow-pop"
            >
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand text-brand-deep">
                <Icon className="h-6 w-6" />
              </span>
              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-semibold text-ink">
                  {service.title}
                </h3>
                <p className="text-sm text-ink-muted">{service.description}</p>
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-border-soft pt-4 text-sm">
                <span className="text-ink-subtle">Từ {formatVnd(service.basePriceVnd)}</span>
                <Link
                  href={`/yeu-cau?service=${service.slug}`}
                  className="font-semibold text-brand-deep hover:underline"
                >
                  Đặt ngay
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
