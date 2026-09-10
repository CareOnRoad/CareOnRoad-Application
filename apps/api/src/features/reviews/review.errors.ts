export class ReviewError extends Error {
  constructor(
    readonly errorCode: "INVALID_INPUT" | "NOT_FOUND" | "FORBIDDEN" | "CONFLICT",
    message: string,
    readonly status: number,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ReviewError";
  }
}
