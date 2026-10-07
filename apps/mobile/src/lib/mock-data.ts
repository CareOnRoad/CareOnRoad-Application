import type {
  Vehicle,
  ServiceRecord,
  Appointment,
  Mechanic,
  CanceledAppointment,
  EmergencyCall,
} from './types';

export const mockVehicles: Vehicle[] = [
  {
    id: 'v1',
    name: 'Honda Vision',
    brand: 'Honda',
    plate: '59-H1 234.56',
    mileage: 18420,
    color: 'Trắng ngọc trai',
    year: 2023,
    lastMaintenance: '2026-03-12',
    nextMaintenance: '2026-07-12',
    image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800',
  },
  {
    id: 'v2',
    name: 'Yamaha Exciter 155',
    brand: 'Yamaha',
    plate: '59-P2 678.90',
    mileage: 9230,
    color: 'Xanh đua',
    year: 2024,
    lastMaintenance: '2026-04-02',
    nextMaintenance: '2026-08-02',
    image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800',
  },
  {
    id: 'v3',
    name: 'Honda Wave Alpha',
    brand: 'Honda',
    plate: '59-F3 112.33',
    mileage: 42100,
    color: 'Đen nhám',
    year: 2021,
    lastMaintenance: '2026-02-20',
    nextMaintenance: '2026-06-28',
    image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800',
  },
];

export const mockServices: ServiceRecord[] = [
  {
    id: 's1',
    date: '2026-04-02',
    type: 'Thay nhớt',
    vehicleName: 'Yamaha Exciter 155',
    vehicleId: 'v2',
    price: 180000,
    mechanic: 'Tran Minh Quan',
    status: 'completed',
    notes: 'Đã thay nhớt tổng hợp 10W-40. Tra dầu và chỉnh độ căng sên.',
  },
  {
    id: 's2',
    date: '2026-03-12',
    type: 'Bảo dưỡng tổng quát',
    vehicleName: 'Honda Vision',
    vehicleId: 'v1',
    price: 320000,
    mechanic: 'Le Hoang Nam',
    status: 'completed',
    notes: 'Kiểm tra toàn bộ xe, châm thêm dầu phanh, vệ sinh bugi.',
  },
  {
    id: 's3',
    date: '2026-02-20',
    type: 'Kiểm tra phanh',
    vehicleName: 'Honda Wave Alpha',
    vehicleId: 'v3',
    price: 150000,
    mechanic: 'Pham Van Hung',
    status: 'completed',
    notes: 'Thay má phanh trước, điều chỉnh phanh sau.',
  },
  {
    id: 's4',
    date: '2026-01-15',
    type: 'Kiểm tra lốp',
    vehicleName: 'Honda Vision',
    vehicleId: 'v1',
    price: 90000,
    mechanic: 'Tran Minh Quan',
    status: 'completed',
    notes: 'Chỉnh lại áp suất lốp sau, mặt lốp còn trong phạm vi an toàn.',
  },
];

export const mockAppointments: Appointment[] = [
  {
    id: 'a1',
    vehicleId: 'v1',
    vehicleName: 'Honda Vision',
    service: 'Thay nhớt',
    date: '2026-07-12',
    time: '09:30',
    status: 'confirmed',
  },
];

export const mockCanceledAppointments: CanceledAppointment[] = [
  {
    id: 'ca1',
    vehicleName: 'Yamaha Exciter 155',
    service: 'Kiểm tra lốp',
    date: '2026-06-20',
    time: '14:00',
    canceledAt: '2026-06-18T10:24:00',
    reason: 'Tôi có việc đột xuất',
  },
  {
    id: 'ca2',
    vehicleName: 'Honda Wave Alpha',
    service: 'Kiểm tra phanh',
    date: '2026-05-08',
    time: '10:30',
    canceledAt: '2026-05-05T16:02:00',
    reason: 'Tôi muốn thay đổi lịch hẹn',
  },
];

