import type { RetentionDataClass, RetentionRepository } from "@/server/repositories/contracts/retention.repository";
import type { RetentionPolicy } from "@/features/retention/retention-policy";

const classes: RetentionDataClass[] = ["media_upload_intents", "device_delivery_credentials", "worker_runs"];
export type RetentionWorkerResult = { worker_id: string; mode: "dry_run" | "execute"; status: "completed" | "busy"; classes: Array<{ data_class: RetentionDataClass; status: "skipped" | "eligible" | "deleted"; cutoff?: string; eligible: number; deleted: number }> };

export class RetentionWorker {
  constructor(private readonly repository: RetentionRepository, private readonly policy: RetentionPolicy, private readonly options: { workerId: string; now?: () => Date; leaseMs?: number } ) {}
  async run(input: { dryRun: boolean; limit: number }): Promise<RetentionWorkerResult> {
    if (!input.dryRun && !this.policy.enabled) throw Object.assign(new Error("Data retention execution is disabled."), { status: 409, errorCode: "CONFLICT" as const });
    const now = this.options.now?.() ?? new Date(); const mode = input.dryRun ? "dry_run" : "execute";
    const claimed = await this.repository.claimLease({ workerId: this.options.workerId, now, leaseExpiresAt: new Date(now.getTime() + (this.options.leaseMs ?? 300_000)) });
    if (!claimed) return { worker_id: this.options.workerId, mode, status: "busy", classes: [] };
    try {
      const summaries: RetentionWorkerResult["classes"] = [];
      for (const dataClass of classes) {
        const days = this.policy.days[dataClass];
        if (!days) { summaries.push({ data_class: dataClass, status: "skipped", eligible: 0, deleted: 0 }); continue; }
        const cutoff = new Date(now.getTime() - days * 86_400_000);
        const eligible = await this.repository.countEligible(dataClass, cutoff, input.limit);
        const deleted = input.dryRun ? 0 : await this.repository.deleteEligible(dataClass, cutoff, input.limit);
        summaries.push({ data_class: dataClass, status: input.dryRun ? "eligible" : "deleted", cutoff: cutoff.toISOString(), eligible, deleted });
      }
      return { worker_id: this.options.workerId, mode, status: "completed", classes: summaries };
    } finally { await this.repository.releaseLease(this.options.workerId); }
  }
}
