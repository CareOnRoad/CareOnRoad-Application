/**
 * Service wrappers cho /api/v1/mechanics (mechanic-owned profile + ops).
 *
 *  - GET    /api/v1/mechanics/me/profile     - hồ sơ thợ
 *  - PATCH  /api/v1/mechanics/me/profile     - cập nhật radius_km + service_types
 *  - PUT    /api/v1/mechanics/me/availability- chuyển trạng thái sẵn sàng
 *  - PUT    /api/v1/mechanics/me/location    - cập nhật vị trí GPS (raw)
 *  - GET    /api/v1/mechanics/me/dashboard   - tổng quan dashboard
 *  - GET    /api/v1/mechanics/me/jobs        - danh sách assignment của thợ
 *  - GET    /api/v1/mechanics/me/performance - chỉ số 7 ngày
 */
import { apiGet, apiPatch, apiPut } from '@/lib/api';

// =========================================================
// Profile
// =========================================================

export type MechanicProfileStatus = 'pending' | 'active' | 'suspended' | 'banned';

export type ServiceType =
  | 'emergency_rescue'
  | 'mobile_repair'
  | 'at_home_service'
  | 'periodic_maintenance'
  | 'other';

export interface MechanicProfileResponse {
  user_id: string;
  profile_status: MechanicProfileStatus;
  is_available: boolean;
  service_radius_km: number;
  latest_location?: { latitude: number; longitude: number };
  location_updated_at?: string;
  availability_updated_at: string;
  rating_avg: number;
  rating_count: number;
  service_types: ServiceType[];
  created_at: string;
  updated_at: string;
}

export interface MechanicProfileUpdateInput {
  service_radius_km?: number;
  service_types?: ServiceType[];
}

export interface MechanicAvailabilityInput {
  is_available: boolean;
}

export interface MechanicLocationInput {
  latitude: number;
  longitude: number;
}

export async function getMyMechanicProfile(): Promise<MechanicProfileResponse> {
  return apiGet<MechanicProfileResponse>('/api/v1/mechanics/me/profile');
}

export async function updateMyMechanicProfile(
  input: MechanicProfileUpdateInput,
): Promise<MechanicProfileResponse> {
  return apiPatch<MechanicProfileResponse>('/api/v1/mechanics/me/profile', input);
}

export async function updateMyAvailability(
  input: MechanicAvailabilityInput,
): Promise<MechanicProfileResponse> {
  return apiPut<MechanicProfileResponse>('/api/v1/mechanics/me/availability', input);
}

export async function updateMyLocation(
  input: MechanicLocationInput,
): Promise<void> {
  await apiPut('/api/v1/mechanics/me/location', input);
}

// =========================================================
// Dashboard
// =========================================================

export type LocationFreshness = 'missing' | 'fresh' | 'stale';
export type NextActionCode =
  | 'go_available'
  | 'update_location'
  | 'review_offer'
  | 'continue_active_job'
  | 'no_action';

export interface MechanicDashboardJob {
  assignment_id: string;
  request_id: string;
  status: string;
  accepted_at: string;
  started_at?: string;
  completed_at?: string;
  canceled_at?: string;
  created_at: string;
  updated_at: string;
  request: {
    request_code: string;
    service_type: string;
    status: string;
    priority: string;
    created_at: string;
    scheduled_start_at?: string;
  };
  latest_quote_status?: string;
  next_action_code: NextActionCode;
}

export interface MechanicDashboardResponse {
  availability: {
    profile_status: MechanicProfileStatus;
    is_available: boolean;
  };
  location: {
    freshness: LocationFreshness;
    updated_at?: string;
  };
  open_offers_count: number;
  active_assignment?: MechanicDashboardJob;
  today_counts: {
    accepted_jobs: number;
    completed_jobs: number;
    canceled_jobs: number;
  };
  seven_day_performance: {
    completed_jobs: number;
    canceled_jobs: number;
    acceptance_rate: number;
    decline_rate: number;
    quote_approval_rate: number;
  };
  rating: {
    average: number;
    count: number;
  };
  next_action_codes: NextActionCode[];
}

export async function getMechanicDashboard(): Promise<MechanicDashboardResponse> {
  return apiGet<MechanicDashboardResponse>('/api/v1/mechanics/me/dashboard');
}

// =========================================================
// Jobs (assignments list)
// =========================================================

export interface MechanicJobsQuery {
  status?:
    | 'accepted'
    | 'en_route'
    | 'on_site'
    | 'diagnosis'
    | 'quoted'
    | 'awaiting_payment'
    | 'in_progress'
    | 'completed'
    | 'canceled';
  active_only?: boolean;
  date_from?: string;
  date_to?: string;
  limit?: number;
  cursor?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface MechanicJobsPage {
  items: MechanicDashboardJob[];
  page: {
    limit: number;
    has_more: boolean;
    next_cursor?: string;
  };
}

export async function listMechanicJobs(
  query: MechanicJobsQuery = {},
): Promise<MechanicJobsPage> {
  return apiGet<MechanicJobsPage>('/api/v1/mechanics/me/jobs', { query });
}

// =========================================================
// Performance
// =========================================================

export interface MechanicPerformanceResponse {
  completed_jobs: number;
  canceled_jobs: number;
  acceptance_rate: number;
  decline_rate: number;
  average_accept_time_seconds?: number;
  average_workflow_duration_seconds?: number;
  quote_approval_rate: number;
  rating: {
    average: number;
    count: number;
  };
}

export async function getMechanicPerformance(
  query: { date_from?: string; date_to?: string } = {},
): Promise<MechanicPerformanceResponse> {
  return apiGet<MechanicPerformanceResponse>('/api/v1/mechanics/me/performance', {
    query,
  });
}

// =========================================================
// Helpers
// =========================================================

export function freshnessLabel(f: LocationFreshness): string {
  switch (f) {
    case 'fresh':
      return 'Vị trí mới';
    case 'stale':
      return 'Vị trí cũ';
    case 'missing':
    default:
      return 'Chưa có vị trí';
  }
}

export function nextActionLabel(code: NextActionCode): string {
  switch (code) {
    case 'go_available':
      return 'Bật trạng thái nhận việc';
    case 'update_location':
      return 'Cập nhật vị trí';
    case 'review_offer':
      return 'Xem offer mới';
    case 'continue_active_job':
      return 'Tiếp tục công việc đang chạy';
    case 'no_action':
    default:
      return '';
  }
}
