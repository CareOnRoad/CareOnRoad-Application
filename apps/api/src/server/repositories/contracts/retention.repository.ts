export type RetentionDataClass = "media_upload_intents" | "device_delivery_credentials" | "worker_runs";
export interface RetentionRepository {
  claimLease(input: { workerId: string; now: Date; leaseExpiresAt: Date }): Promise<boolean>;
  releaseLease(workerId: string): Promise<void>;
  countEligible(dataClass: RetentionDataClass, cutoff: Date, limit: number): Promise<number>;
  deleteEligible(dataClass: RetentionDataClass, cutoff: Date, limit: number): Promise<number>;
}
