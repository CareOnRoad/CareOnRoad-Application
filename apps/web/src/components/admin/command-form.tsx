"use client";

import { useActionState, useEffect, useState } from "react";
import type { ReactNode } from "react";

/**
 * The shared form for every administrative mutation.
 *
 * Three safety rules are enforced here, not in each tab:
 *
 * 1. **One idempotency key per form.** The key is minted once when the form
 *    mounts (`useState(() => crypto.randomUUID())`) and sent as a hidden
 *    field. Clicking "retry" after a network failure therefore REPLAYS the
 *    same command on the backend instead of creating a duplicate. Two forms
 *    on the same page get two different keys, because the backend scopes
 *    idempotency by `(actor, scope, key)` — the same key under two scopes
 *    runs both commands.
 * 2. **A real reason.** The backend requires 10–500 characters, so the
 *    textarea counts characters and blocks the submit below the minimum.
 * 3. **No silent failures.** The action result is rendered inline, including
 *    the backend's specific conflict reason.
 */

export type CommandFormState = {
  ok: boolean;
  message?: string;
  /** The backend `details.reason` code, when there was one. */
  reason?: string;
  /** Set when the command succeeded and the page should refresh. */
  refresh?: boolean;
};

export const INITIAL_COMMAND_STATE: CommandFormState = { ok: false };

/** The minimum reason length enforced by the backend. */
const REASON_MIN_LENGTH = 10;
/** The maximum reason length enforced by the backend. */
const REASON_MAX_LENGTH = 500;

export type CommandAction = (
  previous: CommandFormState,
  formData: FormData
) => Promise<CommandFormState | void>;

export function CommandForm({
  action,
  label,
  description,
  confirmText,
  /** Extra fields rendered above the reason textarea. */
  children,
  /** Disables the submit button (e.g. the action is not in `next_action_codes`). */
  disabled,
  /** Explains WHY the button is disabled. */
  disabledHint,
  variant = "default",
  onSuccess
}: {
  action: CommandAction;
  label: string;
  description?: string;
  confirmText?: string;
  children?: ReactNode;
  disabled?: boolean;
  disabledHint?: string;
  variant?: "default" | "danger";
  onSuccess?: () => void;
}) {
  // R7: one key per form instance. `useState` with a lazy initializer runs
  // exactly once per mount, so a re-render never changes the key.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [reason, setReason] = useState("");
  const [state, formAction, pending] = useActionState(
    async (previous: CommandFormState, formData: FormData) => {
      const result = await action(previous, formData);
      return result ?? { ok: true };
    },
    INITIAL_COMMAND_STATE
  );

  // The reason is a controlled field; the hidden idempotency key rides along
  // in the same FormData.
  useEffect(() => {
    if (state.ok && onSuccess) {
      onSuccess();
    }
  }, [state.ok, onSuccess]);

  const trimmed = reason.trim();
  const reasonTooShort = trimmed.length > 0 && trimmed.length < REASON_MIN_LENGTH;
  const reasonTooLong = trimmed.length > REASON_MAX_LENGTH;
  const canSubmit =
    !pending && !disabled && trimmed.length >= REASON_MIN_LENGTH && !reasonTooLong;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      {children}

      {description ? (
        <p className="text-xs" style={{ color: "#3d4d63" }}>
          {description}
        </p>
      ) : null}

      <div className="flex flex-col gap-1">
        <label
          htmlFor={`reason-${idempotencyKey}`}
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "#3d4d63" }}
        >
          Lý do thao tác <span style={{ color: "#b3131d" }}>*</span>
        </label>
        <textarea
          id={`reason-${idempotencyKey}`}
          name="reason"
          rows={3}
          required
          minLength={REASON_MIN_LENGTH}
          maxLength={REASON_MAX_LENGTH}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Mô tả ngắn gọn lý do (tối thiểu 10 ký tự). Lý do được ghi vào nhật ký kiểm toán."
          className="rounded-lg px-3 py-2 text-sm outline-none"
          style={{
            border: `1px solid ${reasonTooShort || reasonTooLong ? "#fc555f" : "#e5e9ef"}`,
            backgroundColor: "#fff",
            color: "#162130",
            resize: "vertical"
          }}
        />
        <div className="flex items-center justify-between text-[11px]">
          <span style={{ color: reasonTooShort ? "#b3131d" : "#6b7a8d" }}>
            {reasonTooShort
              ? `Cần thêm ${REASON_MIN_LENGTH - trimmed.length} ký tự.`
              : reasonTooLong
                ? "Lý do vượt quá 500 ký tự."
                : "Lý do bắt buộc, tối thiểu 10 ký tự."}
          </span>
          <span style={{ color: "#6b7a8d" }}>
            {trimmed.length}/{REASON_MAX_LENGTH}
          </span>
        </div>
      </div>

      {state.message ? (
        <p
          role="alert"
          className="rounded-lg px-3 py-2 text-xs font-semibold"
          style={
            state.ok
              ? { background: "rgba(0,162,58,0.12)", color: "#007a2b" }
              : { background: "rgba(252,85,95,0.12)", color: "#b3131d" }
          }
        >
          {state.message}
          {state.reason ? (
            <span className="font-mono"> ({state.reason})</span>
          ) : null}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            backgroundColor:
              variant === "danger" ? "#b3131d" : disabled ? "#9aa7b6" : "#162130"
          }}
        >
          {pending ? "Đang xử lý…" : (confirmText ?? label)}
        </button>
        {disabled && disabledHint ? (
          <span className="text-[11px]" style={{ color: "#6b7a8d" }}>
            {disabledHint}
          </span>
        ) : null}
      </div>
    </form>
  );
}
