/**
 * Service wrappers cho payment orders (rider-owned, payOS/VietQR).
 *
 *  - POST /api/v1/payments/orders                       - tạo payment order (idempotent)
 *  - GET  /api/v1/payments/orders/{id}                  - read
 *  - POST /api/v1/payments/orders/{id}/cancel           - huỷ
 *  - GET  /api/v1/payments/orders/{id}/status           - lightweight polling endpoint
 *
 * BE trả về QR string và link checkout khi payOS tạo order thành công.
 * Status machine:
 *   pending → paid | canceled | failed | expired
 */
import { apiGet, apiPost } from '@/lib/api';
import { newIdempotencyKey } from '@/lib/idempotency';

export type PaymentStatus = 'pending' | 'paid' | 'canceled' | 'failed' | 'expired';

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
  paid_at?: string;
  canceled_at?: string;
}

export interface CreatePaymentOrderInput {
  quote_id: string;
}

export async function createPaymentOrder(quoteId: string): Promise<PaymentOrder> {
  return apiPost<PaymentOrder>(
    '/api/v1/payments/orders',
    { quote_id: quoteId },
    { headers: { 'X-Idempotency-Key': newIdempotencyKey() } },
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
    case 'pending':
      return 'Chờ thanh toán';
    case 'paid':
      return 'Đã thanh toán';
    case 'canceled':
      return 'Đã huỷ';
    case 'failed':
      return 'Thất bại';
    case 'expired':
      return 'Hết hạn';
    default:
      return s;
  }
}

export function isFinalStatus(s: PaymentStatus): boolean {
  return s === 'paid' || s === 'canceled' || s === 'failed' || s === 'expired';
}
