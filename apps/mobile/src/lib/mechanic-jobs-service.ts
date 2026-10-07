/**
 * Service wrappers cho các thao tác mechanic trên /api/v1/assignments/{id}/*.
 *
 *  - POST /api/v1/assignments/{id}/status                - chuyển trạng thái
 *  - POST /api/v1/assignments/{id}/eta                   - báo ETA / delay
 *  - POST /api/v1/assignments/{id}/media                 - thêm media metadata
 *  - POST /api/v1/assignments/{id}/completion-checklist  - checklist hoàn tất
 *  - POST /api/v1/assignments/{id}/diagnoses             - chẩn đoán
 *  - POST /api/v1/assignments/{id}/recover               - recover pre-quote
 *  - PUT  /api/v1/assignments/{id}/live-location         - ingest vị trí thợ
 *  - GET  /api/v1/assignments/{id}/route-eta             - ETA cho thợ (rider cũng dùng)
 *  - GET  /api/v1/assignments/{id}/live-location         - poll vị trí
 *  - GET  /api/v1/assignments                            - danh sách (mechanic + admin + rider)
 */
import { apiGet, apiPost } from '@/lib/api';
import { newIdempotencyKey } from '@/lib/idempotency';

export type AssignmentStatus =
  | 'accepted'
  | 'en_route'
  | 'on_site'
  | 'diagnosis'
  | 'quoted'
  | 'awaiting_payment'
  | 'in_progress'
  | 'completed'
  | 'canceled';

export interface AssignmentResponse {
  id: string;
  request_id: string;
  mechanic_id: string;
  accepted_candidate_id: string;
  status: AssignmentStatus;
  accepted_at: string;
  started_at?: string;
  completed_at?: string;
  canceled_at?: string;
  created_at: string;
  updated_at: string;
}

// =========================================================
// List
// =========================================================

