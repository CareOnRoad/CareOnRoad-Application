export type MechanicJobStatus =
  | 'pending'
  | 'in_progress'
  | 'awaiting_parts'
  | 'completed';

/**
 * Filter chip cho jobs screen - mirror BE `mechanicJobStatuses` enum.
 *
 * UI status (`MechanicJobStatus`) gộp 8 BE states vào 4 giá trị cho card display.
 * `MechanicJobFilter` cho phép filter chi tiết theo BE state raw.
 */
export type MechanicJobFilter =
  | 'all'
  | 'accepted'
  | 'en_route'
  | 'on_site'
  | 'diagnosis'
  | 'quoted'
  | 'awaiting_payment'
  | 'in_progress'
  | 'completed'
  | 'canceled';

export const MECHANIC_JOB_FILTERS: readonly {
  id: MechanicJobFilter;
  label: string;
}[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'accepted', label: 'Chờ nhận' },
  { id: 'en_route', label: 'Đang đến' },
  { id: 'on_site', label: 'Đã tới' },
  { id: 'diagnosis', label: 'Chẩn đoán' },
  { id: 'quoted', label: 'Đã báo giá' },
  { id: 'awaiting_payment', label: 'Chờ thanh toán' },
  { id: 'in_progress', label: 'Đang sửa' },
  { id: 'completed', label: 'Hoàn tất' },
  { id: 'canceled', label: 'Đã huỷ' },
];

export type MechanicJobType =
  | 'Oil Change'
  | 'Brake Inspection'
  | 'Tire Inspection'
  | 'General Maintenance'
  | 'Emergency Repair'
  | 'Battery Replacement'
  | 'Engine Repair';

export type MechanicShiftStatus = 'working' | 'off' | 'available';

export interface MechanicProfile {
  id: string;
  name: string;
  avatar: string;
  specialty: string;
  experienceYears: number;
  rating: number;
  totalJobs: number;
  certifications: string[];
  phone: string;
}

export interface GarageInfo {
  id: string;
  name: string;
  address: string;
  phone: string;
}

export interface MechanicCustomer {
  id: string;
  name: string;
  phone: string;
  avatar?: string;
}

export interface MechanicVehicle {
  id: string;
  customerId: string;
  name: string;
  brand: string;
  plate: string;
  mileage: number;
}

export interface MechanicJob {
  id: string;
  customer: MechanicCustomer;
  vehicle: MechanicVehicle;
  type: MechanicJobType;
  symptom: string;
  status: MechanicJobStatus;
  scheduledDate: string;
  scheduledTime: string;
  durationMin: number;
  price: number;
  notes?: string;
  partsReplaced?: string[];
  completedAt?: string;
}

export interface ScheduleSlot {
  date: string;
  time: string;
  status: MechanicShiftStatus;
  jobId?: string;
}

export interface MechanicEarnings {
  thisWeek: number;
  lastWeek: number;
  thisMonth: number;
}

export interface JobUpdatePayload {
  price: number;
  notes?: string;
  partsReplaced?: string[];
}
