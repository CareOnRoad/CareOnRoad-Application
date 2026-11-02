import "server-only";

import { z } from "zod";

import {
  ApiClientError,
  ApiContractError,
  ApiTimeoutError,
  apiFetch,
  classifyApiError,
  type ApiFailureKind
} from "./server-client";

/**
 * The single entry point for every administrative mutation.
 *
 * Why a runner instead of a `fetch` per action:
 *
 * 1. **Idempotency** — the backend requires an `X-Idempotency-Key` on every
 *    admin mutation and rejects a repeated key with a different payload
 *    (409). The key must therefore be generated ONCE per form instance and
 *    reused on retry, never per click. The `CommandForm` client component
 *    mints it and passes it through a hidden field; the runner only forwards
 *    it.
 * 2. **Validation before the network** — the body is validated against the
 *    shared zod contract first, so an invalid command never reaches the
 *    database and never consumes an idempotency slot.
 * 3. **One error vocabulary** — every failure is mapped to a Vietnamese
 *    message plus a machine-readable `kind`, so pages do not each invent
 *    their own error text.
 *
 * The runner is `server-only`: the access token never leaves the server.
 */

export type AdminCommandResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: ApiFailureKind; code: string; message: string; details?: unknown; requestId?: string };

export type AdminCommandOptions<TBody, TResponse> = {
  /** The admin route path, e.g. `/api/v1/admin/users/${userId}/suspend`. */
  path: string;
  method?: "POST" | "PUT";
  /** The body after zod validation. */
  body: TBody;
  /** The shared contract schema for the body. */
  bodySchema: z.ZodType<TBody>;
  /** The shared contract schema for the response, when the route returns one. */
  responseSchema?: z.ZodType<TResponse>;
  /**
   * The idempotency key. MUST be stable across retries of the same command
   * and MUST NOT be shared between two different commands: the backend scopes
   * idempotency by `(actor, scope, key)`, so the same key under two scopes
   * runs both commands.
   */
  idempotencyKey: string;
  accessToken: string;
};

const MIN_REASON_LENGTH = 10;
const MAX_REASON_LENGTH = 500;

/**
 * Vietnamese messages for the backend `error_code` values an admin can
 * actually trigger. Unknown codes fall back to the backend message so a new
 * backend error is never swallowed.
 */
const CODE_MESSAGES: Record<string, string> = {
  INVALID_INPUT: "Dữ liệu gửi lên không hợp lệ. Vui lòng kiểm tra lại các trường.",
  INVALID_TOKEN: "Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.",
  ACTOR_SUSPENDED: "Tài khoản quản trị đang bị đình chỉ nên không thể thực hiện thao tác này.",
  UNAUTHORIZED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  NOT_FOUND: "Không tìm thấy dữ liệu được yêu cầu.",
  CONFLICT: "Trạng thái hiện tại không cho phép thao tác này.",
  RATE_LIMITED: "Bạn đã thao tác quá nhanh. Vui lòng thử lại sau.",
  INTERNAL_ERROR: "Hệ thống gặp lỗi. Vui lòng thử lại.",
  DATABASE_CONFLICT: "Dữ liệu đang bị thay đổi bởi thao tác khác. Vui lòng tải lại trang.",
  DATABASE_CONSTRAINT_VIOLATION: "Dữ liệu vi phạm ràng buộc của hệ thống.",
  DATABASE_UNAVAILABLE: "Cơ sở dữ liệu tạm thời không khả dụng. Vui lòng thử lại.",
  DATABASE_ERROR: "Không thể đọc hoặc ghi dữ liệu. Vui lòng thử lại.",
  PROVIDER_ERROR: "Nhà cung cấp bên ngoài đang gặp sự cố. Vui lòng thử lại sau.",
  UNEXPECTED_ERROR_BODY: "Máy chủ trả về dữ liệu không mong đợi. Vui lòng thử lại."
};

/**
 * `details.reason` carries the backend's machine-readable conflict code
 * (e.g. `worker_lease_active`, `outbox_not_dead_letter`). Surfacing it is
 * what lets an admin understand WHY a command was refused instead of seeing
 * a generic failure.
 */
