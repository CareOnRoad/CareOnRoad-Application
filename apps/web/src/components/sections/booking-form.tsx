"use client";

import { useMemo, useState } from "react";
import { ArrowRightIcon, ClockIcon } from "@/components/ui/icons";
import type { BookingSlot } from "@/types";

interface Props {
  slots: BookingSlot[];
}

export function BookingForm({ slots }: Props) {
  const grouped = useMemo(() => {
    const map = new Map<string, BookingSlot[]>();
    slots.forEach((slot) => {
      const list = map.get(slot.date) ?? [];
      list.push(slot);
      map.set(slot.date, list);
    });
    return Array.from(map.entries());
  }, [slots]);

  const [date, setDate] = useState<string>(grouped[0]?.[0] ?? "");
  const [slotId, setSlotId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const visibleSlots = grouped.find(([d]) => d === date)?.[1] ?? [];

  return (
    <section className="container-page py-20">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col gap-4">
          <span className="text-sm font-semibold uppercase tracking-wider text-brand-deep">
            Đặt lịch trước
          </span>
          <h2 className="text-3xl font-bold text-ink md:text-4xl">
            Chọn khung giờ thuận tiện
          </h2>
          <p className="text-ink-muted">
            CareOnRoad cho phép đặt lịch bảo dưỡng hoặc cứu hộ trước 24 giờ.
            Hệ thống sẽ giữ chỗ kỹ thuật viên cho đến khi bạn đến.
          </p>
          <ul className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-surface p-6 text-sm">
            <li className="flex items-center gap-3">
              <ClockIcon className="h-5 w-5 text-brand-deep" />
              <span>Giờ làm việc: 08:00 – 19:00 mỗi ngày</span>
            </li>
            <li className="flex items-center gap-3">
              <ClockIcon className="h-5 w-5 text-brand-deep" />
              <span>Đặt trước ít nhất 2 giờ</span>
            </li>
            <li className="flex items-center gap-3">
              <ClockIcon className="h-5 w-5 text-brand-deep" />
              <span>Có thể huỷ miễn phí trước 30 phút</span>
            </li>
          </ul>
        </div>

        <form
          className="flex flex-col gap-6 rounded-2xl border border-border-soft bg-surface p-6 shadow-card"
          onSubmit={(e) => {
            e.preventDefault();
            if (!slotId) return;
            setConfirmed(true);
          }}
        >
          <div className="flex flex-col gap-3">
            <span className="text-sm font-semibold text-ink">Chọn ngày</span>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {grouped.map(([d]) => {
                const dt = new Date(d);
                return (
                  <button
                    type="button"
                    key={d}
                    onClick={() => {
                      setDate(d);
                      setSlotId(null);
                      setConfirmed(false);
                    }}
                    className={`flex min-w-[88px] flex-col items-center rounded-xl border px-3 py-2 text-xs ${
                      date === d
                        ? "border-ink bg-ink text-surface"
                        : "border-border-soft bg-surface text-ink hover:border-ink"
                    }`}
                  >
                    <span className="text-[11px] uppercase">
                      {dt.toLocaleDateString("vi-VN", { weekday: "short" })}
                    </span>
                    <span className="text-lg font-bold">
                      {dt.toLocaleDateString("vi-VN", { day: "2-digit" })}
                    </span>
                    <span className="text-[11px]">
                      {dt.toLocaleDateString("vi-VN", { month: "2-digit" })}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-sm font-semibold text-ink">Chọn giờ</span>
            <div className="grid grid-cols-3 gap-2">
              {visibleSlots.map((slot) => (
                <button
                  type="button"
                  key={slot.id}
                  disabled={!slot.available}
                  onClick={() => setSlotId(slot.id)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    !slot.available
                      ? "cursor-not-allowed border-border-soft bg-surface-muted text-ink-subtle line-through"
                      : slotId === slot.id
                        ? "border-ink bg-ink text-surface"
                        : "border-border-soft bg-surface text-ink hover:border-ink"
                  }`}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          </div>

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
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              <span className="font-medium text-ink">Địa chỉ</span>
              <input
                required
                className="rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-ink"
                placeholder="Số nhà, đường, quận/huyện..."
              />
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              <span className="font-medium text-ink">Ghi chú (tuỳ chọn)</span>
              <textarea
                rows={3}
                className="rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-ink"
                placeholder="Mô tả thêm về tình trạng xe hoặc yêu cầu đặc biệt..."
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={!slotId}
            className="inline-flex w-fit items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-surface transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-ink-subtle"
          >
            Xác nhận đặt lịch
            <ArrowRightIcon className="h-4 w-4" />
          </button>

          {confirmed && (
            <p role="status" className="text-sm text-success">
              Đã ghi nhận lịch. Kỹ thuật viên sẽ liên hệ xác nhận trong ít phút.
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
