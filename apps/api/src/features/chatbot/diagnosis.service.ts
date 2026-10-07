import type { AsrAudioInput, AsrErrorCode, AsrResult } from "@/features/asr";
import { asrService } from "@/features/asr";
import type { LogEvent } from "@/lib/server-logger";
import { createTextLogMetadata, serverLogger } from "@/lib/server-logger";
import type { ChatbotSessionRepository } from "@/server/repositories/contracts/chatbot-session.repository";
import { getChatbotSessionRepository } from "@/server/repositories/chatbot-session-repository.factory";

import { aiDiagnosisClient } from "./ai-diagnosis.client";
import type { AiDiagnosisJsonProvider } from "./ai-provider.types";
import type { DiagnosisResult } from "./diagnosis.schema";
import { diagnosisSchema } from "./diagnosis.schema";
import { createFallbackDiagnosis } from "./fallback-diagnosis";
import { knowledgeReviewedAt, knowledgeVersion } from "./knowledge-sources";
import { messageRequestSchema } from "./message.schema";
import { normalizeVietnameseText } from "./normalize-vi";
import { postValidateDiagnosis } from "./post-validation";
import { buildCompactDiagnosisPrompt } from "./prompts";
import { retrieveKnowledge } from "./retrieval";
import { runSafetyGate } from "./safety-gate";
import type { InMemorySessionStore } from "./session.store";

export type DiagnosisServiceErrorCode = "INVALID_INPUT" | "NOT_FOUND" | AsrErrorCode;

export type DiagnosisServiceSuccess = {
  success: true;
  diagnosis: DiagnosisResult;
};

export type DiagnosisServiceFailure = {
  success: false;
  errorCode: DiagnosisServiceErrorCode;
  message: string;
  requestId?: string;
};

export type DiagnosisServiceResult = DiagnosisServiceSuccess | DiagnosisServiceFailure;

export type DiagnosisServiceRequest = {
  sessionId: string;
  requestId?: string;
  input: unknown;
  audio?: AsrAudioInput;
};

export type DiagnosisServiceOptions = {
  sessionStore?: InMemorySessionStore;
  sessionRepository?: ChatbotSessionRepository;
  asr?: {
    transcribe(input?: AsrAudioInput): Promise<AsrResult>;
  };
  aiProvider?: AiDiagnosisJsonProvider;
  openRouter?: AiDiagnosisJsonProvider;
  logger?: {
    info(payload: LogEvent): void;
    warn(payload: LogEvent): void;
    error(payload: LogEvent): void;
  };
  now?: () => number;
};

export class DiagnosisService {
  private readonly sessionRepository: ChatbotSessionRepository;
  private readonly asr: NonNullable<DiagnosisServiceOptions["asr"]>;
  private readonly aiProvider: AiDiagnosisJsonProvider;
  private readonly logger: NonNullable<DiagnosisServiceOptions["logger"]>;
  private readonly now: () => number;

  constructor(options: DiagnosisServiceOptions = {}) {
    this.sessionRepository =
      options.sessionRepository ??
      options.sessionStore ??
      getChatbotSessionRepository();
    this.asr = options.asr ?? asrService;
    this.aiProvider = options.aiProvider ?? options.openRouter ?? aiDiagnosisClient;
    this.logger = options.logger ?? serverLogger;
    this.now = options.now ?? Date.now;
  }

