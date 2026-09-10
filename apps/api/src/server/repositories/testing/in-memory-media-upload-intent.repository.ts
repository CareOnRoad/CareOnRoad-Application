import type {
  CreateMediaUploadIntent,
  MediaUploadIntent,
  MediaUploadIntentRepository
} from "../contracts/media-upload-intent.repository";

export class InMemoryMediaUploadIntentRepository implements MediaUploadIntentRepository {
  constructor(private readonly intents: MediaUploadIntent[]) {}

  async create(input: CreateMediaUploadIntent) {
    if (this.intents.some((intent) => intent.objectKey === input.objectKey)) {
      throw new Error("duplicate media upload object key");
    }
    const intent: MediaUploadIntent = { ...input, status: "pending" };
    this.intents.push(intent);
    return structuredClone(intent);
  }

  async findById(id: string) {
    const intent = this.intents.find((item) => item.id === id);
    return intent ? structuredClone(intent) : undefined;
  }

  findByIdForUpdate(id: string) {
    return this.findById(id);
  }

  async countForResource(input: Parameters<MediaUploadIntentRepository["countForResource"]>[0]) {
    return this.intents.filter(
      (intent) =>
        intent.resourceType === input.resourceType &&
        intent.requestId === input.requestId &&
        intent.assignmentId === input.assignmentId &&
        intent.status === "pending" && intent.expiresAt > input.now
    ).length;
  }

  async markFinalized(input: Parameters<MediaUploadIntentRepository["markFinalized"]>[0]) {
    const intent = this.intents.find((item) => item.id === input.id && item.status === "pending");
    if (!intent) return undefined;
    Object.assign(intent, {
      status: "finalized" as const,
      mediaMetadataId: input.mediaMetadataId,
      finalizedResponse: structuredClone(input.finalizedResponse),
      finalizedAt: input.finalizedAt,
      updatedAt: input.finalizedAt,
      cleanupLeaseOwner: undefined,
      cleanupLeaseExpiresAt: undefined
    });
    return structuredClone(intent);
  }

  async claimExpired(input: Parameters<MediaUploadIntentRepository["claimExpired"]>[0]) {
    const claimed = this.intents
      .filter(
        (intent) =>
          intent.status === "pending" &&
          intent.expiresAt <= input.now &&
          (!intent.cleanupLeaseExpiresAt || intent.cleanupLeaseExpiresAt <= input.now)
      )
      .sort((left, right) => left.expiresAt.getTime() - right.expiresAt.getTime() || left.id.localeCompare(right.id))
      .slice(0, input.limit);
    for (const intent of claimed) {
      intent.cleanupLeaseOwner = input.workerId;
      intent.cleanupLeaseExpiresAt = input.leaseExpiresAt;
      intent.updatedAt = input.now;
    }
    return structuredClone(claimed);
  }

  async markExpired(input: Parameters<MediaUploadIntentRepository["markExpired"]>[0]) {
    const intent = this.intents.find(
      (item) => item.id === input.id && item.status === "pending" && item.cleanupLeaseOwner === input.workerId
    );
    if (!intent) return false;
    intent.status = "expired";
    intent.cleanupLeaseOwner = undefined;
    intent.cleanupLeaseExpiresAt = undefined;
    intent.updatedAt = input.updatedAt;
    return true;
  }

  async releaseCleanupLease(input: Parameters<MediaUploadIntentRepository["releaseCleanupLease"]>[0]) {
    const intent = this.intents.find(
      (item) => item.id === input.id && item.status === "pending" && item.cleanupLeaseOwner === input.workerId
    );
    if (!intent) return false;
    intent.cleanupLeaseOwner = undefined;
    intent.cleanupLeaseExpiresAt = undefined;
    intent.updatedAt = input.updatedAt;
    return true;
  }
}
