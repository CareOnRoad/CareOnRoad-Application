/**
 * Service wrappers cho /api/v1/dispatch (mechanic offer visibility).
 *
 *  - GET  /api/v1/dispatch/offers                  - danh sách offers cho thợ hiện tại
 *  - POST /api/v1/dispatch/offers/{id}/accept      - atomic accept → tạo assignment
 *  - POST /api/v1/dispatch/offers/{id}/decline     - từ chối offer
 *
 * Accept được BE chuyển tiếp sang AcceptAssignmentService (atomic).
 */
import { apiGet, apiPost } from '@/lib/api';
import { newIdempotencyKey } from '@/lib/idempotency';
import type { AssignmentResponse } from '@/lib/mechanic-jobs-service';

export type DispatchCandidateStatus =
  | 'pending'
  | 'offered'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'cancelled';

export type DispatchRoundStatus = 'active' | 'accepted' | 'expired' | 'canceled';

export interface DispatchOffer {
  id: string;
  round_id: string;
  request_id: string;
  mechanic_id: string;
  rank: number;
  distance_m?: number;
  status: DispatchCandidateStatus;
  expires_at?: string;
}

export interface DispatchRound {
  id: string;
  request_id: string;
  round_number: number;
  radius_m: number;
  status: DispatchRoundStatus;
  expires_at: string;
  candidates: DispatchOffer[];
}

export async function listMyOffers(): Promise<{ items: DispatchOffer[] }> {
  return apiGet<{ items: DispatchOffer[] }>('/api/v1/dispatch/offers');
}

export async function acceptOffer(offerId: string): Promise<AssignmentResponse> {
  return apiPost<AssignmentResponse>(
    `/api/v1/dispatch/offers/${encodeURIComponent(offerId)}/accept`,
    {},
    { headers: { 'X-Idempotency-Key': newIdempotencyKey() } },
  );
}

export async function declineOffer(offerId: string): Promise<void> {
  await apiPost(
    `/api/v1/dispatch/offers/${encodeURIComponent(offerId)}/decline`,
    {},
    { headers: { 'X-Idempotency-Key': newIdempotencyKey() } },
  );
}

export function offerStatusLabel(s: DispatchCandidateStatus): string {
  switch (s) {
    case 'pending':
      return 'Đang chờ';
    case 'offered':
      return 'Đề xuất cho bạn';
    case 'accepted':
      return 'Đã nhận';
    case 'rejected':
      return 'Đã từ chối';
    case 'expired':
      return 'Hết hạn';
    case 'cancelled':
      return 'Đã huỷ';
    default:
      return s;
  }
}

export function distanceLabel(meters?: number): string {
  if (meters === undefined) return '—';
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
