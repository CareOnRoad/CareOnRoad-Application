/**
 * Service wrappers cho /api/v1/service-requests.
 *
 * Backend contract (verified từ `service-request.schemas.ts`):
 *  - `service_type`: enum ['emergency_rescue','mobile_repair','at_home_service','periodic_maintenance','other']
 *  - `fulfillment_mode`: 'immediate_location' | 'scheduled_visit'
 *  - `motorcycle_id`: UUID (bắt buộc)
 *  - `problem_description`: 3-3000 chars
 *  - `location`: { latitude, longitude } - BẮT BUỘC cho dispatch flow
 *  - `address_text`: optional
 *  - `scheduled_start_at`: ISO datetime có offset - dùng cho booking maintenance
 *  - `maintenance_notes`: optional (cho periodic_maintenance)
 *
 * Tất cả POST đều yêu cầu `X-Idempotency-Key` (8-200 chars).
 *
 * Response shape: ServiceRequestResponse (snake_case).
 */
import { ApiError, apiGet, apiPost } from '@/lib/api';
import { newIdempotencyKey } from '@/lib/idempotency';

export type ServiceType =
  | 'emergency_rescue'
  | 'mobile_repair'
  | 'at_home_service'
  | 'periodic_maintenance'
  | 'other';

export type FulfillmentMode = 'immediate_location' | 'scheduled_visit';

export type RequestStatus =
  | 'submitted'
  | 'dispatching'
  | 'offered'
  | 'assigned'
  | 'mechanic_en_route'
  | 'in_service'
  | 'awaiting_quote_approval'
  | 'awaiting_payment'
  | 'completed'
  | 'manual_escalation'
  | 'canceled';

export interface ServiceRequestResponse {
  id: string;
  request_code: string;
  rider_id: string;
  motorcycle_id: string;
  service_type: ServiceType;
  fulfillment_mode?: FulfillmentMode;
  problem_description: string;
  status: RequestStatus;
  priority: string;
  location?: { latitude: number; longitude: number };
  address_text?: string;
  scheduled_start_at?: string;
  safety_answers?: Record<string, unknown>;
  maintenance_notes?: string;
  reminder_id?: string;
  reminder_context_id?: string;
  canceled_reason?: string;
  media_metadata?: RequestMediaMetadata[];
  created_at: string;
  updated_at: string;
}

export interface RequestMediaMetadata {
  id: string;
  request_id: string;
  media_type: string;
  object_reference: string;
  content_type: string;
  size_bytes?: number;
  checksum?: string;
  created_by: string;
  created_at: string;
}

export interface CreateServiceRequestInput {
  motorcycle_id: string;
  service_type: ServiceType;
  problem_description: string;
  fulfillment_mode?: FulfillmentMode;
  location?: { latitude: number; longitude: number };
  address_text?: string;
  scheduled_start_at?: string;
  maintenance_notes?: string;
  reminder_id?: string;
  reminder_context_id?: string;
  safety_answers?: Record<string, unknown>;
}

export interface DispatchRoundResponse {
  id: string;
  request_id: string;
  round_number: number;
  radius_m: number;
  status: 'active' | 'accepted' | 'expired' | 'canceled';
  expires_at: string;
  candidates: DispatchCandidateResponse[];
}

export interface DispatchCandidateResponse {
  id: string;
  round_id: string;
  request_id: string;
  mechanic_id: string;
  rank: number;
  distance_m?: number;
  status: 'pending' | 'offered' | 'accepted' | 'rejected' | 'expired' | 'cancelled';
  expires_at?: string;
}

export interface RouteEtaResponse {
  assignment_id: string;
  status: 'available' | 'fallback' | 'unavailable';
  source: 'google_routes' | 'straight_line_fallback' | 'none';
  distance_meters?: number;
  duration_seconds?: number;
  calculated_at: string;
  expires_at: string;
  unavailable_reason?: string;
  advisory: { code: string; message: string };
}

export interface AssignmentResponse {
  id: string;
  request_id: string;
  mechanic_id: string;
  accepted_candidate_id: string;
  status:
    | 'accepted'
    | 'en_route'
    | 'on_site'
    | 'diagnosis'
    | 'quoted'
    | 'awaiting_payment'
    | 'in_progress'
    | 'completed'
    | 'canceled'
    | 'recovery_canceled';
  accepted_at: string;
  started_at?: string;
  completed_at?: string;
  canceled_at?: string;
  created_at: string;
  updated_at: string;
}

