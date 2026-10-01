/**
 * Service wrappers cho quote APIs (rider decision flow).
 *
 *  - GET  /api/v1/service-requests/{id}/quotes - list versions
 *  - POST /api/v1/quotes/{id}/approve          - duyệt → awaiting_payment
 *  - POST /api/v1/quotes/{id}/reject           - từ chối (optional reason)
 */
import { apiGet, apiPost } from '@/lib/api';

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

export async function approveQuote(quoteId: string): Promise<Quote> {
  return apiPost<Quote>(`/api/v1/quotes/${encodeURIComponent(quoteId)}/approve`, {});
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

export function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + '₫';
}
