import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, BoltIcon } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Khẩn cấp — CareOnRoad",
  description: "Yêu cầu cứu hộ khẩn cấp cho xe máy.",
};

export default function EmergencyPage() {
  return (
    <section className="container-page py-20">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 rounded-3xl bg-accent px-8 py-16 text-center text-surface shadow-pop md:px-12">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-surface/15 text-surface">
          <BoltIcon className="h-8 w-8" />
        </span>
        <h1 className="text-3xl font-bold md:text-4xl">
          Trường hợp khẩn cấp?
        </h1>
        <p className="max-w-xl text-surface/90">
          Nhấn nút bên dưới để gọi trực tiếp tổng đài 24/7 hoặc tạo yêu cầu ưu
          tiên, hệ thống sẽ điều phối kỹ thuật viên tới vị trí của bạn trong
          thời gian nhanh nhất.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="tel:19006868"
            className="inline-flex items-center gap-2 rounded-full bg-surface px-6 py-3 text-sm font-bold text-accent"
          >
            Gọi 1900 6868
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link
            href="/yeu-cau?priority=emergency"
            className="inline-flex items-center gap-2 rounded-full border border-surface/40 bg-transparent px-6 py-3 text-sm font-semibold text-surface"
          >
            Tạo yêu cầu ưu tiên
          </Link>
        </div>
      </div>
    </section>
  );
}
