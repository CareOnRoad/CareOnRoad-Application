export type MediaUploadErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "CONFLICT";

export class MediaUploadError extends Error {
  constructor(
    readonly errorCode: MediaUploadErrorCode,
    message: string,
    readonly status: number,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "MediaUploadError";
  }
}
