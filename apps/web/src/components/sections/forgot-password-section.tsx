"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRightIcon, MailIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/**
 * /quen-mat-khau — Quên mật khẩu (UI only, chưa wire BE).
 *
 * Flow UI:
 *  1. Form nhập email → submit → chuyển sang "trạng thái đã gửi" với banner xác nhận.
 *  2. Phase sau sẽ gọi Supabase `resetPasswordForEmail` + redirect sang trang đặt lại mật khẩu.
 *
 * Không render bảng mật khẩu mới vì BE chưa có endpoint public.
 */
export function ForgotPasswordSection() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <section className="container-page py-16 md:py-24">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-3">
          <span className="text-sm font-semibold uppercase tracking-wider text-brand-deep">
            Quên mật khẩu
          </span>
          <h1 className="text-3xl font-bold text-ink md:text-4xl">
            Đặt lại mật khẩu của bạn
          </h1>
          <p className="text-ink-muted">
            Nhập email đã đăng ký — chúng tôi sẽ gửi liên kết đặt lại mật khẩu
            đến hộp thư của bạn trong vài phút.
          </p>
        </div>

        {submitted ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-success/40 bg-success/5 p-6 shadow-card md:p-8">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-success text-surface">
                ✓
              </span>
              <div className="flex flex-col gap-1">
                <span className="text-base font-semibold text-ink">
                  Đã gửi yêu cầu
                </span>
                <span className="text-sm text-ink-muted">
                  Vui lòng kiểm tra hộp thư{" "}
                  <strong className="font-semibold text-ink">{email}</strong>.
                </span>
              </div>
            </div>
            <ul className="grid gap-2 text-xs text-ink-muted">
              <li>• Liên kết đặt lại có hiệu lực trong 1 giờ.</li>
              <li>• Kiểm tra cả thư mục spam/quảng cáo nếu không thấy.</li>
              <li>• Chưa nhận được? Bấm &ldquo;Gửi lại&rdquo; sau vài phút.</li>
            </ul>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-surface-muted"
              >
                Gửi lại
              </button>
              <Link
                href="/dang-nhap"
                className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-surface hover:bg-brand-deep"
              >
                Quay lại đăng nhập
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4 rounded-2xl border border-border-soft bg-surface p-6 shadow-card md:p-8"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">Email đã đăng ký</span>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 focus-within:border-ink">
                <MailIcon className="h-4 w-4 text-ink-subtle" />
                <input
                  required
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ban@example.com"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-subtle"
                />
              </div>
            </label>

            <button
              type="submit"
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-surface transition-colors hover:bg-brand-deep",
              )}
            >
              Gửi liên kết đặt lại
              <ArrowRightIcon className="h-4 w-4" />
            </button>

            <p className="text-xs text-ink-subtle">
              UI demo — Phase sau sẽ gọi Supabase Auth
              <code className="mx-1 rounded bg-surface-muted px-1 py-0.5 text-[11px]">
                resetPasswordForEmail
              </code>
              .
            </p>
          </form>
        )}

        <p className="text-center text-sm text-ink-muted">
          Nhớ mật khẩu rồi?{" "}
          <Link
            href="/dang-nhap"
            className="font-semibold text-brand-deep hover:underline"
          >
            Quay lại đăng nhập
          </Link>
        </p>
      </div>
    </section>
  );
}