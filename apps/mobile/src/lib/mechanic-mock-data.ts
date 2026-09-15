import type {
  MechanicJob,
  MechanicProfile,
  GarageInfo,
  ScheduleSlot,
  MechanicEarnings,
} from './mechanic-types';

const TODAY = '2026-07-19';

export const mockMechanicProfile: MechanicProfile = {
  id: 'me1',
  name: 'Tran Minh Quan',
  avatar: 'https://i.pravatar.cc/200?img=12',
  specialty: 'Engine & Electrical',
  experienceYears: 8,
  rating: 4.9,
  totalJobs: 248,
  certifications: [
    'Honda Certified Technician (Level 3)',
    'ASE Engine Repair Certification',
    'Motorcycle Electrical Systems Diploma',
  ],
  phone: '+84 90 123 4567',
};

export const mockGarage: GarageInfo = {
  id: 'g1',
  name: "Quan's Garage",
  address: '142 Le Hong Phong, District 5, HCMC',
  phone: '+84 28 1234 5678',
};

export const mockMechanicJobs: MechanicJob[] = [
  {
    id: 'j1',
    customer: {
      id: 'c1',
      name: 'Nguyen Van An',
      phone: '+84 90 555 1234',
      avatar: 'https://i.pravatar.cc/200?img=15',
    },
    vehicle: {
      id: 'v1',
      customerId: 'c1',
      name: 'Honda Vision',
      brand: 'Honda',
      plate: '59-H1 234.56',
      mileage: 18420,
    },
    type: 'Oil Change',
    symptom: 'Routine oil change at 18,000 km',
    status: 'pending',
    scheduledDate: TODAY,
    scheduledTime: '09:30',
    durationMin: 30,
    price: 180000,
  },
  {
    id: 'j2',
    customer: {
      id: 'c2',
      name: 'Pham Thi Mai',
      phone: '+84 93 222 8899',
    },
    vehicle: {
      id: 'v2',
      customerId: 'c2',
      name: 'Yamaha Exciter 155',
      brand: 'Yamaha',
      plate: '59-P2 678.90',
      mileage: 9230,
    },
    type: 'Brake Inspection',
    symptom: 'Front brake squeaking when braking hard',
    status: 'in_progress',
    scheduledDate: TODAY,
    scheduledTime: '10:30',
    durationMin: 45,
    price: 150000,
    notes: 'Customer is waiting in lounge',
  },
  {
    id: 'j3',
    customer: {
      id: 'c3',
      name: 'Le Hoang Nam',
      phone: '+84 91 234 5678',
    },
    vehicle: {
      id: 'v3',
      customerId: 'c3',
      name: 'Honda Wave Alpha',
      brand: 'Honda',
      plate: '59-F3 112.33',
      mileage: 42100,
    },
    type: 'Battery Replacement',
    symptom: 'Bike will not start, battery dead at 9.4V',
    status: 'awaiting_parts',
    scheduledDate: TODAY,
    scheduledTime: '13:30',
    durationMin: 60,
    price: 680000,
    notes: 'Waiting for Yuasa YT12A-BS from supplier',
  },
  {
    id: 'j4',
    customer: {
      id: 'c4',
      name: 'Vu Thi Lan',
      phone: '+84 97 888 1111',
    },
    vehicle: {
      id: 'v4',
      customerId: 'c4',
      name: 'Honda SH Mode',
      brand: 'Honda',
      plate: '59-X9 456.78',
      mileage: 31200,
    },
    type: 'General Maintenance',
    symptom: 'Full inspection before long trip',
    status: 'pending',
    scheduledDate: TODAY,
    scheduledTime: '15:00',
    durationMin: 90,
    price: 350000,
  },
  {
    id: 'j5',
    customer: {
      id: 'c5',
      name: 'Do Minh Tuan',
      phone: '+84 96 444 2233',
    },
    vehicle: {
      id: 'v5',
      customerId: 'c5',
      name: 'Suzuki Raider',
      brand: 'Suzuki',
      plate: '59-B7 321.98',
      mileage: 28100,
    },
    type: 'Tire Inspection',
    symptom: 'Rear tire worn, needs replacement check',
    status: 'completed',
    scheduledDate: TODAY,
    scheduledTime: '08:00',
    durationMin: 20,
    price: 90000,
    notes: 'Tire still within safe range, advised customer to come back in 1,000 km',
    partsReplaced: [],
    completedAt: `${TODAY}T08:35:00`,
  },
  {
    id: 'j6',
    customer: {
      id: 'c6',
      name: 'Bui Quoc Bao',
      phone: '+84 98 777 3344',
    },
    vehicle: {
      id: 'v6',
      customerId: 'c6',
      name: 'Yamaha NVX',
      brand: 'Yamaha',
      plate: '59-K2 998.11',
      mileage: 15600,
    },
    type: 'Emergency Repair',
    symptom: 'Flat tire on the road, mobile rescue request',
    status: 'pending',
    scheduledDate: TODAY,
    scheduledTime: '16:30',
    durationMin: 40,
    price: 320000,
  },
  {
    id: 'j7',
    customer: {
      id: 'c7',
      name: 'Hoang Anh Thu',
      phone: '+84 95 333 5566',
    },
    vehicle: {
      id: 'v7',
      customerId: 'c7',
      name: 'Honda Airblade',
      brand: 'Honda',
      plate: '59-M5 712.34',
      mileage: 22100,
    },
    type: 'Oil Change',
    symptom: 'Routine oil change',
    status: 'completed',
    scheduledDate: '2026-07-18',
    scheduledTime: '14:00',
    durationMin: 30,
    price: 180000,
    completedAt: '2026-07-18T14:35:00',
  },
  {
    id: 'j8',
    customer: {
      id: 'c8',
      name: 'Nguyen Thi Hoa',
      phone: '+84 94 666 7788',
    },
    vehicle: {
      id: 'v8',
      customerId: 'c8',
      name: 'Honda Lead',
      brand: 'Honda',
      plate: '59-L1 556.22',
      mileage: 33800,
    },
    type: 'Engine Repair',
    symptom: 'Engine knocking sound, white smoke from exhaust',
    status: 'completed',
    scheduledDate: '2026-07-17',
    scheduledTime: '10:00',
    durationMin: 120,
    price: 950000,
    notes: 'Replaced cylinder head gasket, cleaned combustion chamber',
    partsReplaced: ['Cylinder head gasket', 'Engine oil Motul 5100', 'Oil filter'],
    completedAt: '2026-07-17T12:15:00',
  },
  {
    id: 'j9',
    customer: {
      id: 'c9',
      name: 'Phan Van Duc',
      phone: '+84 92 999 0011',
    },
    vehicle: {
      id: 'v9',
      customerId: 'c9',
      name: 'Yamaha Grande',
      brand: 'Yamaha',
      plate: '59-N4 332.55',
      mileage: 11700,
    },
    type: 'General Maintenance',
    symptom: 'First service after 5,000 km',
    status: 'pending',
    scheduledDate: '2026-07-20',
    scheduledTime: '09:30',
    durationMin: 60,
    price: 280000,
  },
];

