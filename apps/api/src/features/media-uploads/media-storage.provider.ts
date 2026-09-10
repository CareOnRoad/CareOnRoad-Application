export type SignedMediaUpload = {
  uploadUrl: string;
  method: "PUT";
  requiredHeaders: Record<string, string>;
};

export type InspectedMediaObject = {
  contentType: string;
  sizeBytes: number;
  sha256: string;
};

export interface MediaStorageProvider {
  createSignedUpload(input: {
    bucket: string;
    objectKey: string;
    contentType: string;
  }): Promise<SignedMediaUpload>;
  inspectAndHash(input: {
    bucket: string;
    objectKey: string;
    maxBytes: number;
  }): Promise<InspectedMediaObject | undefined>;
  remove(input: { bucket: string; objectKey: string }): Promise<void>;
}

export class MediaStorageProviderError extends Error {
  readonly status = 502;
  readonly errorCode = "PROVIDER_ERROR" as const;

  constructor(message = "Media storage is temporarily unavailable.") {
    super(message);
    this.name = "MediaStorageProviderError";
  }
}
