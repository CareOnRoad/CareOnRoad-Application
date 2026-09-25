"use client";

import { useState } from "react";
import { BoltIcon } from "@/components/ui/icons";
import type { EmergencyRequest, ServiceCategory } from "@/types";

const statusLabels: Record<EmergencyRequest["status"], string> = {
  draft: "Đang tạo",
  submitted: "Đã gửi",
  dispatching: "Đang điều phối",
  assigned: "Đã phân công",
  en_route: "Đang di chuyển",
  arrived: "Đã tới nơi",
  in_progress: "Đang xử lý",
  awaiting_payment: "Chờ thanh toán",
  completed: "Hoàn tất",
  cancelled: "Đã huỷ",
};

interface Props {
  services: ServiceCategory[];
}

export function RequestForm({ services }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [service, setService] = useState(services[0]?.slug ?? "");

  return (
    <section className="container-page py-20">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col gap-4">
          <span className="text-sm font-semibold uppercase tracking-wider text-accent">
            Yêu cầu cứu hộ
          </span>
          <h2 className="text-3xl font-bold text-ink md:text-4xl">
            Tạo yêu cầu, kỹ thuật viên sẽ tới trong vài phút
          </h2>
          <p className="text-ink-muted">
            Điền thông tin bên dưới. Trường hợp khẩn cấp vui lòng gọi trực tiếp
            <span className="font-semibold text-accent"> 1900 6868</span>.
          </p>
          <div className="flex items-start gap-3 rounded-2xl border border-border-soft bg-surface p-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent">
              <BoltIcon className="h-5 w-5" />
            </span>
            <div className="flex flex-col text-sm">
              <span className="font-semibold text-ink">
                Trường hợp khẩn cấp
              </span>
              <span className="text-ink-muted">
                Hệ thống ưu tiên xử lý và điều phối kỹ thuật viên gần nhất.
              </span>
            </div>
          </div>
        </div>

        <form
          className="flex flex-col gap-4 rounded-2xl border border-border-soft bg-surface p-6 shadow-card"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
          }}
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Loại dịch vụ</span>
            <select
              required
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-ink"
            >
              {services.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">Họ tên</span>
              <input
                required
                className="rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-ink"
                placeholder="Nguyễn Văn A"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">Số điện thoại</span>
              <input
                required
                type="tel"
                className="rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-ink"
                placeholder="0901 234 567"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Vị trí hiện tại</span>
            <input
              required
              className="rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-ink"
              placeholder="Số nhà, đường, quận/huyện..."
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Mô tả tình trạng</span>
            <textarea
              required
              rows={4}
              className="rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-ink"
              placeholder="Xe không khởi động, nghe tiếng kêu lạ, xẹp lốp..."
            />
          </label>

          <button
            type="submit"
            className="inline-flex w-fit items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-surface shadow-pop transition-transform hover:-translate-y-0.5"
          >
            Gửi yêu cầu
          </button>

          {submitted && (
            <div role="status" className="rounded-xl bg-success/10 p-4 text-sm text-success">
              <p className="font-semibold">Đã gửi yêu cầu thành công!</p>
              <p>
                Mã yêu cầu: <span className="font-mono">COR-RV-20260926-0099</span>{" "}
                — trạng thái:{" "}
                <span className="font-semibold">
                  {statusLabels.dispatching}
                </span>
              </p>
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
