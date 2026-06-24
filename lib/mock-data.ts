import type {
  Vehicle,
  ServiceRecord,
  Appointment,
  Mechanic,
} from "./types"

export const mockVehicles: Vehicle[] = [
  {
    id: "v1",
    name: "Honda Vision",
    brand: "Honda",
    plate: "59-H1 234.56",
    mileage: 18420,
    color: "Pearl White",
    year: 2023,
    lastMaintenance: "2026-03-12",
    nextMaintenance: "2026-07-12",
    image: "/honda-vision-white-scooter.jpg",
  },
  {
    id: "v2",
    name: "Yamaha Exciter 155",
    brand: "Yamaha",
    plate: "59-P2 678.90",
    mileage: 9230,
    color: "Racing Blue",
    year: 2024,
    lastMaintenance: "2026-04-02",
    nextMaintenance: "2026-08-02",
    image: "/yamaha-exciter-155-blue-motorcycle.jpg",
  },
  {
    id: "v3",
    name: "Honda Wave Alpha",
    brand: "Honda",
    plate: "59-F3 112.33",
    mileage: 42100,
    color: "Matte Black",
    year: 2021,
    lastMaintenance: "2026-02-20",
    nextMaintenance: "2026-06-28",
    image: "/honda-wave-alpha-black-motorcycle.jpg",
  },
]

export const mockServices: ServiceRecord[] = [
  {
    id: "s1",
    date: "2026-04-02",
    type: "Oil Change",
    vehicleName: "Yamaha Exciter 155",
    vehicleId: "v2",
    price: 180000,
    mechanic: "Tran Minh Quan",
    status: "completed",
    notes: "Synthetic 10W-40 oil replaced. Chain lubricated and tension adjusted.",
  },
  {
    id: "s2",
    date: "2026-03-12",
    type: "General Maintenance",
    vehicleName: "Honda Vision",
    vehicleId: "v1",
    price: 320000,
    mechanic: "Le Hoang Nam",
    status: "completed",
    notes: "Full inspection, brake fluid top-up, spark plug cleaned.",
  },
  {
    id: "s3",
    date: "2026-02-20",
    type: "Brake Inspection",
    vehicleName: "Honda Wave Alpha",
    vehicleId: "v3",
    price: 150000,
    mechanic: "Pham Van Hung",
    status: "completed",
    notes: "Front brake pads replaced. Rear brake adjusted.",
  },
  {
    id: "s4",
    date: "2026-01-15",
    type: "Tire Inspection",
    vehicleName: "Honda Vision",
    vehicleId: "v1",
    price: 90000,
    mechanic: "Tran Minh Quan",
    status: "completed",
    notes: "Rear tire pressure corrected, tread within safe range.",
  },
]

export const mockAppointments: Appointment[] = [
  {
    id: "a1",
    vehicleId: "v1",
    vehicleName: "Honda Vision",
    service: "Oil Change",
    date: "2026-07-12",
    time: "09:30",
    status: "confirmed",
  },
]

export const mockMechanics: Mechanic[] = [
  {
    id: "m1",
    name: "Tran Minh Quan",
    rating: 4.9,
    trips: 1240,
    vehicle: "Honda Winner X — Service Unit",
    phone: "+84 90 123 4567",
    avatar: "/vietnamese-male-mechanic-portrait.jpg",
    specialty: "Engine & Electrical",
  },
  {
    id: "m2",
    name: "Le Hoang Nam",
    rating: 4.8,
    trips: 980,
    vehicle: "Yamaha Sirius — Service Unit",
    phone: "+84 91 234 5678",
    avatar: "/vietnamese-mechanic-portrait-smiling.jpg",
    specialty: "Tires & Brakes",
  },
]

export const issueCategories = [
  { id: "engine", label: "Engine Problem", icon: "Cog" },
  { id: "tire", label: "Flat Tire", icon: "CircleDot" },
  { id: "battery", label: "Battery Issue", icon: "BatteryWarning" },
  { id: "fuel", label: "Out of Fuel", icon: "Fuel" },
  { id: "accident", label: "Accident Assistance", icon: "TriangleAlert" },
] as const

export const serviceTypes = [
  { id: "oil", label: "Oil Change", price: 180000, duration: "30 min" },
  { id: "brake", label: "Brake Inspection", price: 150000, duration: "45 min" },
  { id: "tire", label: "Tire Inspection", price: 90000, duration: "20 min" },
  {
    id: "general",
    label: "General Maintenance",
    price: 350000,
    duration: "90 min",
  },
] as const

export const timeSlots = [
  "08:00",
  "09:30",
  "11:00",
  "13:30",
  "15:00",
  "16:30",
  "18:00",
]

export function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount) + "₫"
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}