export const mockEmergencyCalls: EmergencyCall[] = [
  {
    id: 'e1',
    vehicleName: 'Honda Vision',
    issue: 'Thủng / xẹp lốp',
    damageDescription:
      'Lốp trước bị đinh đâm, xẹp hoàn toàn khi đang chạy trên đường Nguyễn Trãi. Vành nhôm có vết trầy nhẹ ở phần mép ngoài, không bị cong.',
    repairs:
      'Thay lốp trước mới (Michelin City Grip 110/70-13), kiểm tra áp suất lốp sau, căn chỉnh vành nhôm và cân bằng bánh trước.',
    date: '2026-07-02',
    time: '18:45',
    mechanicName: 'Tran Minh Quan',
    price: 420000,
    status: 'completed',
    notes: 'Khách hàng nên kiểm tra áp suất lốp mỗi 2 tuần để tránh tái diễn.',
  },
  {
    id: 'e2',
    vehicleName: 'Yamaha Exciter 155',
    issue: 'Sự cố ắc quy',
    damageDescription:
      'Xe không khởi động được tại bãi giữ xe Bitexco. Bình ắc quy yếu, điện áp đo được chỉ còn 9.4V. Cọc bình có dấu hiệu oxi hóa.',
    repairs:
      'Thay bình ắc quy mới (Yuasa YT12A-BS, 12V-10Ah), vệ sinh cọc bình, kiểm tra hệ thống sạc và máy phát điện.',
    date: '2026-06-25',
    time: '09:15',
    mechanicName: 'Le Hoang Nam',
    price: 680000,
    status: 'completed',
    notes: 'Bình cũ đã dùng 3 năm, đề xuất khách hàng kiểm tra bình định kỳ mỗi 6 tháng.',
  },
  {
    id: 'e3',
    vehicleName: 'Honda Wave Alpha',
    issue: 'Sự cố động cơ',
    damageDescription:
      'Động cơ phát ra tiếng kêu lạ từ phía xylanh khi tăng ga, kèm khói trắng đậm. Kiểm tra thấy gioăng quy lát bị rách.',
    repairs:
      'Thay gioăng quy lát mới, vệ sinh buồng đốt, thay dầu nhớt motul 5100 và lọc dầu.',
    date: '2026-06-12',
    time: '21:20',
    mechanicName: 'Tran Minh Quan',
    price: 950000,
    status: 'completed',
  },
  {
    id: 'e4',
    vehicleName: 'Honda Vision',
    issue: 'Hết xăng',
    damageDescription: 'Hết xăng giữa đường tại khu vực Bình Thạnh.',
    repairs: 'Cung cấp 2 lít xăng RON 95 tại chỗ, đảm bảo xe khởi động và vận hành ổn định.',
    date: '2026-05-30',
    time: '22:10',
    mechanicName: 'Le Hoang Nam',
    price: 60000,
    status: 'completed',
  },
];

export const mockMechanics: Mechanic[] = [
  {
    id: 'm1',
    name: 'Tran Minh Quan',
    rating: 4.9,
    trips: 1240,
    vehicle: 'Honda Winner X — Service Unit',
    phone: '+84 90 123 4567',
    avatar: 'https://i.pravatar.cc/200?img=12',
    specialty: 'Động cơ & Điện',
    certifications: [
      'Honda Certified Technician (Level 3)',
      'ASE Engine Repair Certification',
      'Motorcycle Electrical Systems Diploma',
    ],
    experience: '8 năm kinh nghiệm',
  },
  {
    id: 'm2',
    name: 'Le Hoang Nam',
    rating: 4.8,
    trips: 980,
    vehicle: 'Yamaha Sirius — Service Unit',
    phone: '+84 91 234 5678',
    avatar: 'https://i.pravatar.cc/200?img=33',
    specialty: 'Lốp & Phanh',
    certifications: [
      'Yamaha Master Technician',
      'ASE Brakes Certification',
      'Wheel Alignment Specialist Certificate',
    ],
    experience: '6 năm kinh nghiệm',
  },
];

export const issueCategories = [
  { id: 'engine', label: 'Sự cố động cơ', icon: 'Cog' },
  { id: 'tire', label: 'Thủng / xẹp lốp', icon: 'CircleDot' },
  { id: 'battery', label: 'Sự cố ắc quy', icon: 'BatteryWarning' },
  { id: 'fuel', label: 'Hết xăng', icon: 'Fuel' },
  { id: 'accident', label: 'Hỗ trợ tai nạn', icon: 'TriangleAlert' },
] as const;

export const serviceTypes = [
  { id: 'oil', label: 'Thay nhớt', price: 180000, duration: '30 phút' },
  { id: 'brake', label: 'Kiểm tra phanh', price: 150000, duration: '45 phút' },
  { id: 'tire', label: 'Kiểm tra lốp', price: 90000, duration: '20 phút' },
  { id: 'general', label: 'Bảo dưỡng tổng quát', price: 350000, duration: '90 phút' },
] as const;

export const timeSlots = [
  '08:00',
  '09:30',
  '11:00',
  '13:30',
  '15:00',
  '16:30',
  '18:00',
];

export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + '₫';
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
