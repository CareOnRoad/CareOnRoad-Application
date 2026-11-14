/**
 * Helper thuần cho việc khoá tính năng theo gói (free / advance / vip).
 *
 * Quy tắc khớp backend:
 *  - `apps/api/src/features/plans/plan.ts` → `hasPlan(current, required)`.
 *  - Thiếu gói → HTTP 403 `FORBIDDEN` + `details.reason = "plan_required"`
 *    + `details.required_plan = "advance" | "vip"` (D15 trong
 *    `apps/api/VEHICLE-MAINTENANCE-PLANS-DESIGN.md`).
 *
 * Lưu ý quan trọng (D7): khi gói hết hạn / bị hạ, backend KHÔNG xoá và
 * KHÔNG ẩn dữ liệu đã lưu — chỉ khoá thêm/sửa. Vì vậy UI phải luôn hiển thị
 * dữ liệu cũ, chỉ disable phần nhập giá trị mới.
 */
import { ApiError } from '@/lib/api';
import type { PlanCode } from '@/lib/auth-types';

/** Gói trả phí (gói free không bao giờ là yêu cầu hợp lệ). */
export type PaidPlanCode = 'advance' | 'vip';

/**
 * Thứ hạng gói: free < advance < vip.
 *
 * Khớp `planRank` trong `apps/mobile/src/lib/subscriptions-service.ts`
 * (và `comparePlans` của backend).
 */
export function planRank(code: PlanCode | null | undefined): number {
  switch (code) {
    case 'vip':
      return 2;
    case 'advance':
      return 1;
    default:
      return 0;
  }
}

/**
 * Gói hiện tại có đủ quyền của gói `required` không?
 *
 * Gói `vip` có đủ quyền của `advance` (D4: gói cao có đủ quyền gói thấp).
 */
export function planSatisfies(
  current: PlanCode | null | undefined,
  required: PaidPlanCode,
): boolean {
  return planRank(current) >= planRank(required);
}

/** Gói hiện tại có đủ quyền `advance` không. */
export function hasAdvancePlan(current: PlanCode | null | undefined): boolean {
  return planSatisfies(current, 'advance');
}

/** Gói hiện tại có đủ quyền `vip` không. */
export function hasVipPlan(current: PlanCode | null | undefined): boolean {
  return planSatisfies(current, 'vip');
}

/** Chi tiết lỗi `plan_required` mà backend trả về. */
export type PlanRequiredDetails = {
  reason: 'plan_required';
  required_plan: PaidPlanCode;
};

/**
 * Lỗi này có phải do thiếu gói không?
 *
 * Backend trả `403` với body phẳng
 * `{ error_code, message, details }` — `details.reason` là `plan_required`.
 */
export function isPlanRequiredError(error: unknown): boolean {
  return planRequiredOf(error) !== null;
}

/**
 * Lấy gói cần thiết từ lỗi `plan_required`, hoặc `null` nếu không phải lỗi đó.
 */
export function planRequiredOf(error: unknown): PaidPlanCode | null {
  if (!(error instanceof ApiError)) return null;
  if (error.status !== 403) return null;
  const details = error.details as Partial<PlanRequiredDetails> | undefined;
  if (!details || details.reason !== 'plan_required') return null;
  if (details.required_plan !== 'advance' && details.required_plan !== 'vip') {
    return null;
  }
  return details.required_plan;
}

/**
 * Message tiếng Việt cho lỗi thiếu gói, dùng chung cho mọi màn hình.
 *
 * `required` là gói backend yêu cầu; nếu không xác định thì mặc định `advance`.
 */
export function planRequiredMessage(required: PaidPlanCode): string {
  return required === 'vip'
    ? 'Tính năng này cần gói VIP. Hãy nâng cấp để sử dụng.'
    : 'Tính năng này cần gói Advance. Hãy nâng cấp để sử dụng.';
}

/**
 * Message tiếng Việt cho một lỗi bất kỳ, ưu tiên message của `plan_required`.
 *
 * Trả `null` nếu lỗi không phải do thiếu gói (caller tự xử lý).
 */
export function planRequiredMessageFor(error: unknown): string | null {
  const required = planRequiredOf(error);
  if (!required) return null;
  return planRequiredMessage(required);
}
