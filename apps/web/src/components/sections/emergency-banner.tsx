import Link from "next/link";
import { ArrowRightIcon, BoltIcon } from "@/components/ui/icons";

export function EmergencyBanner() {
  return (
    <section className="container-page py-12">
      <div className="relative overflow-hidden rounded-3xl bg-accent px-8 py-10 text-surface shadow-pop md:px-12 md:py-12">
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 hidden w-1/2 bg-cover bg-center md:block"
          style={{
            background:
              "radial-gradient(circle at 80% 50%, rgba(255,255,255,0.18), transparent 60%)",
          }}
        />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-surface/15 text-surface">
              <BoltIcon className="h-6 w-6" />
            </span>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-surface/80">
                Trường hợp khẩn cấp
              </span>
              <h2 className="text-2xl font-bold md:text-3xl">
                Xe không khởi động, tai nạn, hoặc sự cố giữa đường?
              </h2>
              <p className="max-w-xl text-surface/85">
                Nhấn nút dưới đây để hệ thống ưu tiên điều phối kỹ thuật viên
                tới vị trí của bạn trong thời gian nhanh nhất.
              </p>
            </div>
          </div>
          <Link
            href="/yeu-cau?priority=emergency"
            className="inline-flex w-fit items-center gap-2 rounded-full bg-surface px-6 py-3 text-sm font-bold text-accent transition-transform hover:-translate-y-0.5"
          >
            Yêu cầu khẩn cấp
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
