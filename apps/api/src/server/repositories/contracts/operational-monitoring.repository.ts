export type OperationalCursor = { createdAt: Date; id: string };
export type OperationalPageInput = { limit: number; cursor?: OperationalCursor };

export type DeadLetterItem = {
  id: string; topic: string; aggregateType: string; aggregateId: string;
  attemptCount: number; lastErrorCode?: string; createdAt: Date;
};
export type NeedsReviewPaymentItem = {
  id: string; requestId: string; assignmentId: string; status: "needs_review"; updatedAt: Date;
};
export type StuckDispatchItem = {
  id: string; requestCode: string; status: "submitted" | "dispatching" | "offered"; updatedAt: Date;
  reasonCode?: "missing_location";
};
export type WorkerRunStatus = "succeeded" | "failed";
export type WorkerRunRecord = {
  id: string; workerName: string; status: WorkerRunStatus; errorCode?: string;
  itemsClaimed: number; itemsSucceeded: number; itemsFailed: number;
  startedAt: Date; completedAt: Date; createdAt: Date;
};
export type AppendWorkerRun = Omit<WorkerRunRecord, "createdAt"> & { createdAt?: Date };

export interface OperationalMonitoringRepository {
  listDeadLetters(input: OperationalPageInput): Promise<DeadLetterItem[]>;
  listNeedsReviewPayments(input: OperationalPageInput): Promise<NeedsReviewPaymentItem[]>;
  listStuckDispatch(input: OperationalPageInput & { staleBefore: Date; now: Date }): Promise<StuckDispatchItem[]>;
  listWorkerRuns(input: OperationalPageInput): Promise<WorkerRunRecord[]>;
  appendWorkerRun(input: AppendWorkerRun): Promise<WorkerRunRecord>;
}
