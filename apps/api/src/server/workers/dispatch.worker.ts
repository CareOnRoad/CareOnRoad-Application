import { randomUUID } from "node:crypto";

import {
  DispatchService,
  type ProcessClaimedDispatchRoundResult
} from "@/features/dispatch/dispatch.service";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";
import { persistNotification } from "@/features/notifications/notification.service";

const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_LEASE_MS = 60_000;

export type DispatchWorkerResult = {
  claimed: number;
  advanced: number;
  escalated: number;
  skipped: number;
  failed: number;
};

export class DispatchWorker {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly options: {
      now?: () => Date;
      createId?: () => string;
      workerId?: string;
      batchSize?: number;
      leaseMs?: number;
      processRound?: (
        roundId: string,
        leaseOwner: string
      ) => Promise<ProcessClaimedDispatchRoundResult>;
    } = {}
  ) {}

  async processBatch(): Promise<DispatchWorkerResult> {
    const now = this.options.now?.() ?? new Date();
    const workerId = this.options.workerId ?? `dispatch-worker-${randomUUID()}`;
    const preparationFailures = await this.notifyScheduledAppointments(now);
    const leaseUntil = new Date(now.getTime() + (this.options.leaseMs ?? DEFAULT_LEASE_MS));
    const rounds = await this.unitOfWork.execute(({ dispatch }) =>
      dispatch.claimExpiredRounds({
        now,
        leaseOwner: workerId,
        leaseUntil,
        limit: this.options.batchSize ?? DEFAULT_BATCH_SIZE
      })
    );
    const result: DispatchWorkerResult = {
      claimed: rounds.length,
      advanced: 0,
      escalated: 0,
      skipped: 0,
      failed: preparationFailures
    };
    const processRound =
      this.options.processRound ??
      ((roundId: string, leaseOwner: string) =>
        new DispatchService(this.unitOfWork, {
          now: this.options.now,
          createId: this.options.createId
        }).processClaimedRound(roundId, leaseOwner));

    for (const round of rounds) {
      try {
        const outcome = await processRound(round.id, workerId);
        result[outcome] += 1;
        if (outcome === "skipped") {
          await this.release(round.id, workerId);
        }
      } catch {
        result.failed += 1;
        await this.release(round.id, workerId);
      }
    }
    return result;
  }

  private async notifyScheduledAppointments(now: Date) {
    let failed = 0;
    const due = await this.unitOfWork.execute(({ assignments }) => assignments.listScheduledForPreparation({
      now, limit: this.options.batchSize ?? DEFAULT_BATCH_SIZE
    }));
    for (const item of due) try { await this.unitOfWork.execute(async (repositories) => {
      const request = await repositories.serviceRequests.findByIdForUpdate(item.requestId);
      const assignment = await repositories.assignments.findByIdForUpdate(item.id);
      if (!request || request.status === "canceled" || !assignment || assignment.activatedAt ||
        ["completed", "canceled", "recovery_canceled"].includes(assignment.status)) return;
      const createId = this.options.createId ?? randomUUID;
      for (const [audience, userId] of [["rider", request.riderId], ["mechanic", assignment.mechanicId]] as const) {
        await persistNotification(repositories, {
          userId, type: request.serviceType === "periodic_maintenance" ? "maintenance.appointment.prepare" : "appointment.prepare",
          title: request.serviceType === "periodic_maintenance" ? "Sắp đến lịch bảo dưỡng" : "Sắp đến lịch phục vụ",
          body: "Lịch hẹn đã vào thời gian chuẩn bị. Mở yêu cầu để xem tiến trình.",
          data: { request_id: request.id, assignment_id: assignment.id, scheduled_start_at: assignment.scheduledStartAt!.toISOString() },
          dedupeKey: `${request.serviceType === "periodic_maintenance" ? "maintenance" : "appointment"}.prepare:${assignment.id}:${audience}`, requestId: request.id
        }, now, createId);
      }
    }); } catch { failed++; }
    return failed;
  }

  private release(roundId: string, workerId: string): Promise<boolean> {
    return this.unitOfWork.execute(({ dispatch }) =>
      dispatch.releaseRoundClaim({ id: roundId, leaseOwner: workerId })
    );
  }
}
