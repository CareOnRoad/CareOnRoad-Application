import { randomUUID } from "node:crypto";

import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";

export type WorkerRunCounts = { claimed: number; succeeded: number; failed: number };

export async function recordWorkerRun<T>(input: {
  unitOfWork: UnitOfWork;
  workerName: string;
  run(): Promise<T>;
  summarize(result: T): WorkerRunCounts;
  now?: () => Date;
  createId?: () => string;
}): Promise<T> {
  const startedAt = input.now?.() ?? new Date();
  try {
    const result = await input.run();
    const completedAt = input.now?.() ?? new Date();
    const counts = input.summarize(result);
    await append(input, { status: counts.failed > 0 ? "failed" : "succeeded", startedAt, completedAt, ...counts });
    return result;
  } catch (error) {
    const completedAt = input.now?.() ?? new Date();
    await append(input, { status: "failed", startedAt, completedAt, claimed: 0, succeeded: 0, failed: 1, errorCode: normalizeCode(error) });
    throw error;
  }
}

async function append<T>(input: Parameters<typeof recordWorkerRun<T>>[0], result: {
  status: "succeeded" | "failed"; startedAt: Date; completedAt: Date; claimed: number; succeeded: number; failed: number; errorCode?: string;
}) {
  await input.unitOfWork.execute(({ operationalMonitoring }) => operationalMonitoring.appendWorkerRun({
    id: input.createId?.() ?? randomUUID(), workerName: input.workerName, status: result.status,
    ...(result.errorCode ? { errorCode: result.errorCode } : {}), itemsClaimed: result.claimed,
    itemsSucceeded: result.succeeded, itemsFailed: result.failed, startedAt: result.startedAt,
    completedAt: result.completedAt
  }));
}

function normalizeCode(error: unknown): string {
  const raw = error && typeof error === "object" && "errorCode" in error && typeof error.errorCode === "string" ? error.errorCode : "WORKER_EXECUTION_FAILED";
  return raw.toUpperCase().replace(/[^A-Z0-9_]/g, "_").slice(0, 80) || "WORKER_EXECUTION_FAILED";
}
