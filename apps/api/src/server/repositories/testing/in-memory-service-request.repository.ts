import type {
  CreateRequestStatusHistory,
  CreateServiceRequest,
  RequestStatusHistory,
  ServiceRequest,
  ServiceRequestRepository
} from "../contracts/service-request.repository";
import { filterPage, type ListFilter } from "@/lib/list-pagination";

export class InMemoryServiceRequestRepository implements ServiceRequestRepository {
  constructor(
    private readonly requests: ServiceRequest[],
    private readonly history: RequestStatusHistory[]
  ) {}

  async startDispatchEpisode(input: { id: string; startRound: number; updatedAt: Date }): Promise<ServiceRequest> {
    const request = this.requests.find((row) => row.id === input.id);
    if (!request || (request.dispatchRetryCount ?? 0) >= 3) throw new Error("DISPATCH_RETRY_LIMIT_REACHED");
    Object.assign(request, { dispatchEpisodeStartRound: input.startRound, dispatchRetryCount: (request.dispatchRetryCount ?? 0) + 1, updatedAt: input.updatedAt });
    return cloneRequest(request);
  }

  async updateAppointment(input: Parameters<ServiceRequestRepository["updateAppointment"]>[0]) {
    const request = this.requests.find((item) => item.id === input.id);
    if (!request) throw new Error("SERVICE_REQUEST_NOT_FOUND");
    Object.assign(request, { serviceLocation: input.location, addressText: input.addressText,
      scheduledStartAt: input.scheduledStartAt, updatedAt: input.updatedAt });
    return cloneRequest(request);
  }

  async create(input: CreateServiceRequest): Promise<ServiceRequest> {
    if (this.requests.some((request) => request.requestCode === input.requestCode)) {
      throw new Error("SERVICE_REQUEST_CODE_EXISTS");
    }
    const request: ServiceRequest = {
      ...input,
      status: input.status ?? "submitted",
      priority: input.priority ?? "normal"
    };
    this.requests.push(request);
    return cloneRequest(request);
  }

  async listByRider(riderId: string, input: ListFilter = { limit: 20 }): Promise<ServiceRequest[]> {
    return filterPage(this.requests.filter((request) => request.riderId === riderId), input).map(cloneRequest);
  }

  async findById(id: string): Promise<ServiceRequest | undefined> {
    const request = this.requests.find((candidate) => candidate.id === id);
    return request ? cloneRequest(request) : undefined;
  }

  async findByIdForUpdate(id: string): Promise<ServiceRequest | undefined> {
    return this.findById(id);
  }

  async updateStatus(input: {
    id: string;
    status: ServiceRequest["status"];
    updatedAt: Date;
    canceledReason?: string;
    manualEscalationReason?: string;
  }): Promise<ServiceRequest | undefined> {
    const request = this.requests.find((candidate) => candidate.id === input.id);
    if (!request) {
      return undefined;
    }
    request.status = input.status;
    request.updatedAt = input.updatedAt;
    request.canceledReason = input.canceledReason;
    request.manualEscalationReason = input.manualEscalationReason;
    return cloneRequest(request);
  }

  async appendStatusHistory(input: CreateRequestStatusHistory): Promise<RequestStatusHistory> {
    const row: RequestStatusHistory = {
      ...input,
      createdAt: input.createdAt ?? new Date()
    };
    this.history.push(row);
    return cloneHistory(row);
  }

  async listStatusHistory(requestId: string): Promise<RequestStatusHistory[]> {
    return this.history
      .filter((item) => item.requestId === requestId)
      .sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime() ||
          right.id.localeCompare(left.id)
      )
      .map(cloneHistory);
  }

  async listCompletedLastUpdatedByMotorcycles(input: { motorcycleIds: string[] }): Promise<Map<string, Date>> {
    const result = new Map<string, Date>();
    for (const motorcycleId of input.motorcycleIds) {
      let last: Date | undefined;
      for (const request of this.requests) {
        if (request.motorcycleId !== motorcycleId || request.status !== "completed") continue;
        if (!last || request.updatedAt.getTime() > last.getTime()) {
          last = request.updatedAt;
        }
      }
      if (last) result.set(motorcycleId, last);
    }
    return result;
  }

  async listUpcomingMaintenanceByMotorcycles(input: {
    motorcycleIds: string[];
    activeStatuses: readonly ServiceRequest["status"][];
    now: Date;
  }): Promise<Map<string, Date>> {
    const result = new Map<string, Date>();
    const statuses = new Set(input.activeStatuses);
    for (const motorcycleId of input.motorcycleIds) {
      let earliest: Date | undefined;
      for (const request of this.requests) {
        if (request.motorcycleId !== motorcycleId) continue;
        if (request.serviceType !== "periodic_maintenance") continue;
        if (!statuses.has(request.status)) continue;
        if (!request.scheduledStartAt) continue;
        if (request.scheduledStartAt.getTime() <= input.now.getTime()) continue;
        if (!earliest || request.scheduledStartAt.getTime() < earliest.getTime()) {
          earliest = request.scheduledStartAt;
        }
      }
      if (earliest) result.set(motorcycleId, earliest);
    }
    return result;
  }
}

function cloneRequest(request: ServiceRequest): ServiceRequest {
  return {
    ...request,
    serviceLocation: request.serviceLocation ? { ...request.serviceLocation } : undefined,
    scheduledStartAt: request.scheduledStartAt
      ? new Date(request.scheduledStartAt)
      : undefined,
    createdAt: new Date(request.createdAt),
    updatedAt: new Date(request.updatedAt)
  };
}

function cloneHistory(history: RequestStatusHistory): RequestStatusHistory {
  return {
    ...history,
    createdAt: new Date(history.createdAt)
  };
}
