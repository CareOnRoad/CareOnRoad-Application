export type MechanicJobStatus =
  | 'pending'
  | 'in_progress'
  | 'awaiting_parts'
  | 'completed'
  | 'canceled';

/**
 * Filter chip cho jobs screen - mirror BE `mechanicJobStatuses` enum.
 *
 * UI status (`MechanicJobStatus`) gộp 8 BE states vào 5 giá trị cho card display.
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

/**
 * Tone hiển thị cho UI MechanicJobStatus.
 * - pending: amber (warning, chờ)
 * - in_progress: blue (active)
 * - awaiting_parts: red (blocked)
 * - completed: green (success)
 * - canceled: neutral (đã kết thúc nhưng không thành công)
 */
export type MechanicJobTone =
  | 'amber'
  | 'blue'
  | 'red'
  | 'green'
  | 'neutral';

export const JOB_STATUS_LABELS: Record<MechanicJobStatus, string> = {
  pending: 'Chờ xử lý',
  in_progress: 'Đang xử lý',
  awaiting_parts: 'Chờ phụ tùng',
  completed: 'Hoàn tất',
  canceled: 'Đã huỷ',
};

export const JOB_STATUS_TONE: Record<MechanicJobStatus, MechanicJobTone> = {
  pending: 'amber',
  in_progress: 'blue',
  awaiting_parts: 'red',
  completed: 'green',
  canceled: 'neutral',
};

/** Map tone → hex color (dùng cho badge text). */
export const JOB_STATUS_TONE_COLOR: Record<MechanicJobTone, string> = {
  amber: '#d97706',
  blue: '#1974f7',
  red: '#ed3f3a',
  green: '#145413',
  neutral: '#64748b',
};

export type MechanicJobType =
  | 'Thay nhớt'
  | 'Kiểm tra phanh'
  | 'Kiểm tra lốp'
  | 'Bảo dưỡng tổng quát'
  | 'Sửa chữa khẩn cấp'
  | 'Thay ắc quy'
  | 'Sửa chữa động cơ';

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
