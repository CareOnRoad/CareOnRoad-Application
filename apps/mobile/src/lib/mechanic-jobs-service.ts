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
import type { Quote } from '@/lib/quotes-service';

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
  latest_quote?: Quote;
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
  diagnosis_text: string;
  recommended_work_text?: string;
  safety_notes?: string;
}

export interface DiagnosisRecord {
  id: string;
  assignment_id: string;
  diagnosis_text: string;
  recommended_work_text?: string;
  safety_notes?: string;
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

/**
 * Ngữ cảnh dùng để mirror chính xác state machine của BE.
 *
 * BE áp workflow khác nhau theo `service_type`:
 *  - `emergency_rescue` / `periodic_maintenance` → sau khi rider duyệt báo giá
 *    cuối, BE đưa assignment về `diagnosis` (không phải `awaiting_payment`),
 *    và chỉ cho mechanic chuyển `diagnosis → in_progress` khi đã có quote
 *    cuối được duyệt.
 *  - `standard` → rider duyệt quote sẽ đưa assignment thẳng sang
 *    `awaiting_payment`, và BE yêu cầu payment `succeeded` mới cho
 *    `awaiting_payment → in_progress`.
 */
export type NextAllowedStatusesOptions = {
  /** `service_type` của service request (BE trả ở job detail / jobs list). */
  serviceType?: string | null;
  /**
   * Đã có quote cuối được rider duyệt chưa:
   *  - `rescue_final` cho cứu hộ
   *  - `maintenance_work` cho bảo dưỡng
   */
  hasApprovedFinalQuote?: boolean;
};

/**
 * Transition status hợp lệ từ trạng thái hiện tại (theo BE state machine).
 *
 * Đây là MIRROR của BE `assignment-state.ts` (`TRANSITIONS`), nhưng đã loại bỏ
 * các transition mà BE CHỦ ĐỘNG từ chối cho mechanic:
 *  - `diagnosis → quoted` và `quoted → awaiting_payment`: BE tự chuyển khi
 *    quote được tạo/duyệt, mechanic tự bấm sẽ nhận 409
 *    ("This assignment transition requires its authorized quote or payment
 *    workflow.").
 *  - `in_progress → completed`: đóng assignment cần thanh toán đủ + (bảo
 *    dưỡng) checklist → do BE/rider quyết định.
 *
 * Mục đích: nút "Cập nhật tiến độ" chỉ hiện các bước mà mechanic BẤM ĐƯỢC
 * thật sự, tránh bấm xong nhận 409 khó hiểu.
 */
export function nextAllowedStatuses(
  current: AssignmentStatus,
  options: NextAllowedStatusesOptions = {},
): AssignmentStatus[] {
  const serviceType = options.serviceType ?? null;
  const hasApprovedFinalQuote = options.hasApprovedFinalQuote ?? false;
  // Cứu hộ + bảo dưỡng dùng workflow nhiều bước: BE đưa assignment về
  // `diagnosis` sau khi rider duyệt quote cuối, rồi mechanic mới được
  // `diagnosis → in_progress` (có kiểm tra quote cuối đã approved).
  const multiStepWorkflow =
    serviceType === 'emergency_rescue' || serviceType === 'periodic_maintenance';

  switch (current) {
    case 'accepted':
      // `en_route`: BE có thể yêu cầu rider đã duyệt báo giá tiền công
      // (cứu hộ `rescue_labor` / bảo dưỡng `maintenance_labor`) và đã thanh
      // toán trước — lỗi đó BE trả 409 kèm message rõ ràng.
      return ['en_route', 'canceled'];
    case 'en_route':
      return ['on_site', 'canceled'];
    case 'on_site':
      return ['diagnosis', 'canceled'];
    case 'diagnosis':
      // `quoted` do BE tự set khi quote version đầu tiên được tạo.
      // `in_progress` chỉ mở cho workflow nhiều bước (cứu hộ / bảo dưỡng)
      // VÀ đã có quote cuối được rider duyệt — mirror đúng guard của BE
      // (`assignment.service.ts` → "An approved final rescue quote is
      // required before repair." / "Approved maintenance work ...").
      if (multiStepWorkflow && hasApprovedFinalQuote) {
        return ['in_progress', 'canceled'];
      }
      return ['canceled'];
    case 'quoted':
      // `awaiting_payment` do BE tự set khi rider duyệt quote.
      return ['canceled'];
    case 'awaiting_payment':
      // `in_progress`: BE kiểm tra thanh toán / quote final đã duyệt.
      return ['in_progress', 'canceled'];
    case 'in_progress':
      // BE cho phép `in_progress → awaiting_payment` (báo đã sửa xong, chờ
      // thanh toán phần còn lại).
      return ['awaiting_payment', 'canceled'];
    case 'completed':
    case 'canceled':
      return [];
    default:
      return [];
  }
}

/**
 * Hướng dẫn bước tiếp theo cho mechanic, theo trạng thái BE hiện tại.
 *
 * Vì sao cần: Ở nhiều trạng thái BE **không có** transition thủ công mà
 * mechanic bấm được (BE tự chuyển khi tạo/duyệt quote). Nếu UI chỉ hiện
 * "Không có bước chuyển trạng thái nào khả dụi" thì mechanic tưởng app hỏng.
 * Thay vào đó, chỉ rõ họ cần làm gì tiếp theo.
 *
 * Trả về `null` khi không có hướng dẫn cụ thể.
 */
export function nextStepHint(
  current: AssignmentStatus | string,
  options: NextAllowedStatusesOptions = {},
): string | null {
  const serviceType = options.serviceType ?? null;
  const hasApprovedFinalQuote = options.hasApprovedFinalQuote ?? false;
  const multiStepWorkflow =
    serviceType === 'emergency_rescue' || serviceType === 'periodic_maintenance';

  switch (current) {
    case 'accepted':
      return multiStepWorkflow
        ? 'Bước tiếp theo: gửi báo giá tiền công cho khách ở mục "Chẩn đoán & Báo giá" phía trên. Sau khi khách duyệt và thanh toán, bạn bấm "Bắt đầu đi" ở đây.'
        : 'Bước tiếp theo: bấm "Bắt đầu đi" để thông báo bạn đang đến nơi.';
    case 'en_route':
      return 'Bước tiếp theo: tới nơi thì bấm "Đã tới nơi".';
    case 'on_site':
      return 'Bước tiếp theo: bấm "Bắt đầu chẩn đoán", sau đó điền chẩn đoán và gửi báo giá ở mục "Chẩn đoán & Báo giá" phía trên.';
    case 'diagnosis':
      if (multiStepWorkflow && hasApprovedFinalQuote) {
        return 'Bước tiếp theo: bấm "Bắt đầu sửa" để chuyển sang bước sửa chữa.';
      }
      return 'Bước tiếp theo: điền chẩn đoán và gửi báo giá ở mục "Chẩn đoán & Báo giá" phía trên. Hệ thống sẽ tự chuyển sang bước "Đã gửi báo giá" sau khi bạn gửi.';
    case 'quoted':
      return 'Bước tiếp theo: chờ khách duyệt báo giá. Hệ thống sẽ tự chuyển sang "Chờ thanh toán" khi khách duyệt.';
    case 'awaiting_payment':
      return 'Bước tiếp theo: chờ khách thanh toán. Sau khi hệ thống xác nhận thanh toán thành công, bấm "Bắt đầu sửa" ở đây.';
    case 'in_progress':
      return 'Bước tiếp theo: khi sửa xong, bấm "Báo đã sửa xong" để chuyển sang chờ thanh toán phần còn lại.';
    case 'completed':
      return 'Công việc đã hoàn tất.';
    case 'canceled':
    case 'recovery_canceled':
      return 'Công việc đã kết thúc.';
    default:
      return null;
  }
}

// =========================================================
// Timeline (tiến trình công việc)
// =========================================================

/**
 * Timeline tiến trình công việc theo **BE assignment status** (raw).
 *
 * Không dùng UI `MechanicJobStatus` vì nó gộp 8 BE state vào 5 giá trị
 * (`accepted|en_route|on_site|diagnosis|quoted` → `pending`) → timeline luôn
 * dừng ở bước đầu, không phản ánh tiến trình thật.
 */
export const BE_JOB_TIMELINE: readonly { status: AssignmentStatus; label: string }[] = [
  { status: 'accepted', label: 'Đã nhận việc' },
  { status: 'en_route', label: 'Đang đến nơi' },
  { status: 'on_site', label: 'Đã tới nơi' },
  { status: 'diagnosis', label: 'Đang chẩn đoán' },
  { status: 'quoted', label: 'Đã gửi báo giá' },
  { status: 'awaiting_payment', label: 'Chờ thanh toán' },
  { status: 'in_progress', label: 'Đang sửa' },
  { status: 'completed', label: 'Hoàn tất' },
];

/**
 * Index của bước hiện tại trong `BE_JOB_TIMELINE`.
 *
 * - `canceled` / `recovery_canceled` → `-1` (không có bước nào đạt).
 * - `recovery_canceled` không có trong enum `AssignmentStatus` của FE nhưng
 *   BE vẫn trả về → xử lý như `canceled`.
 */
export function timelineIndexForStatus(status: string | undefined): number {
  if (!status) return -1;
  if (status === 'canceled' || status === 'recovery_canceled') return -1;
  return BE_JOB_TIMELINE.findIndex((step) => step.status === status);
}
