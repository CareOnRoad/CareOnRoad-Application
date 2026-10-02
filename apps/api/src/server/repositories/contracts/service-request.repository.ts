import type { ServiceType } from "@/features/motorcycles/motorcycle.schemas";
import type { GeoPoint } from "./mechanic.repository";
import type { JsonObject } from "./idempotency.repository";
import type { ListFilter } from "@/lib/list-pagination";

export type FulfillmentMode = "immediate_location" | "scheduled_visit";
export type RequestStatus =
  | "submitted"
  | "dispatching"
  | "offered"
  | "assigned"
  | "mechanic_en_route"
  | "in_service"
  | "awaiting_quote_approval"
  | "awaiting_payment"
  | "completed"
  | "manual_escalation"
  | "canceled";
export type RequestPriority = "normal" | "high" | "emergency";

export type ServiceRequest = {
  id: string;
  requestCode: string;
  riderId: string;
  motorcycleId: string;
  serviceType: ServiceType;
  fulfillmentMode?: FulfillmentMode;
  problemDescription: string;
  status: RequestStatus;
  priority: RequestPriority;
  serviceLocation?: GeoPoint;
  addressText?: string;
  scheduledStartAt?: Date;
  safetyAnswers?: JsonObject;
  maintenanceNotes?: string;
  manualEscalationReason?: string;
  dispatchEpisodeStartRound?: number;
  dispatchRetryCount?: number;
  canceledReason?: string;
  reminderId?: string;
  reminderContextId?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateServiceRequest = Omit<ServiceRequest, "status" | "priority"> & {
  status?: RequestStatus;
  priority?: RequestPriority;
};

export type RequestStatusHistory = {
  id: string;
  requestId: string;
  fromStatus?: RequestStatus;
  toStatus: RequestStatus;
  actorId?: string;
  reason?: string;
  createdAt: Date;
};

export type CreateRequestStatusHistory = Omit<RequestStatusHistory, "createdAt"> & {
  createdAt?: Date;
};

export interface ServiceRequestRepository {
  startDispatchEpisode(input: { id: string; startRound: number; updatedAt: Date }): Promise<ServiceRequest>;
  updateAppointment(input: { id: string; location: GeoPoint; addressText?: string; scheduledStartAt?: Date; updatedAt: Date }): Promise<ServiceRequest>;
  create(input: CreateServiceRequest): Promise<ServiceRequest>;
  listByRider(riderId: string, input?: ListFilter): Promise<ServiceRequest[]>;
  findById(id: string): Promise<ServiceRequest | undefined>;
  findByIdForUpdate(id: string): Promise<ServiceRequest | undefined>;
  updateStatus(input: {
    id: string;
    status: RequestStatus;
    updatedAt: Date;
    canceledReason?: string;
    manualEscalationReason?: string;
  }): Promise<ServiceRequest | undefined>;
  appendStatusHistory(input: CreateRequestStatusHistory): Promise<RequestStatusHistory>;
  listStatusHistory(requestId: string): Promise<RequestStatusHistory[]>;
}
