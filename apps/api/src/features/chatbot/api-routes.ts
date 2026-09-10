import { NextResponse } from "next/server";

import type { AsrAudioInput, AsrResult } from "@/features/asr";
import { asrService } from "@/features/asr";
import type { ApiErrorCode } from "@/lib/api-error";
import { jsonError } from "@/lib/api-error";
import type { RateLimiter } from "@/lib/rate-limit";
import { createRateLimitHeaders } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";
import type { LogEvent } from "@/lib/server-logger";
import { serverLogger } from "@/lib/server-logger";
import type { ChatbotSessionRepository } from "@/server/repositories/contracts/chatbot-session.repository";
import { getChatbotSessionRepository } from "@/server/repositories/chatbot-session-repository.factory";
import { getChatbotRateLimiter } from "@/server/runtime-controls/runtime-control.factory";

import type { DiagnosisServiceResult } from "./diagnosis.service";
import { diagnosisService } from "./diagnosis.service";
import type { MessageRequest } from "./message.schema";
import { messageRequestSchema } from "./message.schema";
import type { InMemorySessionStore } from "./session.store";
import { getSessionOwnershipService, ownerCookie, type SessionOwnershipService } from "./session-ownership.service";

export type SessionRouteDependencies = {
  store?: InMemorySessionStore;
  repository?: ChatbotSessionRepository;
};

export type DiagnosisRouteDependencies = {
  store?: InMemorySessionStore;
  repository?: ChatbotSessionRepository;
};

export type MessageRouteDependencies = {
  diagnosis?: {
    diagnose(request: {
      sessionId: string;
      requestId?: string;
      input: unknown;
      audio?: AsrAudioInput;
    }): Promise<DiagnosisServiceResult>;
  };
  rateLimiter?: RateLimiter;
  logger?: {
    info(payload: LogEvent): void;
    warn(payload: LogEvent): void;
    error(payload: LogEvent): void;
  };
};

export type TranscriptionRouteDependencies = {
  store?: InMemorySessionStore;
  repository?: ChatbotSessionRepository;
  asr?: {
    transcribe(input?: AsrAudioInput): Promise<AsrResult>;
  };
  rateLimiter?: RateLimiter;
  logger?: {
    info(payload: LogEvent): void;
    warn(payload: LogEvent): void;
    error(payload: LogEvent): void;
  };
};

type OwnershipDependencies = { ownership?: Pick<SessionOwnershipService, "createSession" | "authorize" | "claim"> };

export async function createOwnedSessionResponse(dependencies: OwnershipDependencies = {}) {
  const ownership = dependencies.ownership ?? getSessionOwnershipService();
  const { session, token } = await ownership.createSession();
  return NextResponse.json({ session_id: session.session_id }, { headers: { "Set-Cookie": ownerCookie(token, session.session_id), "Cache-Control": "no-store" } });
}

export async function createOwnedMessageResponse(request: Request, sessionId: string, dependencies: MessageRouteDependencies & OwnershipDependencies = {}) {
  const ownership = dependencies.ownership ?? getSessionOwnershipService();
  if (!await ownership.authorize(request, sessionId)) return hiddenSessionNotFound();
  return createMessageResponse(request, sessionId, dependencies);
}

export async function createOwnedTranscriptionResponse(request: Request, sessionId: string, dependencies: TranscriptionRouteDependencies & OwnershipDependencies = {}) {
  const ownership = dependencies.ownership ?? getSessionOwnershipService();
  if (!await ownership.authorize(request, sessionId)) return hiddenSessionNotFound();
  return createTranscriptionResponse(request, sessionId, dependencies);
}

export async function getOwnedLatestDiagnosisResponse(request: Request, sessionId: string, dependencies: DiagnosisRouteDependencies & OwnershipDependencies = {}) {
  const ownership = dependencies.ownership ?? getSessionOwnershipService();
  if (!await ownership.authorize(request, sessionId)) return hiddenSessionNotFound();
  return getLatestDiagnosisResponse(sessionId, dependencies);
}

export async function claimOwnedSessionResponse(request: Request, sessionId: string, dependencies: OwnershipDependencies = {}) {
  try {
    const result = await (dependencies.ownership ?? getSessionOwnershipService()).claim(request, sessionId);
    if (!result) return hiddenSessionNotFound();
    return NextResponse.json({ session_id: result.session.session_id, owner_user_id: result.session.owner_user_id, claimed: true });
  } catch { return hiddenSessionNotFound(); }
}

function hiddenSessionNotFound() { return jsonError(404, "NOT_FOUND", "Session not found."); }

type ParsedRouteInput =
  | {
      success: true;
      input: MessageRequest;
      audio?: AsrAudioInput;
    }
  | {
      success: false;
      status: number;
      errorCode: ApiErrorCode;
      message: string;
    };

export function createSessionResponse(
  dependencies: { store: InMemorySessionStore }
): NextResponse;
export function createSessionResponse(
  dependencies?: SessionRouteDependencies
): NextResponse | Promise<NextResponse>;
export function createSessionResponse(
  dependencies: SessionRouteDependencies = {}
): NextResponse | Promise<NextResponse> {
  const repository = routeRepository(dependencies);
  const session = repository.createSession();
  return mapMaybePromise(session, (created) =>
    NextResponse.json({
      session_id: created.session_id
    })
  );
}

