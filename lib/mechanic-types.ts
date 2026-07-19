export type MechanicJobStatus =
  | "pending"
  | "in_progress"
  | "awaiting_parts"
  | "completed"

export type MechanicJobType =
  | "Oil Change"
  | "Brake Inspection"
  | "Tire Inspection"
  | "General Maintenance"
  | "Emergency Repair"
  | "Battery Replacement"
  | "Engine Repair"

export type MechanicShiftStatus = "working" | "off" | "available"

export interface MechanicProfile {
  id: string
  name: string
  avatar: string
  specialty: string
  experienceYears: number
  rating: number
  totalJobs: number
  certifications: string[]
  phone: string
}

export interface GarageInfo {
  id: string
  name: string
  address: string
  phone: string
}

export interface MechanicCustomer {
  id: string
  name: string
  phone: string
  avatar?: string
}

export interface MechanicVehicle {
  id: string
  customerId: string
  name: string
  brand: string
  plate: string
  mileage: number
}

export interface MechanicJob {
  id: string
  customer: MechanicCustomer
  vehicle: MechanicVehicle
  type: MechanicJobType
  symptom: string
  status: MechanicJobStatus
  scheduledDate: string // YYYY-MM-DD
  scheduledTime: string // HH:mm
  durationMin: number
  price: number
  notes?: string
  partsReplaced?: string[]
  completedAt?: string
}

export interface ScheduleSlot {
  date: string // YYYY-MM-DD
  time: string // HH:mm
  status: MechanicShiftStatus
  jobId?: string
}

export interface MechanicEarnings {
  thisWeek: number
  lastWeek: number
  thisMonth: number
}