// =========================================================
// Service-request CRUD
// =========================================================

export async function listServiceRequests(): Promise<ServiceRequestResponse[]> {
  const res = await apiGet<{ items: ServiceRequestResponse[] }>('/api/v1/service-requests');
  return res.items;
}

export async function getServiceRequest(id: string): Promise<ServiceRequestResponse> {
  return apiGet<ServiceRequestResponse>(`/api/v1/service-requests/${encodeURIComponent(id)}`);
}

export async function createServiceRequest(
  input: CreateServiceRequestInput,
): Promise<ServiceRequestResponse> {
  const idempotencyKey = newIdempotencyKey();
  return apiPost<ServiceRequestResponse>(
    '/api/v1/service-requests',
    input,
    {
      headers: { 'X-Idempotency-Key': idempotencyKey },
    },
  );
}

export async function cancelServiceRequest(
  id: string,
  reason: string,
): Promise<ServiceRequestResponse> {
  // Backend cancel yêu cầu body { reason: 1-500 chars }.
  // Theo AGENTS.md, cancel có X-Idempotency-Key; check route handler — hiện route không require,
  // nhưng gửi vẫn safe (nhiều route khác cần). Cancel service-request idempotent key cũng được BE chấp nhận.
  const idempotencyKey = newIdempotencyKey();
  return apiPost<ServiceRequestResponse>(
    `/api/v1/service-requests/${encodeURIComponent(id)}/cancel`,
    { reason },
    { headers: { 'X-Idempotency-Key': idempotencyKey } },
  );
}

export async function startDispatch(requestId: string): Promise<DispatchRoundResponse> {
  const idempotencyKey = newIdempotencyKey();
  return apiPost<DispatchRoundResponse>(
    `/api/v1/service-requests/${encodeURIComponent(requestId)}/dispatch`,
    {},
    { headers: { 'X-Idempotency-Key': idempotencyKey } },
  );
}

// =========================================================
// Helpers
// =========================================================

/**
 * Map status BE sang phase FE để hiển thị.
 */
export function statusToPhase(status: RequestStatus):
  | 'idle'
  | 'searching'
  | 'tracking'
  | 'quote'
  | 'payment'
  | 'completed'
  | 'canceled' {
  switch (status) {
    case 'submitted':
    case 'dispatching':
    case 'offered':
    case 'manual_escalation':
      return 'searching';
    case 'assigned':
    case 'mechanic_en_route':
    case 'in_service':
      return 'tracking';
    case 'awaiting_quote_approval':
      return 'quote';
    case 'awaiting_payment':
      return 'payment';
    case 'completed':
      return 'completed';
    case 'canceled':
      return 'canceled';
    default:
      return 'searching';
  }
}

export function statusLabel(status: RequestStatus): string {
  switch (status) {
    case 'submitted':
      return 'Đã gửi yêu cầu';
    case 'dispatching':
      return 'Đang ghép thợ';
    case 'offered':
      return 'Đã đề xuất thợ';
    case 'assigned':
      return 'Thợ đã nhận';
    case 'mechanic_en_route':
      return 'Thợ đang đến';
    case 'in_service':
      return 'Thợ đang sửa';
    case 'awaiting_quote_approval':
      return 'Chờ duyệt báo giá';
    case 'awaiting_payment':
      return 'Chờ thanh toán';
    case 'completed':
      return 'Hoàn tất';
    case 'manual_escalation':
      return 'Cần hỗ trợ thủ công';
    case 'canceled':
      return 'Đã huỷ';
    default:
      return status;
  }
}

export function isActive(status: RequestStatus): boolean {
  return !['completed', 'canceled', 'manual_escalation'].includes(status);
}

export function isUpcoming(status: RequestStatus): boolean {
  return ['submitted', 'dispatching', 'offered', 'assigned', 'mechanic_en_route', 'in_service'].includes(
    status,
  );
}

/** Cho phép cancel hay không (theo state machine). */
export function canCancel(status: RequestStatus): boolean {
  return [
    'submitted',
    'dispatching',
    'offered',
    'assigned',
    'mechanic_en_route',
  ].includes(status);
}

export type { ApiError };