export function getLatestDiagnosisResponse(
  sessionId: string,
  dependencies: { store: InMemorySessionStore }
): NextResponse;
export function getLatestDiagnosisResponse(
  sessionId: string,
  dependencies?: DiagnosisRouteDependencies
): NextResponse | Promise<NextResponse>;
export function getLatestDiagnosisResponse(
  sessionId: string,
  dependencies: DiagnosisRouteDependencies = {}
): NextResponse | Promise<NextResponse> {
  const repository = routeRepository(dependencies);
  const session = repository.getSession(sessionId);
  return mapMaybePromise(session, (found) => {
    if (!found) {
      return jsonError(404, "NOT_FOUND", "Session not found.");
    }
    const diagnosis = repository.getLatestDiagnosis(sessionId);
    return mapMaybePromise(diagnosis, (latest) => {
      if (!latest) {
        return jsonError(404, "NOT_FOUND", "No diagnosis found for this session.");
      }
      return NextResponse.json({
        session_id: sessionId,
        diagnosis: latest
      });
    });
  });
}

export async function createMessageResponse(
  request: Request,
  sessionId: string,
  dependencies: MessageRouteDependencies = {}
) {
  const parsed = await parseMessageRequest(request);
  if (!parsed.success) {
    return jsonError(parsed.status, parsed.errorCode, parsed.message);
  }

  const rateLimiter = dependencies.rateLimiter ?? getChatbotRateLimiter();
  const rateLimitDecision = await rateLimiter.checkDiagnosisRequest({
    sessionId,
    ip: getRequestIp(request),
    inputMode: parsed.input.input_mode
  });

  if (!rateLimitDecision.allowed) {
    const logger = dependencies.logger ?? serverLogger;
    logger.warn({
      event: "chatbot.rate_limited",
      session_id: sessionId,
      input_mode: parsed.input.input_mode,
      error_code: rateLimitDecision.code,
      rate_limit_scope: rateLimitDecision.scope
    });

    return NextResponse.json(
      {
        error_code: rateLimitDecision.code ?? "RATE_LIMITED",
        message: rateLimitDecision.message ?? "Too many requests."
      },
      {
        status: 429,
        headers: createRateLimitHeaders(rateLimitDecision)
      }
    );
  }

  const service = dependencies.diagnosis ?? diagnosisService;
  const result = await service.diagnose({
    sessionId,
    input: parsed.input,
    ...(parsed.audio ? { audio: parsed.audio } : {})
  });

  if (!result.success) {
    return diagnosisFailureResponse(result);
  }

  return NextResponse.json(result.diagnosis);
}

export async function createTranscriptionResponse(
  request: Request,
  sessionId: string,
  dependencies: TranscriptionRouteDependencies = {}
) {
  const repository = routeRepository(dependencies);
  if (!(await repository.getSession(sessionId))) {
    return jsonError(404, "NOT_FOUND", "Session not found.");
  }

  const parsed = await parseTranscriptionRequest(request);
  if (!parsed.success) {
    return jsonError(parsed.status, parsed.errorCode, parsed.message);
  }

  const rateLimiter = dependencies.rateLimiter ?? getChatbotRateLimiter();
  const rateLimitDecision = await rateLimiter.checkTranscriptionRequest({
    sessionId,
    ip: getRequestIp(request),
    inputMode: "voice"
  });

  if (!rateLimitDecision.allowed) {
    const logger = dependencies.logger ?? serverLogger;
    logger.warn({
      event: "chatbot.rate_limited",
      session_id: sessionId,
      input_mode: "voice",
      error_code: rateLimitDecision.code,
      rate_limit_scope: rateLimitDecision.scope
    });

    return NextResponse.json(
      {
        error_code: rateLimitDecision.code ?? "RATE_LIMITED",
        message: rateLimitDecision.message ?? "Too many requests."
      },
      {
        status: 429,
        headers: createRateLimitHeaders(rateLimitDecision)
      }
    );
  }

  const result = await (dependencies.asr ?? asrService).transcribe(parsed.audio);
  if (!result.success) {
    return jsonError(statusForDiagnosisError(result.errorCode), apiCodeForDiagnosisError(result.errorCode), result.message);
  }

  return NextResponse.json({
    session_id: sessionId,
    transcribed_text: result.text
  });
}

function routeRepository(dependencies: {
  store?: InMemorySessionStore;
  repository?: ChatbotSessionRepository;
}): ChatbotSessionRepository {
  return dependencies.repository ?? dependencies.store ?? getChatbotSessionRepository();
}

function mapMaybePromise<T, R>(
  value: T | Promise<T>,
  map: (resolved: T) => R | Promise<R>
): R | Promise<R> {
  return value instanceof Promise ? value.then(map) : map(value);
}

