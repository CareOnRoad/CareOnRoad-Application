"use client";

import { useActionState } from "react";
import { submitDeletionRequest } from "./actions";
import { DELETION_SUPPORT_EMAIL } from "./constants";
import Link from "next/link";

type State =
  | { ok: true; contactEmail: string; savedToFile: boolean }
  | { ok: false; error: string };

const initialState: State | null = null;

export function DeletionRequestForm() {
  const [state, formAction, pending] = useActionState(
    submitDeletionRequest,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-2xl border border-border-soft bg-surface p-6 shadow-card"
    >
      <h2 className="text-xl font-bold text-ink">Gửi yêu cầu xoá</h2>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Email đăng ký tài khoản</span>
        <input
          required
          type="email"
          name="email"
          placeholder="ban@example.com"
          className="rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-ink"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">
          Lý do (tuỳ chọn, giúp chúng tôi cải thiện dịch vụ)
        </span>
        <textarea
          name="reason"
          rows={4}
          placeholder="VD: không còn sử dụng, chuyển sang ứng dụng khác..."
          className="rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-ink"
        />
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input
          required
          type="checkbox"
          name="confirm"
          className="mt-1"
          aria-label="Xác nhận hiểu rõ việc xoá tài khoản là không thể hoàn tác"
        />
        <span className="text-ink-muted">
          Tôi hiểu rằng yêu cầu này sẽ xoá vĩnh viễn tài khoản và toàn bộ dữ
          liệu liên quan, không thể khôi phục.
        </span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-fit items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-surface shadow-pop transition-transform hover:-translate-y-0.5 disabled:opacity-60"
      >
        {pending ? "Đang gửi…" : "Gửi yêu cầu xoá"}
      </button>

      {state && state.ok ? (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-xl bg-success/10 p-4 text-sm text-success"
        >
          <p className="font-semibold">Đã ghi nhận yêu cầu của bạn.</p>
          <p>
            Để hoàn tất, vui lòng gửi email tới{" "}
            <a
              href={`mailto:${state.contactEmail}`}
              className="font-semibold underline"
            >
              {state.contactEmail}
            </a>{" "}
            với tiêu đề &ldquo;Yêu cầu xoá tài khoản&rdquo; và email đăng ký
            của bạn. Chúng tôi sẽ xác minh và xử lý trong vòng{" "}
            <strong>7 ngày làm việc</strong>.
          </p>
          <a
            href={`mailto:${state.contactEmail}?subject=${encodeURIComponent(
              "Yêu cầu xoá tài khoản CareOnRoad",
            )}`}
            className="mt-1 inline-flex w-fit items-center gap-2 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-surface transition-colors hover:bg-brand-deep"
          >
            Mở email Gmail
          </a>
          {state.savedToFile ? (
            <p className="text-xs text-ink-subtle">
              Yêu cầu đã được hệ thống ghi nhận tự động — đội ngũ admin sẽ xử
              lý và phản hồi qua email đăng ký.
            </p>
          ) : (
            <p className="text-xs text-ink-subtle">
              Yêu cầu chưa ghi được lên hệ thống (server tạm thời không khả
              dụng). Vui lòng gửi email xác nhận để chúng tôi xử lý thủ công.
            </p>
          )}
        </div>
      ) : null}

      {state && !state.ok ? (
        <p role="alert" className="text-sm text-accent">
          {state.error}
        </p>
      ) : null}

      <p className="text-xs text-ink-subtle">
        Mọi thắc mắc có thể gửi về{" "}
        <a
          href={`mailto:${DELETION_SUPPORT_EMAIL}`}
          className="text-brand-deep underline"
        >
          {DELETION_SUPPORT_EMAIL}
        </a>
        . Xem thêm tại{" "}
        <Link href="/an-toan-du-lieu" className="text-brand-deep underline">
          An toàn dữ liệu
        </Link>
        .
      </p>
    </form>
  );
}
