export type MediaUploadResourceType = "service_request" | "assignment";
export type MediaUploadIntentStatus = "pending" | "finalized" | "expired";

export type MediaUploadIntent = {
  id: string;
  actorId: string;
  actorRole: "rider" | "mechanic";
  resourceType: MediaUploadResourceType;
  requestId: string;
  assignmentId?: string;
  purpose: string;
  storageBucket: string;
  objectKey: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  sizeBytes: number;
  sha256: string;
  status: MediaUploadIntentStatus;
  mediaMetadataId?: string;
  finalizedResponse?: Record<string, unknown>;
  expiresAt: Date;
  finalizedAt?: Date;
  cleanupLeaseOwner?: string;
  cleanupLeaseExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateMediaUploadIntent = Omit<
  MediaUploadIntent,
  | "status"
  | "mediaMetadataId"
  | "finalizedResponse"
  | "finalizedAt"
  | "cleanupLeaseOwner"
  | "cleanupLeaseExpiresAt"
>;

export interface MediaUploadIntentRepository {
  create(input: CreateMediaUploadIntent): Promise<MediaUploadIntent>;
  findById(id: string): Promise<MediaUploadIntent | undefined>;
  findByIdForUpdate(id: string): Promise<MediaUploadIntent | undefined>;
  countForResource(input: {
    resourceType: MediaUploadResourceType;
    requestId: string;
    assignmentId?: string;
    now: Date;
  }): Promise<number>;
  markFinalized(input: {
    id: string;
    mediaMetadataId: string;
    finalizedResponse: Record<string, unknown>;
    finalizedAt: Date;
  }): Promise<MediaUploadIntent | undefined>;
  claimExpired(input: {
    workerId: string;
    now: Date;
    leaseExpiresAt: Date;
    limit: number;
  }): Promise<MediaUploadIntent[]>;
  markExpired(input: { id: string; workerId: string; updatedAt: Date }): Promise<boolean>;
  releaseCleanupLease(input: { id: string; workerId: string; updatedAt: Date }): Promise<boolean>;
}
