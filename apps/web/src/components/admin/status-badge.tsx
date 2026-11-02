import type { ReactNode } from "react";

/**
 * A table cell that renders a status value as a coloured badge.
 *
 * The tone map is intentionally data-driven rather than a giant switch: the
 * backend status vocabulary is broad and grows over time, and an unknown
 * value must still render legibly (as a neutral badge) instead of crashing
 * the page.
 */

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const TONE_STYLES: Record<Tone, { background: string; color: string }> = {
  neutral: { background: "#e5e9ef", color: "#162130" },
  success: { background: "rgba(0,162,58,0.14)", color: "#007a2b" },
  warning: { background: "rgba(252,175,58,0.18)", color: "#9a5b00" },
  danger: { background: "rgba(252,85,95,0.16)", color: "#b3131d" },
  info: { background: "rgba(61,109,204,0.14)", color: "#3d6dcc" }
};

/**
 * Explicit tone per known status value.
 *
 * Only the values that are ambiguous are listed. Everything else falls back
 * to a rule-based tone below.
 */
const STATUS_TONES: Record<string, Tone> = {
  // Users
  active: "success",
  suspended: "warning",
  archived: "neutral",
  banned: "danger",
  pending: "warning",
  rejected: "danger",
  // Mechanics
  fresh: "success",
  stale: "warning",
  missing: "danger",
  idle: "neutral",
  active_assignment: "info",
  // Requests
  submitted: "info",
  dispatching: "info",
  offered: "info",
  assigned: "info",
  mechanic_en_route: "info",
  in_service: "info",
  awaiting_quote_approval: "warning",
  awaiting_payment: "warning",
  completed: "success",
  manual_escalation: "danger",
  canceled: "neutral",
  recovery_canceled: "neutral",
  // Assignments
  accepted: "info",
  en_route: "info",
  on_site: "info",
  diagnosis: "info",
  quoted: "warning",
  // Delivery
  processed: "success",
  dead_letter: "danger",
  abandoned: "neutral",
  failed: "danger",
  sent: "success",
  processing: "info",
  // Quotes
  approved: "success",
  voided: "neutral",
  expired: "neutral",
  superseded: "neutral",
  // Reminders
  queued: "info",
  due: "warning",
  dismissed: "neutral",
  // Health probes
  ok: "success",
  ready: "success",
  not_ready: "danger",
  up: "success",
  configured: "success",
  disabled: "neutral",
  down: "danger",
  invalid: "danger"
};

/** Vietnamese labels for the status values the admin UI shows most often. */
const STATUS_LABELS: Record<string, string> = {
  active: "Hoạt động",
  suspended: "Đình chỉ",
  archived: "Lưu trữ",
  banned: "Cấm",
  pending: "Chờ xử lý",
  rejected: "Từ chối",
  fresh: "Mới",
  stale: "Cũ",
  missing: "Thiếu",
  idle: "Rảnh",
  active_assignment: "Đang có việc",
  submitted: "Đã gửi",
  dispatching: "Đang điều phối",
  offered: "Đã gửi đề nghị",
  assigned: "Đã phân công",
  mechanic_en_route: "Kỹ thuật viên đang đến",
  in_service: "Đang sửa",
  awaiting_quote_approval: "Chờ duyệt báo giá",
  awaiting_payment: "Chờ thanh toán",
  completed: "Hoàn thành",
  manual_escalation: "Cần can thiệp",
  canceled: "Đã huỷ",
  recovery_canceled: "Đã huỷ (khôi phục)",
  accepted: "Đã nhận",
  en_route: "Đang đến",
  on_site: "Đã tới nơi",
  diagnosis: "Đang chẩn đoán",
  quoted: "Đã báo giá",
  processed: "Đã xử lý",
  dead_letter: "Chết",
  abandoned: "Đã huỷ bỏ",
  failed: "Lỗi",
  sent: "Đã gửi",
  processing: "Đang xử lý",
  approved: "Đã duyệt",
  voided: "Vô hiệu",
  expired: "Hết hạn",
  superseded: "Bị thay thế",
  queued: "Đã xếp",
  due: "Đến hạn",
  dismissed: "Đã bỏ qua"
};

/** Resolves a tone for any status string, including unknown ones. */
export function toneForStatus(status: string): Tone {
  const known = STATUS_TONES[status];
  if (known) {
    return known;
  }
  if (status.startsWith("manual_") || status.includes("fail")) {
    return "danger";
  }
  if (status.startsWith("awaiting_") || status.startsWith("pending")) {
    return "warning";
  }
  if (status.endsWith("ed") || status.startsWith("completed")) {
    return "success";
  }
  return "neutral";
}

/** The Vietnamese label of a status, falling back to the raw value. */
export function labelForStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function StatusBadge({
  status,
  tone,
  label
}: {
  status: string;
  tone?: Tone;
  label?: string;
}) {
  const resolved = tone ?? toneForStatus(status);
  const styles = TONE_STYLES[resolved];

  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: styles.background, color: styles.color }}
    >
      {label ?? labelForStatus(status)}
    </span>
  );
}

/** A boolean flag rendered as a coloured badge ("Có" / "Không"). */
export function BooleanBadge({
  value,
  trueLabel = "Có",
  falseLabel = "Không",
  trueTone = "success",
  falseTone = "neutral"
}: {
  value: boolean;
  trueLabel?: string;
  falseLabel?: string;
  trueTone?: Tone;
  falseTone?: Tone;
}) {
  const styles = TONE_STYLES[value ? trueTone : falseTone];
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: styles.background, color: styles.color }}
    >
      {value ? trueLabel : falseLabel}
    </span>
  );
}

/** A small key/value tile used across the detail pages. */
export function DetailField({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#3d4d63" }}>
        {label}
      </span>
      <span className="text-sm" style={{ color: "#162130" }}>
        {children}
      </span>
    </div>
  );
}
