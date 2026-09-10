import type {
  CreateRequestStatusHistory,
  CreateServiceRequest,
  RequestStatusHistory,
  ServiceRequest,
  ServiceRequestRepository
} from "../contracts/service-request.repository";

export class InMemoryServiceRequestRepository implements ServiceRequestRepository {
  constructor(
    private readonly requests: ServiceRequest[],
    private readonly history: RequestStatusHistory[]
  ) {}

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

  async listByRider(riderId: string): Promise<ServiceRequest[]> {
    return this.requests
      .filter((request) => request.riderId === riderId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .map(cloneRequest);
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
