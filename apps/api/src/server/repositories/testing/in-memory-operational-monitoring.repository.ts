import type { DispatchRound } from "../contracts/dispatch.repository";
import type { OutboxEvent } from "../contracts/outbox.repository";
import type { PaymentOrder } from "../contracts/payment.repository";
import type { ServiceRequest } from "../contracts/service-request.repository";
import type {
  AppendWorkerRun,
  DeadLetterItem,
  NeedsReviewPaymentItem,
  OperationalMonitoringRepository,
  OperationalPageInput,
  StuckDispatchItem,
  WorkerRunRecord
} from "../contracts/operational-monitoring.repository";

export class InMemoryOperationalMonitoringRepository implements OperationalMonitoringRepository {
  constructor(private readonly state: {
    outboxEvents: OutboxEvent[]; paymentOrders: PaymentOrder[]; serviceRequests: ServiceRequest[];
    dispatchRounds: DispatchRound[]; workerRuns: WorkerRunRecord[];
  }) {}

  async listDeadLetters(input: OperationalPageInput): Promise<DeadLetterItem[]> {
    return page(this.state.outboxEvents.filter((x) => x.status === "dead_letter").map((x) => ({
      id: x.id, topic: x.topic, aggregateType: x.aggregateType, aggregateId: x.aggregateId,
      attemptCount: x.attemptCount, ...(x.lastErrorCode ? { lastErrorCode: x.lastErrorCode } : {}),
      createdAt: x.createdAt
    })), input, (x) => x.createdAt);
  }

  async listNeedsReviewPayments(input: OperationalPageInput): Promise<NeedsReviewPaymentItem[]> {
    return page(this.state.paymentOrders.filter((x) => x.status === "needs_review").map((x) => ({
      id: x.id, requestId: x.requestId, assignmentId: x.assignmentId,
      status: "needs_review" as const, updatedAt: x.updatedAt
    })), input, (x) => x.updatedAt);
  }

  async listStuckDispatch(input: OperationalPageInput & { staleBefore: Date; now: Date }): Promise<StuckDispatchItem[]> {
    const active = new Set(this.state.dispatchRounds.filter((x) => x.status === "active" && x.expiresAt > input.now).map((x) => x.requestId));
    return page(this.state.serviceRequests.filter((x) =>
      (((x.status === "dispatching" || x.status === "offered") && x.updatedAt < input.staleBefore) ||
        (x.status === "submitted" && x.serviceType === "periodic_maintenance" && !x.serviceLocation)) && !active.has(x.id)
    ).map((x) => ({ id: x.id, requestCode: x.requestCode, status: x.status as StuckDispatchItem["status"], updatedAt: x.updatedAt,
      ...(!x.serviceLocation ? { reasonCode: "missing_location" as const } : {}) })), input, (x) => x.updatedAt);
  }

  async listWorkerRuns(input: OperationalPageInput & { workerName?: string }): Promise<WorkerRunRecord[]> {
    return page(this.state.workerRuns.filter(row => !input.workerName || row.workerName === input.workerName), input, (x) => x.completedAt).map(cloneRun);
  }

  async appendWorkerRun(input: AppendWorkerRun): Promise<WorkerRunRecord> {
    const record: WorkerRunRecord = { ...input, createdAt: input.createdAt ?? input.completedAt };
    this.state.workerRuns.push(record);
    return cloneRun(record);
  }
}

function page<T extends { id: string }>(items: T[], input: OperationalPageInput, time: (item: T) => Date): T[] {
  return items.filter((item) => !input.cursor || time(item) < input.cursor.createdAt ||
    (time(item).getTime() === input.cursor.createdAt.getTime() && item.id < input.cursor.id))
    .sort((a, b) => time(b).getTime() - time(a).getTime() || b.id.localeCompare(a.id))
    .slice(0, input.limit);
}

function cloneRun(record: WorkerRunRecord): WorkerRunRecord {
  return { ...record, startedAt: new Date(record.startedAt), completedAt: new Date(record.completedAt), createdAt: new Date(record.createdAt) };
}
