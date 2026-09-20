/**
 * Service wrappers cho assignment-level APIs (rider view).
 *
 *  - GET /api/v1/assignments               - list (filter status, date, limit, cursor)
 *  - GET /api/v1/assignments/{id}/route-eta - ETA thật từ Google Routes + fallback
 *  - PUT /api/v1/assignments/{id}/live-location - mechanic ingest (không dùng FE rider)
 *  - GET /api/v1/assignments/{id}/live-location - rider poll vị trí thợ
 *  - POST /api/v1/assignments/{id}/review  - rider tạo review sau completed
 */
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { newIdempotencyKey } from '@/lib/idempotency';
import type { RouteEtaResponse } from './service-requests-service';

export interface AssignmentListItem {
  id: string;
  request_id: string;
  mechanic_id: string;
  status: string;
  accepted_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface LiveLocationResponse {
  assignment_id: string;
  mechanic_id: string;
  location: { latitude: number; longitude: number };
  accuracy_meters?: number;
  observed_at: string;
  captured_at: string;
  age_seconds?: number;
}

export interface CreateReviewInput {
  rating: number; // 1-5
  comment?: string;
}

export async function listAssignments(
  params: { status?: string; active_only?: boolean; limit?: number; cursor?: string } = {},
): Promise<{ items: AssignmentListItem[]; next_cursor?: string }> {
  return apiGet('/api/v1/assignments', { query: params });
}

export async function getRouteEta(assignmentId: string): Promise<RouteEtaResponse> {
  return apiGet<RouteEtaResponse>(
    `/api/v1/assignments/${encodeURIComponent(assignmentId)}/route-eta`,
  );
}

export async function getLiveLocation(assignmentId: string): Promise<LiveLocationResponse | null> {
  try {
    return await apiGet<LiveLocationResponse>(
      `/api/v1/assignments/${encodeURIComponent(assignmentId)}/live-location`,
    );
  } catch {
    // Live tracking có thể disabled (404) hoặc expired — trả null để UI fallback ETA.
    return null;
  }
}

export async function createReview(
  assignmentId: string,
  input: CreateReviewInput,
): Promise<{ id: string; assignment_id: string; rating: number; comment?: string; created_at: string }> {
  return apiPost(`/api/v1/assignments/${encodeURIComponent(assignmentId)}/review`, input);
}

/** Stub để tương thích nếu sau này cần mechanic-side ingest. */
export async function ingestLiveLocation(
  assignmentId: string,
  payload: { latitude: number; longitude: number; observed_at: string; accuracy_meters: number },
): Promise<LiveLocationResponse> {
  return apiPut(`/api/v1/assignments/${encodeURIComponent(assignmentId)}/live-location`, payload);
}

export { newIdempotencyKey };
