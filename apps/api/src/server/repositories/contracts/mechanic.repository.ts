import type { ServiceType } from "@/features/motorcycles/motorcycle.schemas";

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

import type {
  AssignmentStatus
} from "./assignment.repository";

export type MechanicProfileStatus =
  | "pending"
  | "active"
  | "rejected"
  | "suspended"
  | "banned";

export type MechanicLocationFreshness = "fresh" | "stale" | "missing";
export type MechanicWorkState = "idle" | "active_assignment";

export type AdminMechanicCursor = {
  timestamp: Date;
  id: string;
};

export type MechanicProfile = {
  userId: string;
  profileStatus: MechanicProfileStatus;
  isAvailable: boolean;
  serviceRadiusKm: number;
  latestLocation?: GeoPoint;
  locationUpdatedAt?: Date;
  availabilityUpdatedAt: Date;
  ratingAvg: number;
  ratingCount: number;
  serviceTypes: ServiceType[];
  createdAt: Date;
  updatedAt: Date;
};

export type CreateMechanicProfile = {
  userId: string;
  profileStatus?: MechanicProfileStatus;
  isAvailable?: boolean;
  serviceRadiusKm: number;
  serviceTypes?: ServiceType[];
  availabilityUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type UpdateMechanicProfileSettings = {
  userId: string;
  serviceRadiusKm?: number;
  serviceTypes?: ServiceType[];
  updatedAt: Date;
};

export type AdminMechanicListInput = {
  limit: number;
  now: Date;
  cursor?: AdminMechanicCursor;
  profileStatus?: MechanicProfileStatus;
  serviceType?: ServiceType;
  isAvailable?: boolean;
  locationFreshness?: MechanicLocationFreshness;
  workState?: MechanicWorkState;
};

export type AdminMechanicSummary = MechanicProfile & {
  hasActiveAssignment: boolean;
};

export type AdminMechanicPage = {
  items: AdminMechanicSummary[];
  nextCursor?: AdminMechanicCursor;
};

export type AdminMechanicWorkHistoryItem = {
  id: string;
  requestId: string;
  status: AssignmentStatus;
  acceptedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  canceledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminMechanicWorkHistoryPage = {
  items: AdminMechanicWorkHistoryItem[];
  nextCursor?: AdminMechanicCursor;
};

export type AdminMechanicPerformance = {
  totalAssignments: number;
  activeAssignments: number;
  completedAssignments: number;
  canceledAssignments: number;
  ratingAvg: number;
  ratingCount: number;
};

export interface MechanicRepository {
  createProfile(input: CreateMechanicProfile): Promise<MechanicProfile>;
  findProfileByUserId(userId: string): Promise<MechanicProfile | undefined>;
  findProfileByUserIdForUpdate(userId: string): Promise<MechanicProfile | undefined>;
  updateSettings(input: UpdateMechanicProfileSettings): Promise<MechanicProfile | undefined>;
  updateAvailability(
    userId: string,
    isAvailable: boolean,
    updatedAt: Date
  ): Promise<MechanicProfile | undefined>;
  updateLocation(
    userId: string,
    location: GeoPoint,
    updatedAt: Date
  ): Promise<MechanicProfile | undefined>;
  listAdminProfiles(input: AdminMechanicListInput): Promise<AdminMechanicPage>;
  updateProfileStatus(
    userId: string,
    profileStatus: MechanicProfileStatus,
    updatedAt: Date
  ): Promise<MechanicProfile | undefined>;
  listAdminWorkHistory(input: {
    mechanicId: string;
    limit: number;
    cursor?: AdminMechanicCursor;
  }): Promise<AdminMechanicWorkHistoryPage>;
  getAdminPerformance(
    mechanicId: string
  ): Promise<AdminMechanicPerformance | undefined>;
}
