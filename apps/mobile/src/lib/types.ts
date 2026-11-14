export type ScreenId =
  | 'home'
  | 'vehicles'
  | 'rescue'
  | 'schedule'
  | 'profile'
  | 'tracking'
  | 'history';

export type TabId = 'home' | 'vehicles' | 'rescue' | 'schedule' | 'profile';

export interface Vehicle {
  id: string;
  name: string;
  brand: string;
  plate: string;
  /** Màu sắc (gói VIP). '—' khi chưa có dữ liệu. */
  color: string;
  year: number;
  lastMaintenance: string;
  nextMaintenance: string;
  image: string;
  /** Hồ sơ xe đầy đủ (gói VIP). Luôn có khi rider đã lưu. */
  details?: MotorcycleDetails;
}

/**
 * Chi tiết xe gói VIP. Đúng tên cột BE trong bảng `motorcycles`
 * (migration `202606250048_maintenance_presets_and_plans.sql`).
 *
 * Ngày có dạng `YYYY-MM-DD`.
 */
export interface MotorcycleDetails {
  color?: string;
  frame_number?: string;
  engine_number?: string;
  purchase_date?: string;
  purchase_price_vnd?: number;
  insurance_provider?: string;
  insurance_policy_number?: string;
  insurance_expires_on?: string;
  warranty_expires_on?: string;
  preferred_service_center?: string;
}

export interface ServiceRecord {
  id: string;
  date: string;
  type: string;
  vehicleName: string;
  vehicleId: string;
  price: number;
  mechanic: string;
  status: 'completed' | 'upcoming';
  notes?: string;
}

export interface Appointment {
  id: string;
  vehicleId: string;
  vehicleName: string;
  service: string;
  date: string;
  time: string;
  status: 'confirmed' | 'pending';
}

export interface CanceledAppointment {
  id: string;
  vehicleName: string;
  service: string;
  date: string;
  time: string;
  canceledAt: string;
  reason: string;
}

export interface EmergencyCall {
  id: string;
  vehicleName: string;
  issue: string;
  damageDescription: string;
  repairs: string;
  date: string;
  time: string;
  mechanicName: string;
  price: number;
  status: 'completed' | 'cancelled';
  notes?: string;
}

export interface Mechanic {
  id: string;
  name: string;
  rating: number;
  trips: number;
  vehicle: string;
  phone: string;
  avatar: string;
  specialty: string;
  certifications: string[];
  experience: string;
}

export type RescueStatus =
  | 'idle'
  | 'searching'
  | 'assigned'
  | 'enroute'
  | 'arrived'
  | 'completed';

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
}
