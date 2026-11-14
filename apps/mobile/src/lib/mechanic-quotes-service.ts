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
  /**
   * Bảng giá công cứu hộ (bắt buộc khi `purpose === 'rescue_labor'`).
   *
   * BE tự tính `distance_m` (theo dispatch distance đã verify) và `time_slot`
   * (theo giờ Việt Nam) — mechanic KHÔNG tự nhập 2 field này.
   */
  labor_pricing?: RescueLaborPricingInput;
}

/** Input `labor_pricing` — mirror BE `quoteInputSchema.labor_pricing`. */
export interface RescueLaborPricingInput {
  /** Tiền công cơ bản (bắt buộc > 0). */
  base_amount: number;
  /** Phí khoảng cách (BE tự tính distance_m). */
  distance_amount: number;
  /** Phí thời tiết. */
  weather_amount: number;
  /** Phí thời điểm (BE tự tính time_slot). */
  time_amount: number;
  /** Thời tiết hiện tại. */
  weather: 'sunny' | 'rain';
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
    ...(input.labor_pricing ? { labor_pricing: input.labor_pricing } : {}),
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
 * Kế hoạch báo giá nhiều bước theo loại dịch vụ + trạng thái assignment.
 *
 * BE áp workflow khác nhau cho từng loại việc:
 *
 *  - `emergency_rescue` (cứu hộ):
 *    1. `rescue_labor`   — khi assignment `accepted` (trước khi đi, rider phải
 *       duyệt kèm `payment_timing`). Bắt buộc có `labor_pricing`.
 *    2. `rescue_final`   — khi assignment `diagnosis` (parts-only; BE tự cộng
 *       phần công đã thống nhất).
 *  - `periodic_maintenance` (bảo dưỡng):
 *    1. `maintenance_labor` — khi assignment `accepted` (công cố định +
 *       phí đi lại; KHÔNG parts).
 *    2. `maintenance_work`  — khi assignment `diagnosis` (parts-only).
 *    3. `maintenance_work`  — khi assignment `in_progress` (phát sinh thêm;
 *       bắt buộc `basis_quote_id` = quote work đã approved).
 *  - còn lại: `standard` (labor + parts + other).
 */
export type QuotePurposePlan = {
  purpose: QuotePurpose;
  /** Form nào cần hiển thị cho mechanic. */
  mode: 'standard' | 'rescue_labor' | 'parts_only';
  /** Quote này là phát sinh thêm (maintenance addition) → cần `basis_quote_id`. */
  isAddition: boolean;
  /** Có được phép nhập `discount_amount` không (BE cấm cho rescue/maintenance). */
  allowDiscount: boolean;
  /** Line types được phép nhập. */
  allowedLineTypes: QuoteLineInput['line_type'][];
  /** Có cần form `labor_pricing` không. */
  requiresLaborPricing: boolean;
  /** Nhãn tiếng Việt hiển thị cho mechanic. */
  label: string;
  /** Gợi ý ngắn cho mechanic về bước này. */
  hint: string;
};

const STANDARD_PLAN: QuotePurposePlan = {
  purpose: 'standard',
  mode: 'standard',
  isAddition: false,
  allowDiscount: true,
  allowedLineTypes: ['labor', 'part', 'other'],
  requiresLaborPricing: false,
  label: 'Sửa chữa thường',
  hint: 'Nhập các hạng mục công việc và phụ tùng cần thiết.',
};

const RESCUE_LABOR_PLAN: QuotePurposePlan = {
  purpose: 'rescue_labor',
  mode: 'rescue_labor',
  isAddition: false,
  allowDiscount: false,
  allowedLineTypes: [],
  requiresLaborPricing: true,
  label: 'Cứu hộ · Tiền công trước',
  hint: 'Thiết lập bảng giá công cứu hộ. Rider sẽ duyệt và chọn trả trước hoặc trả sau.',
};

const RESCUE_FINAL_PLAN: QuotePurposePlan = {
  purpose: 'rescue_final',
  mode: 'parts_only',
  isAddition: false,
  allowDiscount: false,
  allowedLineTypes: ['part'],
  requiresLaborPricing: false,
  label: 'Cứu hộ · Phụ tùng phát sinh',
  hint: 'Chỉ nhập phụ tùng cần thay. Phần công đã thống nhất sẽ được hệ thống tự cộng.',
};

const MAINTENANCE_LABOR_PLAN: QuotePurposePlan = {
  purpose: 'maintenance_labor',
  mode: 'standard',
  isAddition: false,
  allowDiscount: false,
  allowedLineTypes: ['labor', 'other'],
  requiresLaborPricing: false,
  label: 'Bảo dưỡng · Tiền công',
  hint: 'Nhập tiền công bảo dưỡng (không kèm phụ tùng).',
};

const MAINTENANCE_WORK_PLAN: QuotePurposePlan = {
  purpose: 'maintenance_work',
  mode: 'parts_only',
  isAddition: false,
  allowDiscount: false,
  allowedLineTypes: ['part'],
  requiresLaborPricing: false,
  label: 'Bảo dưỡng · Phụ tùng',
  hint: 'Chỉ nhập phụ tùng cần thay. Phần công đã thống nhất sẽ được hệ thống tự cộng.',
};

const MAINTENANCE_ADDITION_PLAN: QuotePurposePlan = {
  purpose: 'maintenance_work',
  mode: 'parts_only',
  isAddition: true,
  allowDiscount: false,
  allowedLineTypes: ['part'],
  requiresLaborPricing: false,
  label: 'Bảo dưỡng · Phát sinh thêm',
  hint: 'Nhập các hạng mục phát sinh thêm trong khi sửa. Hệ thống sẽ gắn vào báo giá đã duyệt.',
};

/**
 * Tính kế hoạch báo giá kế tiếp mà mechanic nên gửi.
 *
 * @param serviceType  `service_type` của service request (BE trả).
 * @param assignmentStatus  Trạng thái assignment hiện tại từ BE (raw).
 * @param _hasApprovedWorkQuote  Đã có quote `maintenance_work` approved chưa.
 *   KHÔNG dùng để chọn plan nữa: BE chỉ cho báo giá PHÁT SINH THÊM khi
 *   assignment = `in_progress` (`quote.service.ts` → `maintenanceAddition`).
 *   Tham số giữ lại để không phá call-site cũ.
 */
export function quotePurposePlanFor(
  serviceType: string | null | undefined,
  assignmentStatus: string | null | undefined,
  _hasApprovedWorkQuote = false,
): QuotePurposePlan {
  if (serviceType === 'emergency_rescue') {
    // Bước 1: chốt giá công trước khi đi (assignment còn `accepted`).
    if (assignmentStatus === 'accepted') return RESCUE_LABOR_PLAN;
    // Bước 2: sau khi tới nơi + chẩn đoán → báo giá phụ tùng phát sinh.
    return RESCUE_FINAL_PLAN;
  }
  if (serviceType === 'periodic_maintenance') {
    if (assignmentStatus === 'accepted') return MAINTENANCE_LABOR_PLAN;
    // Bước phát sinh thêm chỉ hợp lệ khi đang SỬA (`in_progress`) — BE yêu
    // cầu `assignment.status === 'in_progress'` cho quote `maintenance_work`
    // có `basis_quote_id` (`quote.service.ts` → `maintenanceAddition`).
    if (assignmentStatus === 'in_progress') return MAINTENANCE_ADDITION_PLAN;
    // `diagnosis` (lần đầu) hoặc `quoted` (revision) → báo giá vật tư.
    return MAINTENANCE_WORK_PLAN;
  }
  return STANDARD_PLAN;
}

/**
 * Plan hiển thị cho một quote ĐÃ TỒN TẠI (read-only).
 *
 * Khi quote đã có sẵn, không nên dùng `quotePurposePlanFor()` (plan phụ thuộc
 * trạng thái assignment hiện tại) vì plan có thể trỏ sang bước KHÁC —
 * ví dụ cứu hộ: quote `rescue_labor` đã gửi (trạng thái đã sang `quoted`) nhưng
 * `quotePurposePlanFor` lại trả `rescue_final` → nhãn hiển thị sai.
 */
export function quotePlanForPurpose(purpose: QuotePurpose): QuotePurposePlan {
  switch (purpose) {
    case 'rescue_labor':
      return RESCUE_LABOR_PLAN;
    case 'rescue_final':
      return RESCUE_FINAL_PLAN;
    case 'maintenance_labor':
      return MAINTENANCE_LABOR_PLAN;
    case 'maintenance_work':
      return MAINTENANCE_WORK_PLAN;
    default:
      return STANDARD_PLAN;
  }
}

/**
 * Re-export `QuoteLine` từ quotes-service để caller chỉ cần import 1 chỗ.
 */
export type { Quote, QuoteLine } from '@/lib/quotes-service';
