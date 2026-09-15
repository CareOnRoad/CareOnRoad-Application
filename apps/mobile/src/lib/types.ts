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
  mileage: number;
  color: string;
  year: number;
  lastMaintenance: string;
  nextMaintenance: string;
  image: string;
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
