import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import type { Vehicle } from '@/lib/types';

/**
 * Service wrapper cho /api/v1/motorcycles.
 *
 * Backend schema (snake_case) → UI Vehicle (camelCase + derived fields).
 *
 * Backend giờ trả maintenance dates (`last_maintenance_at`, `next_maintenance_at`)
 * derive từ `service_requests` (completed + upcoming) và `reminder_rules`.
 * Map thẳng vào UI Vehicle.lastMaintenance / nextMaintenance.
 *
 * Backend vẫn không lưu mileage / image → giữ giá trị default an toàn khi map
 * sang UI để không phá các trang đang dùng Vehicle type.
 */

export interface MotorcycleResponse {
  id: string;
  rider_id: string;
  brand_text: string;
  model_text: string;
  license_plate?: string;
  year?: number;
  notes?: string;
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
    mileage: 0,
    color: '—',
    year: record.year ?? new Date().getFullYear(),
    lastMaintenance: record.last_maintenance_at?.slice(0, 10) ?? '',
    nextMaintenance: record.next_maintenance_at?.slice(0, 10) ?? '',
    image: VEHICLE_IMAGE_DEFAULT,
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

export async function archiveMotorcycle(id: string): Promise<void> {
  await apiDelete(`/api/v1/motorcycles/${encodeURIComponent(id)}`);
}
