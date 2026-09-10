import { NextResponse } from "next/server";

import { DatabaseError, normalizeDatabaseError } from "@/server/db/database-errors";

export type ApiErrorCode =
  | "INVALID_INPUT"
  | "INVALID_TOKEN"
  | "ACTOR_SUSPENDED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "DATABASE_CONFLICT"
  | "DATABASE_CONSTRAINT_VIOLATION"
  | "DATABASE_UNAVAILABLE"
  | "DATABASE_ERROR"
  | "PROVIDER_ERROR"
  | "RATE_LIMITED"
  | "AI_SESSION_LIMIT_EXCEEDED"
  | "AI_DAILY_LIMIT_EXCEEDED"
  | "ASR_DISABLED"
  | "ASR_NOT_AVAILABLE"
  | "ASR_MODEL_NOT_FOUND"
  | "ASR_INVALID_AUDIO"
  | "ASR_EMPTY_TRANSCRIPTION"
  | "ASR_TRANSCRIPTION_FAILED"
  | "EMPTY_TRANSCRIPTION"
  | "INTERNAL_ERROR";

export type ApiErrorBody = {
  error_code: ApiErrorCode;
  message: string;
  request_id?: string;
  details?: Record<string, unknown>;
};

export function createApiErrorBody(
  errorCode: ApiErrorCode,
  message: string,
  options: { requestId?: string; details?: Record<string, unknown> } = {}
): ApiErrorBody {
  return {
    error_code: errorCode,
    message,
    ...(options.requestId ? { request_id: options.requestId } : {}),
    ...(options.details ? { details: options.details } : {})
  };
}

export function jsonError(
  status: number,
  errorCode: ApiErrorCode,
  message: string,
  options: { requestId?: string; details?: Record<string, unknown> } = {}
) {
  return NextResponse.json(createApiErrorBody(errorCode, message, options), {
    status
  });
}

export function databaseJsonError(
  error: unknown,
  options: { requestId?: string } = {}
): NextResponse<ApiErrorBody> {
  const databaseError = error instanceof DatabaseError ? error : normalizeDatabaseError(error);
  return jsonError(
    databaseErrorStatus(databaseError),
    databaseError.errorCode,
    databaseError.message,
    options
  );
}

function databaseErrorStatus(error: DatabaseError): number {
  switch (error.errorCode) {
    case "DATABASE_CONFLICT":
      return 409;
    case "DATABASE_CONSTRAINT_VIOLATION":
      return 422;
    case "DATABASE_UNAVAILABLE":
      return 503;
    default:
      return 500;
  }
}
