/**
 * Service wrappers cho quote APIs (rider decision flow).
 *
 *  - GET  /api/v1/service-requests/{id}/quotes - list versions
 *  - POST /api/v1/quotes/{id}/approve          - duyệt → awaiting_payment
 *  - POST /api/v1/quotes/{id}/reject           - từ chối (optional reason)
 */
import { apiGet, apiPost } from '@/lib/api';
import type { QuotePurpose } from '@/lib/mechanic-quotes-service';

/**
 * Thời điểm thanh toán - mirror BE `payment_timing` trong `quote.schemas.ts`.
 *
 *  - `labor_upfront` : rider trả tiền công cứu hộ TRƯỚC khi thợ đi.
 *  - `after_repair`  : rider trả sau khi sửa xong (chỉ áp cho cứu hộ).
 */
export type PaymentTiming = 'labor_upfront' | 'after_repair';

export interface QuoteLine {
  id: string;
  quote_id: string;
  line_type: 'labor' | 'part' | 'other';
  description: string;
  quantity: number;
  unit_amount: number;
  line_total_amount: number;
  sort_order: number;
}

export interface Quote {
  id: string;
  request_id: string;
  assignment_id: string;
  diagnosis_id?: string;
  version: number;
  status: 'pending' | 'approved' | 'rejected' | 'superseded' | 'expired';
  /**
   * Loại báo giá — mirror BE `QuotePurpose`.
   * `rescue_labor` / `maintenance_labor` : tiền công trước khi đi.
   * `rescue_final` / `maintenance_work`  : vật tư + phát sinh sau khi sửa.
   * `standard`                          : sửa chữa thường.
   */
  purpose?: QuotePurpose;
  /** Bảng giá công cứu hộ (chỉ có ở `purpose === 'rescue_labor'`). */
  labor_pricing?: {
    base_amount: number;
    distance_amount: number;
    distance_m?: number;
    weather_amount: number;
    weather: 'sunny' | 'rain';
    time_amount: number;
    time_slot?: string;
  };
  currency: 'VND';
  subtotal_amount: number;
  discount_amount: number;
  total_amount: number;
  notes?: string;
  expires_at?: string;
  created_by: string;
  created_at: string;
  responded_at?: string;
  lines: QuoteLine[];
}

export async function listQuotesForRequest(requestId: string): Promise<Quote[]> {
  // Một số version trả về `{ items: Quote[] }`, một số trả về `Quote[]` trực tiếp.
  const res = await apiGet<{ items?: Quote[] } | Quote[]>(
    `/api/v1/service-requests/${encodeURIComponent(requestId)}/quotes`,
  );
  if (Array.isArray(res)) return res;
  return res.items ?? [];
}

/**
 * Duyệt báo giá.
 *
 * `payment_timing` chỉ bắt buộc với `purpose === 'rescue_labor'` (BE trả 400
 * nếu thiếu). BE trả 400 luôn nếu truyền `payment_timing` cho quote khác.
 */
export async function approveQuote(
  quoteId: string,
  input?: { payment_timing?: PaymentTiming },
): Promise<Quote> {
  return apiPost<Quote>(
    `/api/v1/quotes/${encodeURIComponent(quoteId)}/approve`,
    input?.payment_timing ? { payment_timing: input.payment_timing } : {},
  );
}

export async function rejectQuote(quoteId: string, reason?: string): Promise<Quote> {
  return apiPost<Quote>(
    `/api/v1/quotes/${encodeURIComponent(quoteId)}/reject`,
    reason ? { reason } : {},
  );
}

/**
 * Lấy quote pending mới nhất cho 1 service-request.
 * Trả về `null` nếu không có pending quote (đã approved / rejected / không có).
 */
export async function getLatestPendingQuote(requestId: string): Promise<Quote | null> {
  const all = await listQuotesForRequest(requestId);
  const pending = all.filter((q) => q.status === 'pending');
  if (pending.length === 0) return null;
  pending.sort((a, b) => b.version - a.version);
  return pending[0];
}

/**
 * Bundle quote của 1 service-request trong MỘT request mạng.
 *
 * - `pending`  : quote đang chờ rider duyệt (version cao nhất).
 * - `approved` : quote đã được rider duyệt (version cao nhất) — dùng để
 *                hiển thị tổng tiền đã chốt và nút "Thanh toán ngay" sau khi
 *                duyệt (khi đó không còn quote pending nào).
 */
export async function getQuoteBundle(requestId: string): Promise<{
  pending: Quote | null;
  approved: Quote | null;
}> {
  const all = await listQuotesForRequest(requestId);
  return selectQuoteBundle(all);
}

/**
 * Tách pending/approved từ danh sách quote (thuần, không network).
 * Tách riêng để test được và dùng chung cho nhiều nơi.
 */
export function selectQuoteBundle(all: readonly Quote[]): {
  pending: Quote | null;
  approved: Quote | null;
} {
  const byVersionDesc = (a: Quote, b: Quote) => b.version - a.version;
  const pending = all.filter((q) => q.status === 'pending').sort(byVersionDesc);
  const approved = all.filter((q) => q.status === 'approved').sort(byVersionDesc);
  return {
    pending: pending[0] ?? null,
    approved: approved[0] ?? null,
  };
}

/**
 * Quote `rescue_labor` bắt buộc rider chọn thời điểm thanh toán.
 *
 * BE trả 400 nếu approve quote `rescue_labor` mà không có `payment_timing`,
 * và 400 nếu truyền `payment_timing` cho quote thường.
 */
export function requiresPaymentTiming(
  quote: Pick<Quote, 'purpose'> | null | undefined,
): boolean {
  return quote?.purpose === 'rescue_labor';
}

/**
 * Quote có thể thanh toán NGAY BÂY GIỜ không.
 *
 * Mirror điều kiện của BE (`payment.service.ts` → `createPaymentOrder`):
 *  - `maintenance_labor` → KHÔNG bao giờ payable (tiền công bảo dưỡng được
 *    gộp vào báo giá vật tư `maintenance_work` sau).
 *  - `rescue_labor` → chỉ payable khi rider chọn `labor_upfront`
 *    (BE trả 409 "Quote is not payable." nếu timing là `after_repair`).
 *  - `rescue_final` / `maintenance_work` / `standard` → payable khi assignment
 *    đã chuyển `awaiting_payment` (BE trả 409 nếu chưa).
 *
 * `assignmentStatus` lấy từ BE `payment-summary.assignment_status`.
 */
export function isQuotePayableNow(
  quote: Pick<Quote, 'purpose' | 'status'> | null | undefined,
  options: {
    paymentTiming?: 'labor_upfront' | 'after_repair' | 'after_service' | null;
    assignmentStatus?: string | null;
  } = {},
): boolean {
  if (!quote || quote.status !== 'approved') return false;
  const purpose = quote.purpose ?? 'standard';
  if (purpose === 'maintenance_labor') return false;
  if (purpose === 'rescue_labor') {
    return options.paymentTiming === 'labor_upfront' && options.assignmentStatus === 'accepted';
  }
  return options.assignmentStatus === 'awaiting_payment';
}

export function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + '₫';
}