export interface ListAssignmentsQuery {
  status?: AssignmentStatus;
  active_only?: boolean;
  limit?: number;
  cursor?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface AssignmentListPage {
  items: AssignmentResponse[];
  next_cursor?: string;
}

export async function listAssignments(
  query: ListAssignmentsQuery = {},
): Promise<AssignmentListPage> {
  return apiGet<AssignmentListPage>('/api/v1/assignments', { query });
}

// =========================================================
// Job detail (mechanic-owned)
// =========================================================

/**
 * Response của `GET /api/v1/mechanics/me/jobs/{assignmentId}`.
 *
 * Xem `apps/api/src/features/mechanic-operations/mechanic-job-list.service.ts`
 * → `getJob()`.
 *
 * Lưu ý:
 *  - `sensitive_details_redacted === true` khi assignment đã terminal
 *    (completed/canceled) → BE cố tình bỏ `request.location`,
 *    `request.address_text` và `motorcycle.license_plate`.
 *  - `request` / `motorcycle` / `latest_quote` / `completion_checklist` là
 *    optional — không phải assignment nào cũng có.
 */
export interface MechanicJobDetailResponse {
  assignment: AssignmentResponse & {
    source?: string;
    scheduled_start_at?: string;
    appointment_status?: string;
  };
  request?: {
    id: string;
    request_code: string;
    service_type: string;
    fulfillment_mode?: string;
    status: string;
    problem_description: string;
    scheduled_start_at?: string;
    location?: { latitude: number; longitude: number };
    address_text?: string;
  };
  motorcycle?: {
    id: string;
    brand_text?: string;
    model_text?: string;
    year?: number;
    license_plate?: string;
  };
  latest_quote?: unknown;
  agreements?: {
    rescue_labor?: unknown;
    rescue_payment_timing?: string;
    maintenance_labor?: unknown;
  };
  completion_checklist?: {
    id: string;
    revision: number;
    approved_quote_id?: string;
    work_summary?: string;
    safety_checklist?: Record<string, boolean>;
    created_at: string;
  };
  media?: {
    items: {
      upload_intent_id: string;
      media_metadata_id: string;
      resource_type: string;
      purpose: string;
      content_type: string;
      size_bytes: number;
      created_at: string;
    }[];
    has_more: boolean;
  };
  sensitive_details_redacted: boolean;
}

/**
 * Đọc chi tiết job của mechanic hiện tại.
 *
 * 403 nếu assignment thuộc mechanic khác; 404 nếu không tồn tại.
 */
export async function getJobDetail(
  assignmentId: string,
): Promise<MechanicJobDetailResponse> {
  return apiGet<MechanicJobDetailResponse>(
    `/api/v1/mechanics/me/jobs/${encodeURIComponent(assignmentId)}`,
  );
}

// =========================================================
// Status transition
// =========================================================

export interface TransitionStatusInput {
  status: AssignmentStatus;
  reason?: string;
}

export async function transitionAssignment(
  assignmentId: string,
  input: TransitionStatusInput,
): Promise<AssignmentResponse> {
  return apiPost<AssignmentResponse>(
    `/api/v1/assignments/${encodeURIComponent(assignmentId)}/status`,
    input,
    { headers: { 'X-Idempotency-Key': newIdempotencyKey() } },
  );
}

// =========================================================
// ETA
// =========================================================

export interface EtaInput {
  eta_at?: string; // ISO datetime với offset
  delay_reason?: string;
}

export async function submitEta(
  assignmentId: string,
  input: EtaInput,
): Promise<{ assignment_id: string; eta_at?: string; recorded_at: string }> {
  return apiPost(
    `/api/v1/assignments/${encodeURIComponent(assignmentId)}/eta`,
    input,
    { headers: { 'X-Idempotency-Key': newIdempotencyKey() } },
  );
}

// =========================================================
// Media metadata
// =========================================================

export type AssignmentMediaPurpose = 'diagnosis' | 'work_proof' | 'safety' | 'other';

export interface AssignmentMediaInput {
  media_reference: string; // storage path sau khi upload intent
  purpose: AssignmentMediaPurpose;
  content_type: string;
  size_bytes: number;
  checksum?: string;
}

export interface AssignmentMediaRecord {
  id: string;
  assignment_id: string;
  media_reference: string;
  purpose: AssignmentMediaPurpose;
  content_type: string;
  size_bytes: number;
  checksum?: string;
  created_at: string;
}

export async function addAssignmentMedia(
  assignmentId: string,
  input: AssignmentMediaInput,
): Promise<AssignmentMediaRecord> {
  return apiPost<AssignmentMediaRecord>(
    `/api/v1/assignments/${encodeURIComponent(assignmentId)}/media`,
    input,
    { headers: { 'X-Idempotency-Key': newIdempotencyKey() } },
  );
}

// =========================================================
// Completion checklist
// =========================================================

export interface SafetyChecklist {
  test_ride_completed: boolean;
  tools_removed: boolean;
  area_safe: boolean;
  rider_briefed: boolean;
  no_fluid_leak: boolean;
}

export interface CompletionChecklistInput {
  work_summary: string;
  safety_checklist: SafetyChecklist;
  notes?: string;
}

export async function submitCompletionChecklist(
  assignmentId: string,
  input: CompletionChecklistInput,
): Promise<{ assignment_id: string; recorded_at: string }> {
  return apiPost(
    `/api/v1/assignments/${encodeURIComponent(assignmentId)}/completion-checklist`,
    input,
    { headers: { 'X-Idempotency-Key': newIdempotencyKey() } },
  );
}

// =========================================================
// Diagnoses
// =========================================================

export interface DiagnosisInput {
  summary: string;
  root_cause?: string;
  recommended_action?: string;
}

export interface DiagnosisRecord {
  id: string;
  assignment_id: string;
  summary: string;
  root_cause?: string;
  recommended_action?: string;
  created_by: string;
  created_at: string;
}

export async function createDiagnosis(
  assignmentId: string,
  input: DiagnosisInput,
): Promise<DiagnosisRecord> {
  return apiPost<DiagnosisRecord>(
    `/api/v1/assignments/${encodeURIComponent(assignmentId)}/diagnoses`,
    input,
    { headers: { 'X-Idempotency-Key': newIdempotencyKey() } },
  );
}

/** Lấy diagnosis mới nhất cho assignment (nếu có). Trả về null nếu chưa có. */
export async function getLatestDiagnosis(
  assignmentId: string,
): Promise<DiagnosisRecord | null> {
  try {
    const res = await apiGet<{ items?: DiagnosisRecord[] } | DiagnosisRecord[]>(
      `/api/v1/assignments/${encodeURIComponent(assignmentId)}/diagnoses`,
      { query: { limit: 1 } },
    );
    const items = Array.isArray(res) ? res : (res.items ?? []);
    return items[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Lấy tất cả diagnosis versions cho assignment, sắp xếp mới nhất trước.
 *
 * Dùng cho UI "Xem các phiên trước" trong DiagnosisForm. Trả về `[]` nếu
 * chưa có hoặc BE fail (silent - best-effort, không set error banner).
 */
export async function listDiagnoses(
  assignmentId: string,
): Promise<DiagnosisRecord[]> {
  try {
    const res = await apiGet<{ items?: DiagnosisRecord[] } | DiagnosisRecord[]>(
      `/api/v1/assignments/${encodeURIComponent(assignmentId)}/diagnoses`,
    );
    return Array.isArray(res) ? res : (res.items ?? []);
  } catch {
    return [];
  }
}

// =========================================================
// Recover (pre-quote)
// =========================================================

export type RecoveryReasonCode =
  | 'cannot_continue'
  | 'vehicle_unreachable'
  | 'rider_unavailable'
  | 'safety_concern'
  | 'other';

export interface RecoverAssignmentInput {
  reason_code: RecoveryReasonCode;
  note?: string;
}

export interface RecoverAssignmentResponse {
  assignment_id: string;
  request_id: string;
  status: 'recovery_canceled';
  reason_code: RecoveryReasonCode;
  redispatch_status: 'queued';
  recovered_at: string;
}

export async function recoverAssignment(
  assignmentId: string,
  input: RecoverAssignmentInput,
): Promise<RecoverAssignmentResponse> {
  return apiPost<RecoverAssignmentResponse>(
    `/api/v1/assignments/${encodeURIComponent(assignmentId)}/recover`,
    input,
    { headers: { 'X-Idempotency-Key': newIdempotencyKey() } },
  );
}

// =========================================================
// Helpers
// =========================================================

export function statusLabel(s: AssignmentStatus): string {
  switch (s) {
    case 'accepted':
      return 'Đã nhận';
    case 'en_route':
      return 'Đang đến';
    case 'on_site':
      return 'Đã đến nơi';
    case 'diagnosis':
      return 'Đang chẩn đoán';
    case 'quoted':
      return 'Đã báo giá';
    case 'awaiting_payment':
      return 'Chờ thanh toán';
    case 'in_progress':
      return 'Đang sửa';
    case 'completed':
      return 'Hoàn tất';
    case 'canceled':
      return 'Đã huỷ';
    default:
      return s;
  }
}

/** Transition status hợp lệ từ trạng thái hiện tại (theo BE state machine). */
export function nextAllowedStatuses(current: AssignmentStatus): AssignmentStatus[] {
  switch (current) {
    case 'accepted':
      return ['en_route', 'canceled'];
    case 'en_route':
      return ['on_site', 'canceled'];
    case 'on_site':
      return ['diagnosis', 'canceled'];
    case 'diagnosis':
      return ['quoted', 'canceled'];
    case 'quoted':
      return ['awaiting_payment', 'canceled'];
    case 'awaiting_payment':
      return ['in_progress', 'canceled'];
    case 'in_progress':
      return ['completed', 'canceled'];
    case 'completed':
    case 'canceled':
      return [];
    default:
      return [];
  }
}
