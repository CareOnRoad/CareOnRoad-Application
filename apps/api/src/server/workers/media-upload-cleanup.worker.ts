import type { MediaStorageProvider } from "@/features/media-uploads/media-storage.provider";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";

const DEFAULT_LIMIT = 25;
const LEASE_MS = 60_000;

export type MediaUploadCleanupResult = {
  claimed: number;
  expired: number;
  failed: number;
};

export class MediaUploadCleanupWorker {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly storage: MediaStorageProvider,
    private readonly options: {
      workerId: string;
      now?: () => Date;
      limit?: number;
    }
  ) {}

  async processBatch(): Promise<MediaUploadCleanupResult> {
    const now = this.options.now?.() ?? new Date();
    const claimed = await this.unitOfWork.execute(({ mediaUploadIntents }) =>
      mediaUploadIntents.claimExpired({
        workerId: this.options.workerId,
        now,
        leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
        limit: Math.min(Math.max(this.options.limit ?? DEFAULT_LIMIT, 1), 100)
      })
    );
    let expired = 0;
    let failed = 0;
    for (const intent of claimed) {
      try {
        await this.storage.remove({
          bucket: intent.storageBucket,
          objectKey: intent.objectKey
        });
        const marked = await this.unitOfWork.execute(({ mediaUploadIntents }) =>
          mediaUploadIntents.markExpired({
            id: intent.id,
            workerId: this.options.workerId,
            updatedAt: this.options.now?.() ?? new Date()
          })
        );
        if (marked) expired += 1;
      } catch {
        failed += 1;
        await this.unitOfWork.execute(({ mediaUploadIntents }) =>
          mediaUploadIntents.releaseCleanupLease({
            id: intent.id,
            workerId: this.options.workerId,
            updatedAt: this.options.now?.() ?? new Date()
          })
        );
      }
    }
    return { claimed: claimed.length, expired, failed };
  }
}
