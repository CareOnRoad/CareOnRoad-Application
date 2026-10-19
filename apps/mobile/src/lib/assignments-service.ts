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

/**
 * Response của `GET/PUT /api/v1/assignments/{id}/live-location`.
 *
 * LƯU Ý contract: BE trả **flat shape** (xem
 * `apps/api/src/features/live-tracking/live-tracking.service.ts` → `toResponse`):
 *   { assignment_id, latitude, longitude, observed_at, accuracy_meters,
 *     received_at, expires_at, freshness }
 *
 * Không có field `mechanic_id`, `location` (nested) hay `age_seconds`.
 * Dùng optional + tolerant parsing ở consumer để không crash nếu BE đổi
 * shape về sau.
 */
export interface LiveLocationResponse {
  assignment_id: string;
  latitude: number;
  longitude: number;
  accuracy_meters?: number;
  observed_at: string;
  received_at?: string;
  expires_at?: string;
  /** 'current' | 'stale' — BE đánh dấu freshness của point. */
  freshness?: string;
  /** Legacy/nested shape: một số path cũ vẫn bọc trong `location`. */
  location?: { latitude: number; longitude: number };
  /** Legacy: tuổi point (giây) nếu có. */
  age_seconds?: number;
  mechanic_id?: string;
  captured_at?: string;
}

/**
 * Chuẩn hoá `LiveLocationResponse` về `{ latitude, longitude, ageSeconds }`
 * hoặc `null` nếu payload không có toạ độ hợp lệ.
 *
 * Chấp nhận cả flat shape (BE hiện tại) và nested shape (fallback) để app
 * không crash khi contract lệch.
 */
export function normalizeLiveLocation(
  raw: LiveLocationResponse | null | undefined,
  now: () => number = Date.now,
): { latitude: number; longitude: number; ageSeconds: number } | null {
  if (!raw) return null;
  const lat = typeof raw.latitude === 'number' ? raw.latitude : raw.location?.latitude;
  const lng = typeof raw.longitude === 'number' ? raw.longitude : raw.location?.longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const observedAt = raw.observed_at ?? raw.captured_at;
  let ageSeconds = 0;
  if (observedAt) {
    const parsed = Date.parse(observedAt);
    if (!Number.isNaN(parsed)) ageSeconds = Math.max(0, Math.round((now() - parsed) / 1000));
  } else if (typeof raw.age_seconds === 'number') {
    ageSeconds = raw.age_seconds;
  }
  return { latitude: lat, longitude: lng, ageSeconds };
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

// =========================================================
// Completion checklist (rider view) — BE: GET /api/v1/assignments/{id}/completion-checklist
// =========================================================

export interface CompletionChecklistResponse {
  id: string;
  assignment_id: string;
  request_id: string;
  mechanic_id: string;
  revision: number;
  approved_quote_id?: string;
  work_summary: string;
  safety_checklist: {
    test_ride_completed: boolean;
    tools_removed: boolean;
    area_safe: boolean;
    rider_briefed: boolean;
    no_fluid_leak: boolean;
  };
  notes?: string;
  created_at: string;
}

/**
 * Lấy completion checklist mới nhất của assignment.
 * Trả về `null` nếu BE trả 404 (chưa có checklist) hoặc lỗi mạng — caller
 * tự render placeholder "Thợ chưa gửi checklist".
 */
export async function getCompletionChecklist(
  assignmentId: string,
): Promise<CompletionChecklistResponse | null> {
  try {
    return await apiGet<CompletionChecklistResponse>(
      `/api/v1/assignments/${encodeURIComponent(assignmentId)}/completion-checklist`,
    );
  } catch (e) {
    // 404 → chưa có. Lỗi khác → log warning nhưng vẫn trả null để UI fallback.
    if (__DEV__ && !(e instanceof Error && e.message.includes('404'))) {
      // eslint-disable-next-line no-console
      console.warn('[assignments-service] getCompletionChecklist failed:', e);
    }
    return null;
  }
}

// =========================================================
// Diagnoses (rider view) — BE: GET /api/v1/assignments/{id}/diagnoses
// =========================================================

export interface AssignmentDiagnosis {
  id: string;
  assignment_id: string;
  summary: string;
  root_cause?: string;
  recommended_action?: string;
  created_by: string;
  created_at: string;
}

/**
 * Lấy danh sách diagnosis versions cho assignment (mới nhất trước).
 * Trả về `[]` nếu chưa có hoặc lỗi.
 */
export async function listAssignmentDiagnoses(
  assignmentId: string,
): Promise<AssignmentDiagnosis[]> {
  try {
    const res = await apiGet<{ items?: AssignmentDiagnosis[] } | AssignmentDiagnosis[]>(
      `/api/v1/assignments/${encodeURIComponent(assignmentId)}/diagnoses`,
    );
    const items = Array.isArray(res) ? res : (res.items ?? []);
    return [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch {
    return [];
  }
}

/** Lấy diagnosis mới nhất (helper). */
export async function getLatestAssignmentDiagnosis(
  assignmentId: string,
): Promise<AssignmentDiagnosis | null> {
  const items = await listAssignmentDiagnoses(assignmentId);
  return items[0] ?? null;
}

// =========================================================
// ETA metadata (rider view) — wrapper optional
// =========================================================

/**
 * Optional wrapper để lấy ETA metadata mới nhất mà mechanic đã submit.
 *
 * Hiện tại FE không gọi hàm này (chỉ dùng `route-eta` từ Google Routes theo
 * quyết định user). Khi BE bổ sung `GET /api/v1/assignments/{id}/eta`, có
 * thể gọi lại mà không cần đổi signature.
 *
 * Trả về `null` cho tất cả lỗi (404 / network) để caller tự fallback.
 */
export async function getLatestAssignmentEta(
  assignmentId: string,
): Promise<null> {
  // BE chưa có GET /api/v1/assignments/{id}/eta — chỉ có POST (mechanic submit).
  // Trả null để caller không phải xử lý error.
  void assignmentId;
  return null;
}

export { newIdempotencyKey };