const DETAIL_REASON_MESSAGES: Record<string, string> = {
  worker_lease_active: "Một tiến trình nền đang giữ khoá trên bản ghi này. Vui lòng thử lại sau khi tiến trình kết thúc.",
  assignment_exists: "Yêu cầu này đã có kỹ thuật viên được phân công.",
  payment_unresolved: "Yêu cầu này đang có khoản thanh toán chưa xử lý.",
  quote_commitment: "Yêu cầu này đã có báo giá được cam kết.",
  location_required: "Yêu cầu thiếu vị trí cứu hộ nên chưa thể điều phối.",
  appointment_passed: "Thời gian hẹn đã qua nên không thể phân công.",
  mechanic_ineligible: "Kỹ thuật viên không đủ điều kiện nhận việc.",
  rider_or_motorcycle_ineligible: "Người dùng hoặc xe của người dùng không đủ điều kiện.",
  reservation_conflict: "Kỹ thuật viên đã có lịch hẹn khác trong khung giờ này.",
  same_mechanic: "Kỹ thuật viên đang chọn đang phụ trách việc này.",
  assignment_state: "Trạng thái phân công hiện tại không cho phép thao tác này.",
  request_state: "Trạng thái yêu cầu hiện tại không cho phép thao tác này.",
  request_state_not_dispatchable: "Yêu cầu không ở trạng thái có thể điều phối.",
  retry_limit_reached: "Đã đạt giới hạn số lần thử lại.",
  outbox_not_dead_letter: "Sự kiện này không ở trạng thái chết nên không thể thử lại.",
  topic_retry_unsupported: "Loại sự kiện này không hỗ trợ thử lại thủ công.",
  critical_handoff_cannot_abandon: "Sự kiện bàn giao quan trọng không thể huỷ.",
  delivery_state_or_retry_limit: "Trạng thái giao hàng đã thay đổi hoặc đã đạt giới hạn thử lại.",
  worker_lease_active_delivery: "Một tiến trình nền đang giữ khoá trên bản ghi này.",
  notification_terminal: "Thông báo đã ở trạng thái kết thúc nên không thể thao tác.",
  notification_not_retryable: "Thông báo không ở trạng thái có thể thử lại.",
  delivery_already_sent: "Thông báo đã được gửi thành công.",
  delivery_work_pending: "Thông báo đang được giao, vui lòng thử lại sau.",
  delivery_credential_unavailable: "Không tìm thấy thông tin đăng nhập thiết bị để gửi lại.",
  delivery_lease_active: "Một tiến trình nền đang giữ khoá trên bản ghi này.",
  delivery_receipt_limit: "Thông báo có quá nhiều thiết bị nhận nên không thể xử lý thủ công.",
  occurrence_not_failed: "Lần nhắc này không ở trạng thái lỗi nên không thể thử lại.",
  reminder_owner_ineligible: "Chủ xe hoặc xe không đủ điều kiện nhận nhắc hẹn.",
  reminder_retry_blocked: "Lần nhắc không thể thử lại do điều kiện hiện tại.",
  cancellation_conflict: "Trạng thái hiện tại không cho phép huỷ.",
  quote_not_current: "Báo giá này không còn là báo giá mới nhất.",
  diagnosis_issued: "Chẩn đoán này đã phát sinh báo giá nên không thể sửa.",
  diagnosis_state: "Trạng thái chẩn đoán hiện tại không cho phép thao tác này.",
  payment_unresolved_workflow: "Yêu cầu đang có khoản thanh toán chưa xử lý.",
  downgrade_blocked: "Không thể hạ gói khi đang có gói đang hoạt động.",
  idempotency_conflict: "Lệnh này đã được gửi với nội dung khác. Vui lòng tải lại trang."
};

/**
 * Validates the reason length before the request leaves the server.
 *
 * The backend enforces 10–500 characters, but failing here produces an inline
 * form error instead of a round trip and a 400.
 */
export function validateAdminReason(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length < MIN_REASON_LENGTH) {
    return `Lý do phải có ít nhất ${MIN_REASON_LENGTH} ký tự.`;
  }
  if (trimmed.length > MAX_REASON_LENGTH) {
    return `Lý do không được vượt quá ${MAX_REASON_LENGTH} ký tự.`;
  }
  return null;
}

/**
 * Extracts a machine-readable conflict code from the backend error body.
 *
 * The backend puts it in `details.reason` for cancellation conflicts and
 * `details.reason` / `details.code` elsewhere.
 */
function extractDetailReason(details: unknown): string | undefined {
  if (!details || typeof details !== "object") {
    return undefined;
  }
  const record = details as Record<string, unknown>;
  const candidate = record.reason ?? record.code;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : undefined;
}

/**
 * Runs one administrative mutation.
 *
 * Never throws: the caller always receives a discriminated result. That keeps
 * Server Actions free of try/catch noise and lets a page decide whether to
 * show a toast, an inline error, or a redirect.
 */
export async function runAdminCommand<TBody, TResponse = unknown>(
  options: AdminCommandOptions<TBody, TResponse>
): Promise<AdminCommandResult<TResponse>> {
  const parsed = options.bodySchema.safeParse(options.body);

  if (!parsed.success) {
    return {
      ok: false,
      kind: "validation",
      code: "INVALID_INPUT",
      message: "Dữ liệu gửi lên không hợp lệ. Vui lòng kiểm tra lại các trường.",
      details: parsed.error.flatten()
    };
  }

  try {
    const data = await apiFetch<TResponse>(options.path, {
      accessToken: options.accessToken,
      method: options.method ?? "POST",
      body: parsed.data,
      idempotencyKey: options.idempotencyKey,
      // A 204 has no body; the schema is optional for those routes.
      schema: (options.responseSchema ?? z.unknown()) as z.ZodType<TResponse>
    });

    return { ok: true, data };
  } catch (error) {
    return toCommandFailure(error);
  }
}

/**
 * Maps a thrown error to the admin error vocabulary.
 *
 * The order matters: a conflict (409) keeps the backend's specific
 * `details.reason` so the admin sees WHY the command was refused instead of
 * a generic "conflict" message.
 */
export function toCommandFailure(error: unknown): AdminCommandResult<never> {
  if (error instanceof ApiClientError) {
    const detailReason = extractDetailReason(error.details);
    const message = detailReason
      ? (DETAIL_REASON_MESSAGES[detailReason] ?? error.message)
      : (CODE_MESSAGES[error.code] ?? error.message);

    return {
      ok: false,
      kind: classifyApiError(error),
      code: error.code,
      message,
      details: error.details,
      requestId: error.requestId
    };
  }

  if (error instanceof ApiContractError) {
    return {
      ok: false,
      kind: "contract",
      code: "CONTRACT_MISMATCH",
      message:
        "Dữ liệu từ máy chủ không khớp với hợp đồng dữ liệu. Vui lòng báo cho đội kỹ thuật."
    };
  }

  if (error instanceof ApiTimeoutError) {
    return {
      ok: false,
      kind: "server",
      code: "TIMEOUT",
      message: "Máy chủ phản hồi quá thời gian cho phép. Vui lòng thử lại."
    };
  }

  return {
    ok: false,
    kind: "unknown",
    code: "UNKNOWN_ERROR",
    message: "Không thể thực hiện thao tác. Vui lòng thử lại."
  };
}