async function parseMessageRequest(request: Request): Promise<ParsedRouteInput> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    return parseJsonMessage(request);
  }

  if (contentType.includes("multipart/form-data")) {
    return parseMultipartMessage(request);
  }

  return invalidInput("Unsupported content type.");
}

async function parseJsonMessage(request: Request): Promise<ParsedRouteInput> {
  try {
    const body = await request.json();
    const parsed = messageRequestSchema.safeParse(body);

    if (!parsed.success || parsed.data.input_mode !== "text") {
      return invalidInput("Invalid text message input.");
    }

    return {
      success: true,
      input: parsed.data
    };
  } catch {
    return invalidInput("Invalid JSON body.");
  }
}

async function parseMultipartMessage(request: Request): Promise<ParsedRouteInput> {
  try {
    const formData = await request.formData();
    const inputMode = formString(formData.get("input_mode"));

    if (inputMode !== "voice") {
      return invalidInput("Invalid voice message input.");
    }

    const audioFile = formData.get("audio_file");
    if (!(audioFile instanceof File) || audioFile.size <= 0) {
      return invalidInput("Missing audio file.");
    }

    const safetyAnswers = parseSafetyAnswers(formData.get("safety_answers"));
    if (!safetyAnswers.success) {
      return invalidInput("Invalid safety answers.");
    }

    const input = safetyAnswers.value
      ? { input_mode: "voice" as const, safety_answers: safetyAnswers.value }
      : { input_mode: "voice" as const };
    const parsed = messageRequestSchema.safeParse(input);
    if (!parsed.success) {
      return invalidInput("Invalid voice message input.");
    }

    return {
      success: true,
      input: parsed.data,
      audio: {
        data: new Uint8Array(await audioFile.arrayBuffer()),
        mimeType: audioFile.type || undefined,
        fileName: audioFile.name || undefined
      }
    };
  } catch {
    return invalidInput("Invalid multipart body.");
  }
}

async function parseTranscriptionRequest(request: Request): Promise<
  | { success: true; audio: AsrAudioInput }
  | { success: false; status: number; errorCode: ApiErrorCode; message: string }
> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return invalidTranscriptionInput("Unsupported content type.");
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio_file");
    if (!(audioFile instanceof File) || audioFile.size <= 0) {
      return invalidTranscriptionInput("Missing audio file.");
    }

    return {
      success: true,
      audio: {
        data: new Uint8Array(await audioFile.arrayBuffer()),
        mimeType: audioFile.type || undefined,
        fileName: audioFile.name || undefined
      }
    };
  } catch {
    return invalidTranscriptionInput("Invalid multipart body.");
  }
}

function diagnosisFailureResponse(result: Extract<DiagnosisServiceResult, { success: false }>) {
  const status = statusForDiagnosisError(result.errorCode);
  return jsonError(status, apiCodeForDiagnosisError(result.errorCode), result.message, {
    requestId: result.requestId
  });
}

function statusForDiagnosisError(errorCode: string): number {
  if (errorCode === "NOT_FOUND") {
    return 404;
  }

  if (
    errorCode === "ASR_DISABLED" ||
    errorCode === "ASR_NOT_AVAILABLE" ||
    errorCode === "ASR_MODEL_NOT_FOUND" ||
    errorCode === "ASR_TRANSCRIPTION_FAILED"
  ) {
    return 503;
  }

  return 400;
}

function apiCodeForDiagnosisError(errorCode: string): ApiErrorCode {
  if (isApiErrorCode(errorCode)) {
    return errorCode;
  }

  return "INTERNAL_ERROR";
}

function isApiErrorCode(errorCode: string): errorCode is ApiErrorCode {
  return [
    "INVALID_INPUT",
    "NOT_FOUND",
    "RATE_LIMITED",
    "AI_SESSION_LIMIT_EXCEEDED",
    "AI_DAILY_LIMIT_EXCEEDED",
    "ASR_DISABLED",
    "ASR_NOT_AVAILABLE",
    "ASR_MODEL_NOT_FOUND",
    "ASR_INVALID_AUDIO",
    "ASR_EMPTY_TRANSCRIPTION",
    "ASR_TRANSCRIPTION_FAILED",
    "EMPTY_TRANSCRIPTION",
    "INTERNAL_ERROR"
  ].includes(errorCode);
}

function invalidInput(message: string): ParsedRouteInput {
  return {
    success: false,
    status: 400,
    errorCode: "INVALID_INPUT",
    message
  };
}

function invalidTranscriptionInput(message: string): {
  success: false;
  status: number;
  errorCode: ApiErrorCode;
  message: string;
} {
  return {
    success: false,
    status: 400,
    errorCode: "INVALID_INPUT",
    message
  };
}

function formString(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" ? value : null;
}

function parseSafetyAnswers(
  value: FormDataEntryValue | null
): { success: true; value?: Record<string, unknown> } | { success: false } {
  if (value === null || value === "") {
    return { success: true };
  }

  if (typeof value !== "string") {
    return { success: false };
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { success: false };
    }

    return {
      success: true,
      value: parsed as Record<string, unknown>
    };
  } catch {
    return { success: false };
  }
}
