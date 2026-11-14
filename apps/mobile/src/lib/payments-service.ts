/**
 * Service wrappers cho payment orders (rider-owned, payOS/VietQR).
 *
 *  - POST /api/v1/payments/orders                       - tạo payment order (idempotent)
 *  - GET  /api/v1/payments/orders/{id}                  - read
 *  - POST /api/v1/payments/orders/{id}/cancel           - huỷ
 *  - GET  /api/v1/service-requests/{id}/payment-summary - tổng hợp đã trả / còn trả
 *
 * BE trả về QR string và link checkout khi payOS tạo order thành công.
 *
 * Status machine (PHẢI khớp `PaymentOrderStatus` của BE trong
 * `apps/api/src/features/payments/payment.service.ts`):
 *   created → pending → succeeded | failed | canceled
 *   pending → needs_review (admin xem xét khi chênh lệch tiền/đơn vị)
 *
 * Lưu ý: BE dùng `succeeded` (KHÔNG phải `paid`) và trả field
 * `succeeded_at` (KHÔNG phải `paid_at`). FE sai tên ở đây sẽ khiến màn
 * "thanh toán thành công" không bao giờ hiển thị.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { apiGet, apiPost } from '@/lib/api';
import { newIdempotencyKey } from '@/lib/idempotency';

export type PaymentStatus =
  | 'created'
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'needs_review';

export interface PaymentOrder {
  id: string;
  quote_id: string;
  request_id: string;
  rider_id: string;
  status: PaymentStatus;
  amount: number;
  currency: 'VND';
  description?: string;
  qr_code?: string;
  qr_url?: string;
  checkout_url?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
  /** BE trả `succeeded_at` khi payment thành công. */
  succeeded_at?: string;
  canceled_at?: string;
  failure_code?: string;
  review_reason?: string;
}

export interface CreatePaymentOrderInput {
  quote_id: string;
}

/**
 * Tổng hợp thanh toán của 1 service-request.
 * Mirror response BE của `GET /api/v1/service-requests/{id}/payment-summary`.
 */
export interface PaymentSummary {
  request_id: string;
  assignment_id: string;
  /** Quote đang dùng để tính tổng (approved work quote hoặc labor quote). */
  quote_id: string;
  /** Quote tiền công (cứu hộ / bảo dưỡng) nếu có. */
  labor_quote_id?: string;
  /** Quote đang chờ rider duyệt (nếu có). */
  pending_quote_id?: string;
  /**
   * Thời điểm thanh toán:
   *  - `labor_upfront` : trả tiền công trước khi thợ đi.
   *  - `after_repair`  : trả sau khi sửa xong (cứu hộ).
   *  - `after_service` : trả sau khi dịch vụ xong (bảo dưỡng).
   */
  payment_timing?: 'labor_upfront' | 'after_repair' | 'after_service';
  currency: 'VND';
  labor_amount: number;
  parts_amount: number;
  other_amount: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  quote_status: string;
  assignment_status: string;
}

export async function createPaymentOrder(quoteId: string): Promise<PaymentOrder> {
  return apiPost<PaymentOrder>(
    '/api/v1/payments/orders',
    { quote_id: quoteId },
    { headers: { 'X-Idempotency-Key': newIdempotencyKey() } },
  );
}

export async function getPaymentSummary(requestId: string): Promise<PaymentSummary> {
  return apiGet<PaymentSummary>(
    `/api/v1/service-requests/${encodeURIComponent(requestId)}/payment-summary`,
  );
}

export async function getPaymentOrder(id: string): Promise<PaymentOrder> {
  return apiGet<PaymentOrder>(`/api/v1/payments/orders/${encodeURIComponent(id)}`);
}

export async function cancelPaymentOrder(id: string): Promise<PaymentOrder> {
  return apiPost<PaymentOrder>(`/api/v1/payments/orders/${encodeURIComponent(id)}/cancel`, {});
}

export function statusLabel(s: PaymentStatus): string {
  switch (s) {
    case 'created':
      return 'Đang tạo';
    case 'pending':
      return 'Chờ thanh toán';
    case 'succeeded':
      return 'Đã thanh toán';
    case 'canceled':
      return 'Đã huỷ';
    case 'failed':
      return 'Thất bại';
    case 'needs_review':
      return 'Cần xem xét';
    default:
      return s;
  }
}

/** Status không còn thay đổi nữa → app không cần poll tiếp. */
export function isFinalStatus(s: PaymentStatus): boolean {
  return s === 'succeeded' || s === 'canceled' || s === 'failed';
}

