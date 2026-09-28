"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRightIcon, MailIcon, PhoneIcon, ShieldIcon, UserIcon, WrenchIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/**
 * /dang-ky — Đăng ký (UI only, chưa wire BE).
 *
 * Tabs chọn role (rider / mechanic) — UI-only state, BE Phase sau sẽ gán role
 * thông qua Supabase Auth + bootstrap profile.
 *
 * Form fields:
 *  - Chung: Họ tên, Email, Số điện thoại, Mật khẩu, Xác nhận mật khẩu, Điều khoản.
 *  - Mechanic thêm: Số năm kinh nghiệm, Khu vực hoạt động.
 */
export function SignupSection() {
  const [role, setRole] = useState<"rider" | "mechanic">("rider");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    agree: false,
    experienceYears: "",
    area: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const update = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value =
        e.target instanceof HTMLInputElement && e.target.type === "checkbox"
          ? e.target.checked
          : e.target.value;
      setForm((prev) => ({ ...prev, [key]: value }));
    };

  return (
    <section className="container-page py-16 md:py-24">
      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        {/* ==== Cột trái: Form ==== */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <span className="text-sm font-semibold uppercase tracking-wider text-brand-deep">
              Đăng ký
            </span>
            <h1 className="text-3xl font-bold text-ink md:text-4xl">
              Tạo tài khoản CareOnRoad
            </h1>
            <p className="text-ink-muted">
              Chọn vai trò phù hợp với bạn. Tài khoản được bảo vệ bằng xác
              thực Supabase — chúng tôi không lưu mật khẩu của bạn.
            </p>
          </div>

          {/* Role tabs */}
          <div
            role="tablist"
            aria-label="Chọn vai trò"
            className="grid grid-cols-2 gap-2 rounded-2xl border border-border-soft bg-surface p-2 shadow-card"
          >
            <button
              type="button"
              role="tab"
              aria-selected={role === "rider"}
              onClick={() => setRole("rider")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors",
                role === "rider"
                  ? "bg-ink text-surface"
                  : "text-ink-muted hover:bg-surface-muted",
              )}
            >
              <UserIcon className="h-4 w-4" />
              Người dùng (Rider)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={role === "mechanic"}
              onClick={() => setRole("mechanic")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors",
                role === "mechanic"
                  ? "bg-ink text-surface"
                  : "text-ink-muted hover:bg-surface-muted",
              )}
            >
              <WrenchIcon className="h-4 w-4" />
              Kỹ thuật viên
            </button>
          </div>

          <form
            className="flex flex-col gap-4 rounded-2xl border border-border-soft bg-surface p-6 shadow-card md:p-8"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">Họ và tên</span>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 focus-within:border-ink">
                <UserIcon className="h-4 w-4 text-ink-subtle" />
                <input
                  required
                  name="name"
                  value={form.name}
                  onChange={update("name")}
                  placeholder="Nguyễn Văn A"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-subtle"
                />
              </div>
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-ink">Email</span>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 focus-within:border-ink">
                  <MailIcon className="h-4 w-4 text-ink-subtle" />
                  <input
                    required
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={update("email")}
                    placeholder="ban@example.com"
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-subtle"
                  />
                </div>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-ink">Số điện thoại</span>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 focus-within:border-ink">
                  <PhoneIcon className="h-4 w-4 text-ink-subtle" />
                  <input
                    required
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={update("phone")}
                    placeholder="0901 234 567"
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-subtle"
                  />
                </div>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-ink">Mật khẩu</span>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 focus-within:border-ink">
                  <ShieldIcon className="h-4 w-4 text-ink-subtle" />
                  <input
                    required
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={6}
                    value={form.password}
                    onChange={update("password")}
                    placeholder="Tối thiểu 6 ký tự"
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

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-ink">Xác nhận mật khẩu</span>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 focus-within:border-ink">
                  <ShieldIcon className="h-4 w-4 text-ink-subtle" />
                  <input
                    required
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={update("confirmPassword")}
                    placeholder="Nhập lại mật khẩu"
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-subtle"
                  />
                </div>
              </label>
            </div>

            {role === "mechanic" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-ink">Số năm kinh nghiệm</span>
                  <input
                    name="experienceYears"
                    type="number"
                    min={0}
                    max={50}
                    value={form.experienceYears}
                    onChange={update("experienceYears")}
                    placeholder="VD: 5"
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-ink"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-ink">Khu vực hoạt động</span>
                  <input
                    name="area"
                    value={form.area}
                    onChange={update("area")}
                    placeholder="VD: Quận 1, Bình Thạnh"
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-ink"
                  />
                </label>
              </div>
            ) : null}

            <label className="flex items-start gap-2 text-xs text-ink-muted">
              <input
                required
                type="checkbox"
                checked={form.agree}
                onChange={update("agree")}
                className="mt-0.5 h-4 w-4 rounded border-border accent-brand-deep"
              />
              <span>
                Tôi đồng ý với{" "}
                <Link href="#" className="font-medium text-brand-deep hover:underline">
                  Điều khoản dịch vụ
                </Link>{" "}
                và{" "}
                <Link href="#" className="font-medium text-brand-deep hover:underline">
                  Chính sách bảo mật
                </Link>{" "}
                của CareOnRoad.
              </span>
            </label>

            <button
              type="submit"
              disabled={submitted || !form.agree}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-colors",
                submitted || !form.agree
                  ? "bg-ink-subtle text-surface"
                  : "bg-ink text-surface hover:bg-brand-deep",
              )}
            >
              {submitted
                ? "Đang tạo tài khoản..."
                : role === "mechanic"
                  ? "Đăng ký kỹ thuật viên"
                  : "Đăng ký người dùng"}
              <ArrowRightIcon className="h-4 w-4" />
            </button>

            {submitted ? (
              <p
                role="status"
                className="rounded-lg bg-info-soft px-3 py-2 text-xs text-info"
              >
                UI demo — Phase sau sẽ wire vào Supabase Auth và
                <code className="mx-1 rounded bg-surface px-1 py-0.5 text-[11px]">
                  POST /api/v1/auth/profile
                </code>
                .
              </p>
            ) : null}
          </form>

          <p className="text-sm text-ink-muted">
            Đã có tài khoản?{" "}
            <Link
              href="/dang-nhap"
              className="font-semibold text-brand-deep hover:underline"
            >
              Đăng nhập
            </Link>
          </p>
        </div>

        {/* ==== Cột phải: Role explainer ==== */}
        <aside className="flex flex-col gap-6 rounded-3xl border border-border-soft bg-surface p-6 shadow-card md:p-8">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold uppercase tracking-wider text-brand-deep">
              {role === "rider" ? "Người dùng (Rider)" : "Kỹ thuật viên"}
            </span>
            <h2 className="text-2xl font-bold text-ink">
              {role === "rider"
                ? "Tìm cứu hộ nhanh chóng"
                : "Nhận việc ngay khi rảnh"}
            </h2>
          </div>

          {role === "rider" ? (
            <ul className="grid gap-3 text-sm">
              <li className="flex items-start gap-3 rounded-xl bg-surface-muted p-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-deep text-surface">
                  1
                </span>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-ink">Tạo yêu cầu</span>
                  <span className="text-ink-muted">
                    Mô tả sự cố, đính kèm ảnh/video và gửi đi.
                  </span>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-xl bg-surface-muted p-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-deep text-surface">
                  2
                </span>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-ink">Chờ kỹ thuật viên</span>
                  <span className="text-ink-muted">
                    Hệ thống điều phối KTV phù hợp trong vòng vài phút.
                  </span>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-xl bg-surface-muted p-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-deep text-surface">
                  3
                </span>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-ink">Theo dõi & đánh giá</span>
                  <span className="text-ink-muted">
                    Xem tiến độ realtime, duyệt báo giá, đánh giá sau khi xong.
                  </span>
                </div>
              </li>
            </ul>
          ) : (
            <ul className="grid gap-3 text-sm">
              <li className="flex items-start gap-3 rounded-xl bg-surface-muted p-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-surface">
                  1
                </span>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-ink">Tạo hồ sơ năng lực</span>
                  <span className="text-ink-muted">
                    Kinh nghiệm, chuyên môn, khu vực hoạt động, giờ làm việc.
                  </span>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-xl bg-surface-muted p-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-surface">
                  2
                </span>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-ink">Nhận đề nghị</span>
                  <span className="text-ink-muted">
                    Hệ thống gửi offer khi có yêu cầu phù hợp gần bạn.
                  </span>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-xl bg-surface-muted p-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-surface">
                  3
                </span>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-ink">Nhận việc & đánh giá</span>
                  <span className="text-ink-muted">
                    Chấp nhận đề nghị, di chuyển đến hiện trường, hoàn thành checklist.
                  </span>
                </div>
              </li>
            </ul>
          )}

          <p className="rounded-xl bg-warning/10 px-4 py-3 text-xs text-warning">
            <strong className="font-semibold">Lưu ý:</strong> Đăng ký kỹ thuật
            viên cần được admin duyệt trước khi nhận việc thật.
          </p>
        </aside>
      </div>
    </section>
  );
}