  async diagnose(request: DiagnosisServiceRequest): Promise<DiagnosisServiceResult> {
    const startedAt = this.now();
    const requestId = request.requestId ?? crypto.randomUUID();
    const session = await this.sessionRepository.getSession(request.sessionId);

    if (!session) {
      return failure("NOT_FOUND", "Session not found.", requestId);
    }

    const parsedMessage = messageRequestSchema.safeParse(request.input);
    if (!parsedMessage.success) {
      return failure("INVALID_INPUT", "Invalid message input.", requestId);
    }

    const inputMode = parsedMessage.data.input_mode;
    this.logger.info({
      event: "chatbot.message.received",
      session_id: request.sessionId,
      request_id: requestId,
      input_mode: inputMode,
      ...(inputMode === "text" ? createTextLogMetadata(parsedMessage.data.content_text) : {})
    });

    const contentResult = await this.resolveContentText(inputMode, parsedMessage.data, request, requestId, startedAt);
    if (!contentResult.success) {
      return contentResult;
    }

    const contentText = contentResult.contentText;
    const normalizedText = normalizeVietnameseText(contentText);
    const safety = runSafetyGate(contentText);
    const retrievedKnowledge = retrieveKnowledge(contentText, 2);

    this.logger.info({
      event: "chatbot.diagnosis.started",
      session_id: request.sessionId,
      request_id: requestId,
      input_mode: inputMode,
      ...createTextLogMetadata(contentText)
    });

    const prompt = buildCompactDiagnosisPrompt({
      normalizedText,
      safety,
      retrievedKnowledge,
      ...(contentResult.transcribedText ? { transcribedText: contentResult.transcribedText } : {}),
      safetyAnswers: parsedMessage.data.safety_answers
    });
    const providerResult = await this.aiProvider.createDiagnosisJson(prompt);
    let diagnosis: DiagnosisResult;
    if (providerResult.success) {
      const modelDiagnosis = this.createModelDiagnosis(
        providerResult.json,
        safety,
        retrievedKnowledge,
        contentResult.transcribedText
      );
      diagnosis = modelDiagnosis.success
        ? modelDiagnosis.diagnosis
        : this.createLoggedFallback(contentText, contentResult.transcribedText, {
            requestId,
            sessionId: request.sessionId,
            inputMode,
            errorCode: modelDiagnosis.errorCode,
            apiHttpStatus: providerResult.apiHttpStatus,
            provider: providerResult.provider,
            providerModel: providerResult.providerModel
          });
    } else {
      diagnosis = this.createLoggedFallback(contentText, contentResult.transcribedText, {
        requestId,
        sessionId: request.sessionId,
        inputMode,
        errorCode: providerResult.errorCode,
        apiHttpStatus: providerResult.apiHttpStatus,
        retryAfterSeconds: providerResult.retryAfterSeconds,
        openRouterErrorCode: providerResult.openRouterErrorCode,
        openRouterErrorType: providerResult.openRouterErrorType,
        provider: providerResult.provider,
        providerName: providerResult.providerName,
        providerModel: providerResult.providerModel
      });
    }

    // Provenance comes only from backend retrieval, never from provider JSON.
    diagnosis = {
      ...diagnosis,
      knowledge_provenance: {
        version: knowledgeVersion,
        reviewed_at: knowledgeReviewedAt,
        entry_ids: retrievedKnowledge.map((entry) => entry.entry_id),
        source_ids: [...new Set(retrievedKnowledge.flatMap((entry) => entry.source_refs.map((ref) => ref.source_id)))]
      }
    };

    const storedMessage = await this.sessionRepository.appendMessage(
      request.sessionId,
      {
        input_mode: inputMode,
        content_text: contentText,
        transcribed_text: contentResult.transcribedText ?? null,
        normalized_text: normalizedText,
        safety_answers: parsedMessage.data.safety_answers ?? null
      },
      new Date(this.now())
    );
    if (!storedMessage) {
      return failure("NOT_FOUND", "Session not found.", requestId);
    }
    const storedDiagnosis = await this.sessionRepository.setLatestDiagnosis(
      request.sessionId,
      diagnosis,
      new Date(this.now()),
      { messageId: storedMessage.message_id }
    );
    if (!storedDiagnosis) {
      return failure("NOT_FOUND", "Session not found.", requestId);
    }

    this.logger.info({
      event: "chatbot.diagnosis.completed",
      session_id: request.sessionId,
      request_id: requestId,
      input_mode: inputMode,
      latency_ms: this.now() - startedAt,
      fallback_used: diagnosis.fallback_used,
      risk_level: diagnosis.risk_level,
      knowledge_version: knowledgeVersion,
      knowledge_entry_ids: diagnosis.knowledge_provenance?.entry_ids
    });

    return {
      success: true,
      diagnosis
    };
  }

