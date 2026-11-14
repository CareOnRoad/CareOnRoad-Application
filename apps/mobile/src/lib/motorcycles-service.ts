import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import type { MotorcycleDetails, Vehicle } from '@/lib/types';

/**
 * Service wrapper cho /api/v1/motorcycles.
 *
 * Backend schema (snake_case) → UI Vehicle (camelCase + derived fields).
 *
 * Backend giờ trả maintenance dates (`last_maintenance_at`, `next_maintenance_at`)
 * derive từ `service_requests` (completed + upcoming) và `reminder_rules`.
 * Map thẳng vào UI Vehicle.lastMaintenance / nextMaintenance.
 *
 * Backend KHÔNG lưu số km (design decision D1 trong
 * `apps/api/VEHICLE-MAINTENANCE-PLANS-DESIGN.md`) → UI không có field mileage.
 *
 * Backend CÓ lưu chi tiết xe (gói VIP) qua `details`:
 *  - Đọc: luôn trả đầy đủ, kể cả khi gói đã hết hạn (D7).
 *  - Ghi: `PATCH /api/v1/motorcycles/{id}/details` — sửa một phần, cần gói VIP.
 */

/**
 * Chi tiết xe gói VIP. Đúng tên cột BE trong bảng `motorcycles`
 * (migration `202606250048_maintenance_presets_and_plans.sql`).
 *
 * Ngày có dạng `YYYY-MM-DD`.
 */
export type { MotorcycleDetails };

/**
 * Patch partial-update cho `PATCH /api/v1/motorcycles/{id}/details`.
 *
 * - `undefined` (key bị bỏ qua) → giữ nguyên giá trị đang lưu.
 * - `null` → xoá giá trị (luôn được phép, kể cả khi hết gói — D14).
 * - Giá trị khác `null` → cần gói VIP hiệu lực.
 */
export type MotorcycleDetailsPatch = {
  [K in keyof MotorcycleDetails]?: MotorcycleDetails[K] | null;
};

export interface MotorcycleResponse {
  id: string;
  rider_id: string;
  brand_text: string;
  model_text: string;
  license_plate?: string;
  year?: number;
  notes?: string;
  /** Chi tiết xe gói VIP (luôn được trả về khi đã có dữ liệu). */
  details?: MotorcycleDetails;
  last_maintenance_at?: string;
  next_maintenance_at?: string;
  created_at: string;
  updated_at: string;
}

export interface MotorcycleInput {
  brand_text: string;
  model_text: string;
  license_plate?: string;
  year?: number;
  notes?: string;
}

const VEHICLE_IMAGE_DEFAULT =
  'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800';

/**
 * Map 1 record backend → UI Vehicle. Đảm bảo luôn có đủ field UI cần.
 */
export function toVehicle(record: MotorcycleResponse): Vehicle {
  const id = record.id;
  const brand = record.brand_text || 'Xe máy';
  const model = record.model_text || 'Xe';
  return {
    id,
    name: `${brand} ${model}`,
    brand,
    plate: record.license_plate ?? '',
    // Màu sắc nằm trong `details` (gói VIP). Chưa có dữ liệu → '—'.
    color: record.details?.color ?? '—',
    year: record.year ?? new Date().getFullYear(),
    lastMaintenance: record.last_maintenance_at ?? '',
    nextMaintenance: record.next_maintenance_at ?? '',
    image: VEHICLE_IMAGE_DEFAULT,
    ...(record.details && Object.keys(record.details).length > 0
      ? { details: record.details }
      : {}),
  };
}

/**
 * Map UI Vehicle create payload → backend input.
 * Caller chỉ cần cung cấp brand / model / plate / year / notes.
 */
export function fromVehicleInput(input: {
  brand: string;
  model: string;
  plate?: string;
  year?: number;
  notes?: string;
}): MotorcycleInput {
  return {
    brand_text: input.brand.trim() || 'Xe máy',
    model_text: input.model.trim() || 'Xe',
    ...(input.plate ? { license_plate: input.plate.trim() } : {}),
    ...(input.year ? { year: input.year } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
  };
}

export async function listMotorcycles(): Promise<Vehicle[]> {
  const res = await apiGet<{ items: MotorcycleResponse[] }>('/api/v1/motorcycles');
  return res.items.map(toVehicle);
}

export async function createMotorcycle(input: MotorcycleInput): Promise<Vehicle> {
  const record = await apiPost<MotorcycleResponse>('/api/v1/motorcycles', input);
  return toVehicle(record);
}

export async function updateMotorcycle(
  id: string,
  input: Partial<MotorcycleInput>,
): Promise<Vehicle> {
  const record = await apiPatch<MotorcycleResponse>(
    `/api/v1/motorcycles/${encodeURIComponent(id)}`,
    input,
  );
  return toVehicle(record);
}

/**
 * Cập nhật "hồ sơ xe đầy đủ" (gói VIP).
 *
 * Endpoint riêng `PATCH /api/v1/motorcycles/{id}/details` (design decision D13):
 * sửa một phần, không bao giờ đụng vào thông tin cơ bản của xe.
 *
 * BE route này KHÔNG yêu cầu `X-Idempotency-Key`.
 *
 * Lỗi có thể trả:
 *  - 403 `FORBIDDEN` + `details.reason = "plan_required"` khi gửi giá trị mới
 *    mà không có gói VIP.
 *  - 400 `INVALID_INPUT` khi sai định dạng / ngày ở tương lai.
 */
export async function updateMotorcycleDetails(
  id: string,
  patch: MotorcycleDetailsPatch,
): Promise<Vehicle> {
  const record = await apiPatch<MotorcycleResponse>(
    `/api/v1/motorcycles/${encodeURIComponent(id)}/details`,
    patch,
  );
  return toVehicle(record);
}

export async function archiveMotorcycle(id: string): Promise<void> {
  await apiDelete(`/api/v1/motorcycles/${encodeURIComponent(id)}`);
}
