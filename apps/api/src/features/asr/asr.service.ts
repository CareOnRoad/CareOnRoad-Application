import type { LogEvent } from "@/lib/server-logger";
import { serverLogger } from "@/lib/server-logger";

import type { AsrAudioInput, AsrErrorCode, AsrResult, AsrTranscriber } from "./asr.types";
import { asrFailure } from "./asr.types";
import { SherpaOnnxClient } from "./sherpa-onnx.client";

export type AsrServiceOptions = {
  enabled?: boolean;
  transcriber?: AsrTranscriber;
  logger?: {
    info(payload: LogEvent): void;
    warn(payload: LogEvent): void;
    error(payload: LogEvent): void;
  };
  now?: () => number;
};

const supportedWavMimeTypes = new Set(["audio/wav", "audio/wave", "audio/x-wav", "audio/vnd.wave"]);

export class AsrService {
  private readonly enabled: boolean;
  private readonly transcriber: AsrTranscriber;
  private readonly logger: NonNullable<AsrServiceOptions["logger"]>;
  private readonly now: () => number;

  constructor(options: AsrServiceOptions = {}) {
    this.enabled = options.enabled ?? process.env.ASR_ENABLED !== "false";
    this.transcriber = options.transcriber ?? new SherpaOnnxClient();
    this.logger = options.logger ?? serverLogger;
    this.now = options.now ?? Date.now;
  }

  async transcribe(input?: AsrAudioInput): Promise<AsrResult> {
    const startedAt = this.now();

    if (!this.enabled) {
      const result = asrFailure("ASR_DISABLED");
      this.logFailure(result.errorCode, input, startedAt);
      return result;
    }

    if (!input) {
      const result = asrFailure("ASR_INVALID_AUDIO");
      this.logFailure(result.errorCode, input, startedAt);
      return result;
    }

    const invalidReason = validateAudioInput(input);
    if (invalidReason) {
      const result = asrFailure(invalidReason);
      this.logFailure(result.errorCode, input, startedAt);
      return result;
    }

    const audioInput = input;

    this.logger.info({
      event: "chatbot.asr.started",
      input_mode: "voice",
      ...audioLogMetadata(audioInput)
    });

    const result = await this.transcriber.transcribe(audioInput);
    const latencyMs = this.now() - startedAt;

    if (!result.success) {
      this.logger.warn({
        event: "chatbot.asr.failed",
        input_mode: "voice",
        error_code: result.errorCode,
        latency_ms: latencyMs,
        ...audioLogMetadata(audioInput)
      });
      return result;
    }

    const text = result.text.trim();
    if (!text) {
      const emptyResult = asrFailure("ASR_EMPTY_TRANSCRIPTION");
      this.logger.warn({
        event: "chatbot.asr.failed",
        input_mode: "voice",
        error_code: emptyResult.errorCode,
        latency_ms: latencyMs,
        ...audioLogMetadata(audioInput)
      });
      return emptyResult;
    }

    this.logger.info({
      event: "chatbot.asr.completed",
      input_mode: "voice",
      latency_ms: latencyMs,
      text_length: text.length,
      ...audioLogMetadata(audioInput)
    });

    return {
      success: true,
      text,
      ...(result.durationMs !== undefined ? { durationMs: result.durationMs } : {})
    };
  }

  private logFailure(errorCode: AsrErrorCode, input: AsrAudioInput | undefined, startedAt: number) {
    this.logger.warn({
      event: "chatbot.asr.failed",
      input_mode: "voice",
      error_code: String(errorCode),
      latency_ms: this.now() - startedAt,
      ...audioLogMetadata(input)
    });
  }
}

export const asrService = new AsrService();

function validateAudioInput(input: AsrAudioInput): "ASR_INVALID_AUDIO" | null {
  if (!input.data) {
    return "ASR_INVALID_AUDIO";
  }

  const byteLength = audioByteLength(input.data);
  if (byteLength <= 0) {
    return "ASR_INVALID_AUDIO";
  }

  if (!isWavLike(input)) {
    return "ASR_INVALID_AUDIO";
  }

  return null;
}

function isWavLike(input: AsrAudioInput): boolean {
  const mimeType = input.mimeType?.toLowerCase();
  const fileName = input.fileName?.toLowerCase();

  if (mimeType && supportedWavMimeTypes.has(mimeType)) {
    return true;
  }

  return Boolean(fileName?.endsWith(".wav"));
}

function audioByteLength(data: Uint8Array | ArrayBuffer): number {
  return data instanceof ArrayBuffer ? data.byteLength : data.byteLength;
}

function audioLogMetadata(input?: AsrAudioInput): Record<string, unknown> {
  return {
    input_size: input?.data ? audioByteLength(input.data) : 0,
    mime_type: input?.mimeType,
    duration_ms: input?.durationMs
  };
}