const SLOT_TIMES = ['08:00', '09:30', '11:00', '13:30', '15:00', '16:30', '18:00'];

const WEEK_DATES = [
  '2026-07-13',
  '2026-07-14',
  '2026-07-15',
  '2026-07-16',
  '2026-07-17',
  '2026-07-18',
  '2026-07-19',
];

export const mockScheduleSlots: ScheduleSlot[] = WEEK_DATES.flatMap((date) =>
  SLOT_TIMES.map((time) => {
    const matchingJob = mockMechanicJobs.find(
      (j) => j.scheduledDate === date && j.scheduledTime === time,
    );
    const isSunday = date === '2026-07-19';
    const isSaturday = date === '2026-07-18';
    let status: ScheduleSlot['status'] = 'available';
    if (matchingJob) {
      status =
        matchingJob.status === 'completed'
          ? 'working'
          : matchingJob.status === 'awaiting_parts'
            ? 'available'
            : 'working';
    } else if (isSunday) {
      status = time === '18:00' ? 'off' : 'available';
    } else if (isSaturday) {
      status = time >= '13:30' ? 'off' : 'available';
    } else {
      status = time === '18:00' ? 'off' : 'available';
    }
    return {
      date,
      time,
      status,
      jobId: matchingJob?.id,
    };
  }),
);

export const mockEarnings: MechanicEarnings = {
  thisWeek: 4280000,
  lastWeek: 3650000,
  thisMonth: 15680000,
};