  private async resolveContentText(
    inputMode: "text" | "voice",
    message: { input_mode: "text"; content_text: string } | { input_mode: "voice" },
    request: DiagnosisServiceRequest,
    requestId: string,
    startedAt: number
  ): Promise<
    | { success: true; contentText: string; transcribedText?: string }
    | DiagnosisServiceFailure
  > {
    if (inputMode === "text" && message.input_mode === "text") {
      return {
        success: true,
        contentText: message.content_text
      };
    }

    this.logger.info({
      event: "chatbot.asr.started",
      session_id: request.sessionId,
      request_id: requestId,
      input_mode: "voice",
      ...audioLogMetadata(request.audio)
    });

    const asrResult = await this.asr.transcribe(request.audio);
    if (!asrResult.success) {
      this.logger.warn({
        event: "chatbot.asr.failed",
        session_id: request.sessionId,
        request_id: requestId,
        input_mode: "voice",
        error_code: asrResult.errorCode,
        latency_ms: this.now() - startedAt,
        ...audioLogMetadata(request.audio)
      });
      return failure(asrResult.errorCode, asrResult.message, requestId);
    }

    const transcribedText = asrResult.text.trim();
    if (!transcribedText) {
      this.logger.warn({
        event: "chatbot.asr.failed",
        session_id: request.sessionId,
        request_id: requestId,
        input_mode: "voice",
        error_code: "ASR_EMPTY_TRANSCRIPTION",
        latency_ms: this.now() - startedAt,
        ...audioLogMetadata(request.audio)
      });
      return failure("ASR_EMPTY_TRANSCRIPTION", "Empty transcription.", requestId);
    }

    return {
      success: true,
      contentText: transcribedText,
      transcribedText
    };
  }

  private createModelDiagnosis(
    providerJson: unknown,
    safety: ReturnType<typeof runSafetyGate>,
    retrievedKnowledge: ReturnType<typeof retrieveKnowledge>,
    transcribedText: string | undefined
  ): { success: true; diagnosis: DiagnosisResult } | { success: false; errorCode: string } {
    const strictParsed = diagnosisSchema.safeParse(providerJson);
    const postValidated = postValidateDiagnosis(strictParsed.success ? strictParsed.data : providerJson, safety, {
      retrievedKnowledge,
      transcribedText
    });

    if (!postValidated.success) {
      return {
        success: false,
        errorCode: strictParsed.success ? "POST_VALIDATION_FAILED" : "SCHEMA_VALIDATION_FAILED"
      };
    }

    return {
      success: true,
      diagnosis: postValidated.diagnosis
    };
  }

  private createLoggedFallback(
    contentText: string,
    transcribedText: string | undefined,
    metadata: {
      requestId: string;
      sessionId: string;
      inputMode: "text" | "voice";
      errorCode: string;
      apiHttpStatus?: string;
      retryAfterSeconds?: number;
      openRouterErrorCode?: string;
      openRouterErrorType?: string;
      providerName?: string;
      providerModel?: string;
      provider?: string;
    }
  ): DiagnosisResult {
    this.logger.warn({
      event: "chatbot.fallback.used",
      session_id: metadata.sessionId,
      request_id: metadata.requestId,
      input_mode: metadata.inputMode,
      error_code: metadata.errorCode,
      api_http_status: metadata.apiHttpStatus,
      retry_after: metadata.retryAfterSeconds,
      openrouter_error_code: metadata.openRouterErrorCode,
      openrouter_error_type: metadata.openRouterErrorType,
      provider: metadata.provider,
      provider_name: metadata.providerName,
      provider_model: metadata.providerModel,
      ...createTextLogMetadata(contentText)
    });

    return createFallbackDiagnosis(contentText, {
      ...(transcribedText ? { transcribedText } : {})
    });
  }
}

export const diagnosisService = new DiagnosisService();

function failure(
  errorCode: DiagnosisServiceErrorCode,
  message: string,
  requestId: string
): DiagnosisServiceFailure {
  return {
    success: false,
    errorCode,
    message,
    requestId
  };
}

function audioLogMetadata(input?: AsrAudioInput): Record<string, unknown> {
  return {
    input_size: input?.data ? audioByteLength(input.data) : 0,
    mime_type: input?.mimeType,
    duration_ms: input?.durationMs
  };
}

function audioByteLength(data: Uint8Array | ArrayBuffer): number {
  return data instanceof ArrayBuffer ? data.byteLength : data.byteLength;
}
