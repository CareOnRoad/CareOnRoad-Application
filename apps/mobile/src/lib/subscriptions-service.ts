/**
 * Service wrappers cho gói rider (self-service plan subscription).
 *
 *  - GET  /api/v1/plans                              - catalog gói + điều khoản
 *  - GET  /api/v1/subscription                       - gói hiện tại + lịch sử
 *  - POST /api/v1/subscription/orders                - tạo đơn (idempotent)
 *  - GET  /api/v1/subscription/orders/{id}           - polling trạng thái
 *  - POST /api/v1/subscription/orders/{id}/cancel    - huỷ đơn
 *
 * Mọi gói trả phí đều tính theo chu kỳ 30 ngày. Gói đã mua không hoàn tiền,
 * nên UI bắt buộc người dùng tick xác nhận trước khi gọi `createSubscriptionOrder`.
 */
import { apiGet, apiPost } from '@/lib/api';
import { isAllowedReturnUrl } from '@/lib/deep-link';
import { newIdempotencyKey } from '@/lib/idempotency';
import type { PlanCode } from '@/lib/auth-types';

export type { PlanCode };

export type SubscriptionOrderStatus =
  | 'created'
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'expired';

export interface PlanCatalogEntry {
  code: PlanCode;
  name: string;
  tagline: string;
  price: number;
  currency: 'VND';
  period_days: number;
  purchasable: boolean;
  features: string[];
  note?: string;
}

export interface PlanCatalogResponse {
  plans: PlanCatalogEntry[];
  non_refundable: true;
  non_refundable_notice: string;
}

export interface SubscriptionOrder {
  id: string;
  user_id: string;
  plan_code: Exclude<PlanCode, 'free'>;
  source: 'self_purchase';
  status: SubscriptionOrderStatus;
  currency: 'VND';
  amount: number;
  period_days: number;
  provider_order_code?: number;
  checkout_url?: string;
  qr_code?: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  succeeded_at?: string;
  canceled_at?: string;
}

export interface MySubscription {
  current_plan: PlanCode;
  plan_expires_at?: string;
  active_subscription?: SubscriptionOrder;
  history: SubscriptionOrder[];
}

/** Lấy catalog gói (3 gói: free / advance 10k / vip 50k, chu kỳ 30 ngày). */
export async function getPlanCatalog(): Promise<PlanCatalogResponse> {
  return apiGet<PlanCatalogResponse>('/api/v1/plans');
}

/** Lấy gói hiện tại + lịch sử mua/được cấp. */
export async function getMySubscription(): Promise<MySubscription> {
  return apiGet<MySubscription>('/api/v1/subscription');
}

/**
 * Tạo đơn đăng ký gói.
 *
 * `acknowledgeNonRefundable` phải là `true` — backend từ chối đơn không có
 * xác nhận điều khoản "không hoàn tiền".
 *
 * `returnUrl` / `cancelUrl` là deep-link về app (vd `careonroad://rider/plans`).
 * Khi có, payOS đưa người dùng thẳng về app sau khi thanh toán thay vì mở
 * một trang web trống. Backend chỉ nhận scheme `careonroad`, `exp`, `exps`;
 * URL không hợp lệ bị bỏ qua để backend dùng URL fallback từ env.
 */
export async function createSubscriptionOrder(
  planCode: Exclude<PlanCode, 'free'>,
  acknowledgeNonRefundable = true,
  returnUrl?: string,
  cancelUrl?: string,
): Promise<SubscriptionOrder> {
  const body: Record<string, unknown> = {
    plan_code: planCode,
    non_refundable_acknowledged: acknowledgeNonRefundable,
  };
  if (isAllowedReturnUrl(returnUrl)) {
    body.return_url = returnUrl.trim();
  }
  if (isAllowedReturnUrl(cancelUrl)) {
    body.cancel_url = cancelUrl.trim();
  }
  return apiPost<SubscriptionOrder>(
    '/api/v1/subscription/orders',
    body,
    { headers: { 'X-Idempotency-Key': newIdempotencyKey() } },
  );
}

/** Polling trạng thái đơn (dùng trên màn hình QR thanh toán). */
export async function getSubscriptionOrder(id: string): Promise<SubscriptionOrder> {
  return apiGet<SubscriptionOrder>(
    `/api/v1/subscription/orders/${encodeURIComponent(id)}`,
  );
}

/** Huỷ đơn đang chờ thanh toán. */
export async function cancelSubscriptionOrder(id: string): Promise<SubscriptionOrder> {
  return apiPost<SubscriptionOrder>(
    `/api/v1/subscription/orders/${encodeURIComponent(id)}/cancel`,
    {},
  );
}

/** Tên gói hiển thị. */
export function planLabel(code?: PlanCode | null): string {
  switch (code) {
    case 'vip':
      return 'VIP';
    case 'advance':
      return 'Advance';
    case 'free':
      return 'Free';
    default:
      return 'Free';
  }
}

/**
 * Thứ hạng gói: free < advance < vip.
 *
 * Khớp với `comparePlans` của backend
 * (`apps/api/src/features/plans/plan.ts`).
 */
export function planRank(code?: PlanCode | null): number {
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
 * Quyết định người dùng có thể mua gói `target` khi đang dùng `current` hay không.
 *
 * Quy tắc (khớp backend `createSubscriptionOrder`):
 *  - Gói thấp hơn gói hiện tại → bị chặn (hạ cấp) → `downgrade`.
 *  - Gói bằng gói hiện tại → gia hạn (số ngày còn dư được cộng dồn).
 *  - Gói cao hơn → nâng cấp.
 *
 * Gói `free` không mua được.
 */
export type PlanPurchaseDecision =
  | 'purchase'
  | 'renewal'
  | 'upgrade'
  | 'downgrade'
  | 'not_purchasable';

export function planPurchaseDecision(
  currentPlan: PlanCode,
  targetPlan: PlanCode,
): PlanPurchaseDecision {
  if (targetPlan === 'free') return 'not_purchasable';
  const currentRank = planRank(currentPlan);
  const targetRank = planRank(targetPlan);
  if (targetRank < currentRank) return 'downgrade';
  if (targetRank === currentRank) return 'renewal';
  return currentRank === 0 ? 'purchase' : 'upgrade';
}

/** Giá gói dạng tiếng Việt. */
export function planPriceLabel(price: number): string {
  if (!price) return 'Miễn phí';
  return `${price.toLocaleString('vi-VN')} đ`;
}

/** Trạng thái đơn dạng tiếng Việt. */
export function planStatusLabel(status: SubscriptionOrderStatus): string {
  switch (status) {
    case 'created':
      return 'Đang tạo';
    case 'pending':
      return 'Chờ thanh toán';
    case 'succeeded':
      return 'Đã thanh toán';
    case 'failed':
      return 'Thanh toán thất bại';
    case 'canceled':
      return 'Đã huỷ';
    case 'expired':
      return 'Đã hết hạn';
    default:
      return 'Không rõ';
  }
}

/** Định dạng ngày hết hạn dạng dd/MM/yyyy. */
export function formatPlanExpiry(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}
