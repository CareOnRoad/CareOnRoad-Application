/**
 * Service wrappers cho mechanic quote submission.
 *
 *  - POST /api/v1/service-requests/{id}/quotes - tạo/sửa quote version mới
 *    (BE yêu cầu `X-Idempotency-Key`).
 *
 * Quote các `purpose` đặc biệt (`rescue_labor`, `rescue_final`, `maintenance_labor`,
 * `maintenance_work`) có validation riêng ở BE - xem
 * `apps/api/src/features/quotes/quote.schemas.ts`. Wrapper này mặc định
 * `purpose: 'standard'` cho luồng mechanic tạo báo giá thường.
 *
 * BE tự động đẩy assignment → `quoted` và request → `awaiting_quote_approval`
 * khi quote version đầu tiên được tạo thành công. Các version tiếp theo
 * (revisions) yêu cầu assignment đã ở `quoted` và request ở `awaiting_quote_approval`.
 */
import { apiPost } from '@/lib/api';
import { newIdempotencyKey } from '@/lib/idempotency';
import type { Quote } from '@/lib/quotes-service';

/**
 * Loại báo giá - mirror BE `QuotePurpose` trong `quote.schemas.ts`.
 *
 *  - `standard`           : sửa chữa thường (labor + parts + other)
 *  - `rescue_labor`       : cứu hộ - tiền công trước khi đi (auto-calculated by BE)
 *  - `rescue_final`       : cứu hộ - parts phát sinh sau khi đã sửa
 *  - `maintenance_labor`  : bảo dưỡng - tiền công cố định
 *  - `maintenance_work`   : bảo dưỡng - vật tư + phát sinh
 */
export type QuotePurpose =
  | 'standard'
  | 'rescue_labor'
  | 'rescue_final'
  | 'maintenance_labor'
  | 'maintenance_work';

export interface QuoteLineInput {
  line_type: 'labor' | 'part' | 'other';
  description: string;
  quantity: number;
  unit_amount: number;
}

export interface SubmitQuoteInput {
  /** UUID của assignment (mechanic đang assigned). */
  assignment_id: string;
  /** UUID của diagnosis record (optional, khuyến nghị cho standard). */
  diagnosis_id?: string;
  purpose?: QuotePurpose;
  /** Danh sách line items (bắt buộc cho `standard`, cấm cho `rescue_labor`). */
  lines: QuoteLineInput[];
  /** Giảm giá (mặc định 0, cấm cho `rescue_*` / `maintenance_*`). */
  discount_amount?: number;
  notes?: string;
  /** ISO datetime có offset, vd "2026-10-02T10:00:00+07:00". */
  expires_at?: string;
  /** Dùng cho `maintenance_work` additions - trỏ tới quote đã approved. */
  basis_quote_id?: string;
}

export interface SubmitQuoteResponse {
  quote: Quote;
}

/**
 * Submit báo giá mới (hoặc revision) cho service request.
 *
 * @throws ApiError 400 nếu input invalid, 409 nếu state machine không hợp lệ,
 *         403 nếu không phải assigned mechanic, 404 nếu request/assignment không tồn tại.
 */
export async function submitQuote(
  requestId: string,
  input: SubmitQuoteInput,
): Promise<Quote> {
  const body = {
    assignment_id: input.assignment_id,
    ...(input.diagnosis_id ? { diagnosis_id: input.diagnosis_id } : {}),
    purpose: input.purpose ?? 'standard',
    lines: input.lines,
    ...(input.discount_amount !== undefined
      ? { discount_amount: input.discount_amount }
      : {}),
    ...(input.notes ? { notes: input.notes } : {}),
    ...(input.expires_at ? { expires_at: input.expires_at } : {}),
    ...(input.basis_quote_id ? { basis_quote_id: input.basis_quote_id } : {}),
  };
  const res = await apiPost<Quote | { quote: Quote }>(
    `/api/v1/service-requests/${encodeURIComponent(requestId)}/quotes`,
    body,
    {
      headers: {
        'X-Idempotency-Key': newIdempotencyKey(),
      },
    },
  );
  // Một số version BE wrap trong `{ quote }`, một số trả thẳng.
  if (res && typeof res === 'object' && 'quote' in res && (res as { quote: Quote }).quote) {
    return (res as { quote: Quote }).quote;
  }
  return res as Quote;
}

/**
 * Tính tổng tiền hàng (subtotal) từ các line items UI.
 * Helper dùng cho live preview trong form tạo báo giá.
 */
export function calculateSubtotal(lines: readonly QuoteLineInput[]): number {
  let sum = 0;
  for (const line of lines) {
    const qty = Number.isFinite(line.quantity) ? line.quantity : 0;
    const amount = Number.isFinite(line.unit_amount) ? line.unit_amount : 0;
    sum += Math.round(qty * amount);
  }
  return sum;
}

/**
 * Map serviceType của request → quote purpose phù hợp.
 * Dùng để auto-fill `purpose` khi mechanic tạo báo giá.
 */
export function suggestPurposeForServiceType(
  serviceType: string | null | undefined,
): QuotePurpose {
  if (serviceType === 'emergency_rescue') return 'rescue_final';
  if (serviceType === 'periodic_maintenance') return 'maintenance_work';
  return 'standard';
}

/**
 * Re-export `QuoteLine` từ quotes-service để caller chỉ cần import 1 chỗ.
 */
export type { Quote, QuoteLine } from '@/lib/quotes-service';