/** Đơn đang chờ provider xác nhận → app nên poll tiếp. */
export function isPendingStatus(s: PaymentStatus): boolean {
  return s === 'created' || s === 'pending';
}

// ===========================================================================
// Session recovery: nhớ payment order theo quote để reload không bị 409
// ===========================================================================

/**
 * Key lưu map `{ [quoteId]: paymentOrderId }`.
 *
 * Vì sao cần:
 *  - BE dedup payment theo `quote_id` (`findActiveByQuoteForUpdate`) và chặn
 *    tạo đơn mới khi quote đã có đơn `succeeded` (409 "This quote has already
 *    been paid.").
 *  - Nếu mobile mỗi lần mount màn thanh toán đều `POST` tạo đơn mới →
 *    sau khi đã trả xong, reload trang sẽ nhận 409 và hiện banner lỗi thay
 *    vì màn "thành công".
 *  - Lưu `orderId` xuống AsyncStorage → khi mount, `GET` lại đơn cũ trước,
 *    biết đơn đã `succeeded` thì hiện màn success, không gọi `POST`.
 */
export const PAYMENT_ORDER_STORAGE_KEY = '@careonroad/rider/payment_orders';

type PaymentOrderRefMap = Record<string, string>;

async function readPaymentOrderRefMap(): Promise<PaymentOrderRefMap> {
  try {
    const raw = await AsyncStorage.getItem(PAYMENT_ORDER_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: PaymentOrderRefMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof k === 'string' && typeof v === 'string' && v.length > 0) out[k] = v;
    }
    return out;
  } catch {
    // JSON hỏng / AsyncStorage lỗi → coi như không có ref.
    return {};
  }
}

async function writePaymentOrderRefMap(map: PaymentOrderRefMap): Promise<void> {
  try {
    await AsyncStorage.setItem(PAYMENT_ORDER_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Best-effort: mất ref thì màn payment fallback sang POST (vẫn an toàn
    // vì BE chặn double-charge).
  }
}

/** Lưu `orderId` của quote để lần sau mount có thể `GET` lại thay vì `POST`. */
export async function savePaymentOrderRef(quoteId: string, orderId: string): Promise<void> {
  if (!quoteId || !orderId) return;
  const map = await readPaymentOrderRefMap();
  map[quoteId] = orderId;
  await writePaymentOrderRefMap(map);
}

/** Đọc `orderId` đã lưu của quote (null nếu chưa có). */
export async function readPaymentOrderRef(quoteId: string): Promise<string | null> {
  if (!quoteId) return null;
  const map = await readPaymentOrderRefMap();
  return map[quoteId] ?? null;
}

/**
 * Xoá ref của quote.
 *
 * Gọi khi đơn đã chốt (`succeeded` / `canceled`) để không rò rỉ storage.
 * KHÔNG xoá khi `failed` — nhánh retry cần `order.id` để huỷ.
 */
export async function removePaymentOrderRef(quoteId: string): Promise<void> {
  if (!quoteId) return;
  const map = await readPaymentOrderRefMap();
  if (!(quoteId in map)) return;
  delete map[quoteId];
  await writePaymentOrderRefMap(map);
}

// ===========================================================================
// Retry decision — helper thuần để test được
// ===========================================================================

/**
 * Quyết định app nên làm gì với 1 payment order ở trạng thái terminal.
 *
 * - `retryable`   : đơn `failed` → rider được phép huỷ đơn cũ và tạo đơn mới.
 * - `needs_support`: đơn `needs_review` → admin phải xem xét, không tự retry.
 * - `already_paid`: đơn `succeeded` (hoặc trạng thái lạ) → hiện màn thành công.
 */
export function paymentRetryDecision(order: Pick<PaymentOrder, 'status'>):
  | 'retryable'
  | 'already_paid'
  | 'needs_support' {
  if (order.status === 'failed') return 'retryable';
  if (order.status === 'needs_review') return 'needs_support';
  return 'already_paid';
}

/** Message thân thiện cho `failure_code` của BE. */
export function failureCodeLabel(code?: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case 'EXPIRED':
      return 'Liên kết thanh toán đã hết hạn';
    case 'CANCELED':
      return 'Đơn thanh toán đã bị huỷ';
    case 'TIMEOUT':
      return 'Thanh toán quá thời gian cho phép';
    default:
      return code;
  }
}
