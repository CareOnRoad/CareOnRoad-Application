"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRightIcon, MailIcon, ShieldIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/**
 * /dang-nhap — Đăng nhập (UI only, chưa wire BE).
 *
 * Layout 2 cột:
 *  - Trái: form đăng nhập (email + password + remember + submit).
 *  - Phải: panel nhân vật hỗ trợ thương hiệu (logo + tagline + điểm bán).
 *
 * Submit handler là no-op (setSubmitted(true)) — Phase sau sẽ wire vào
 * `httpClient` + `/api/v1/auth/profile` (sau khi BE có endpoint /auth/login thật).
 */
export function LoginSection() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  return (
    <section className="container-page py-16 md:py-24">
      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        {/* ==== Cột trái: Form ==== */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <span className="text-sm font-semibold uppercase tracking-wider text-brand-deep">
              Đăng nhập
            </span>
            <h1 className="text-3xl font-bold text-ink md:text-4xl">
              Chào mừng bạn quay lại
            </h1>
            <p className="text-ink-muted">
              Đăng nhập để theo dõi yêu cầu cứu hộ, đặt lịch bảo dưỡng và quản
              lý hồ sơ xe máy của bạn.
            </p>
          </div>

          <form
            className="flex flex-col gap-4 rounded-2xl border border-border-soft bg-surface p-6 shadow-card md:p-8"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">Email</span>
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

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">Mật khẩu</span>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 focus-within:border-ink">
                <ShieldIcon className="h-4 w-4 text-ink-subtle" />
                <input
                  required
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-subtle"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-xs font-medium text-ink-muted hover:text-ink"
                >
                  {showPassword ? "Ẩn" : "Hiện"}
                </button>
              </div>
            </label>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-ink-muted">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-brand-deep"
                />
                Ghi nhớ đăng nhập
              </label>
              <Link
                href="/quen-mat-khau"
                className="font-medium text-brand-deep hover:underline"
              >
                Quên mật khẩu?
              </Link>
            </div>

            <button
              type="submit"
              disabled={submitted}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-colors",
                submitted
                  ? "bg-ink-subtle text-surface"
                  : "bg-ink text-surface hover:bg-brand-deep",
              )}
            >
              {submitted ? "Đang xử lý..." : "Đăng nhập"}
              <ArrowRightIcon className="h-4 w-4" />
            </button>

            {submitted ? (
              <p
                role="status"
                className="rounded-lg bg-info-soft px-3 py-2 text-xs text-info"
              >
                UI demo — Phase sau sẽ wire vào backend thật. Hiện chưa có
                endpoint đăng nhập public trên web.
              </p>
            ) : null}
          </form>

          <p className="text-sm text-ink-muted">
            Chưa có tài khoản?{" "}
            <Link
              href="/dang-ky"
              className="font-semibold text-brand-deep hover:underline"
            >
              Đăng ký ngay
            </Link>
          </p>
        </div>

        {/* ==== Cột phải: Brand panel ==== */}
        <aside className="relative flex flex-col justify-between gap-8 overflow-hidden rounded-3xl border border-border-soft bg-gradient-to-br from-brand-soft to-surface p-8 shadow-pop md:p-10">
          <div className="flex flex-col gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-deep text-surface">
              <span className="text-lg font-bold">CR</span>
            </span>
            <h2 className="text-2xl font-bold text-ink md:text-3xl">
              Đồng hành cùng bạn trên mọi cung đường
            </h2>
            <p className="text-ink-muted">
              CareOnRoad kết nối hàng nghìn kỹ thuật viên cứu hộ xe máy chuyên
              nghiệp. Đăng nhập để tiếp tục hành trình an toàn của bạn.
            </p>
          </div>

          <ul className="grid gap-4">
            <li className="flex items-start gap-3 rounded-2xl bg-surface/70 p-4">
              <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-full bg-success text-surface">
                ✓
              </span>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-ink">
                  Phản hồi dưới 15 phút
                </span>
                <span className="text-xs text-ink-subtle">
                  Đội ngũ kỹ thuật viên túc trực 24/7
                </span>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-2xl bg-surface/70 p-4">
              <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-full bg-info text-surface">
                ★
              </span>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-ink">
                  Đánh giá minh bạch
                </span>
                <span className="text-xs text-ink-subtle">
                  Xem trước hồ sơ và điểm uy tín của kỹ thuật viên
                </span>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-2xl bg-surface/70 p-4">
              <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-full bg-accent text-surface">
                ₫
              </span>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-ink">
                  Thanh toán an toàn
                </span>
                <span className="text-xs text-ink-subtle">
                  Báo giá minh bạch trước khi xử lý
                </span>
              </div>
            </li>
          </ul>
        </aside>
      </div>
    </section>
  );
}