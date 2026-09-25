"use client";

import { useState } from "react";
import { ArrowRightIcon, iconRegistry } from "@/components/ui/icons";
import type { ContactChannel, FaqItem } from "@/types";

interface Props {
  channels: ContactChannel[];
  faqs: FaqItem[];
}

export function ContactSection({ channels, faqs }: Props) {
  const [openId, setOpenId] = useState<string | null>(faqs[0]?.id ?? null);
  const [submitted, setSubmitted] = useState(false);

  return (
    <section className="container-page py-20">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <span className="text-sm font-semibold uppercase tracking-wider text-brand-deep">
              Liên hệ hỗ trợ
            </span>
            <h2 className="text-3xl font-bold text-ink md:text-4xl">
              Chúng tôi luôn sẵn sàng lắng nghe
            </h2>
            <p className="text-ink-muted">
              Bạn có thể liên hệ qua bất kỳ kênh nào dưới đây, hoặc gửi yêu cầu
              và chúng tôi sẽ phản hồi trong vòng 4 giờ làm việc.
            </p>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {channels.map((channel) => {
              const Icon = iconRegistry[channel.iconKey] ?? iconRegistry.chat;
              return (
                <li
                  key={channel.id}
                  className="flex flex-col gap-2 rounded-2xl border border-border-soft bg-surface p-5"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-info-soft text-info">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold text-ink">
                    {channel.label}
                  </span>
                  <span className="text-base font-medium text-ink">
                    {channel.value}
                  </span>
                  {channel.hint ? (
                    <span className="text-xs text-ink-subtle">
                      {channel.hint}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-col gap-8">
          <form
            className="flex flex-col gap-4 rounded-2xl border border-border-soft bg-surface p-6 shadow-card"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
          >
            <h3 className="text-xl font-semibold text-ink">Gửi yêu cầu</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-ink">Họ và tên</span>
                <input
                  required
                  name="name"
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-ink"
                  placeholder="Nguyễn Văn A"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-ink">Số điện thoại</span>
                <input
                  required
                  name="phone"
                  type="tel"
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-ink"
                  placeholder="0901 234 567"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm md:col-span-2">
                <span className="font-medium text-ink">Email</span>
                <input
                  required
                  name="email"
                  type="email"
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-ink"
                  placeholder="email@example.com"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm md:col-span-2">
                <span className="font-medium text-ink">Nội dung</span>
                <textarea
                  required
                  name="message"
                  rows={4}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-ink"
                  placeholder="Mô tả vấn đề bạn đang gặp..."
                />
              </label>
            </div>
            <button
              type="submit"
              className="inline-flex w-fit items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-surface transition-colors hover:bg-brand-deep"
            >
              Gửi yêu cầu
              <ArrowRightIcon className="h-4 w-4" />
            </button>
            {submitted && (
              <p
                role="status"
                className="text-sm text-success"
              >
                Đã ghi nhận yêu cầu. Chúng tôi sẽ phản hồi sớm nhất có thể.
              </p>
            )}
          </form>

          <div className="flex flex-col gap-3" id="faq">
            <h3 className="text-xl font-semibold text-ink">
              Câu hỏi thường gặp
            </h3>
            <ul className="flex flex-col divide-y divide-border-soft rounded-2xl border border-border-soft bg-surface">
              {faqs.map((item) => {
                const open = openId === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-ink"
                      aria-expanded={open}
                      onClick={() => setOpenId(open ? null : item.id)}
                    >
                      <span>{item.question}</span>
                      <span
                        className={`grid h-6 w-6 place-items-center text-brand-deep transition-transform ${
                          open ? "rotate-180" : ""
                        }`}
                      >
                        ▾
                      </span>
                    </button>
                    {open && (
                      <p className="px-5 pb-4 text-sm text-ink-muted">
                        {item.answer}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
