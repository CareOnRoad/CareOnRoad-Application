import { describe, expect, it } from "vitest";

import { AsrService } from "../asr.service";
import type { AsrAudioInput, AsrTranscriber } from "../asr.types";
import type { StructuredLogRecord } from "@/lib/server-logger";

const validAudio: AsrAudioInput = {
  data: new Uint8Array([1, 2, 3, 4]),
  mimeType: "audio/wav",
  fileName: "voice.wav",
  durationMs: 1200
};

function createLogger() {
  const records: StructuredLogRecord[] = [];
  const logger = {
    info: (record: StructuredLogRecord) => records.push(record),
    warn: (record: StructuredLogRecord) => records.push(record),
    error: (record: StructuredLogRecord) => records.push(record)
  };

  return { logger, records };
}

function serviceWith(transcriber: AsrTranscriber, options: Partial<ConstructorParameters<typeof AsrService>[0]> = {}) {
  const { logger } = createLogger();

  return new AsrService({
    transcriber,
    logger,
    now: () => 1000,
    ...options
  });
}

describe("AsrService", () => {
  it("returns ASR_DISABLED when disabled", async () => {
    const result = await serviceWith(
      {
        transcribe: async () => ({ success: true, text: "Xe khó đề" })
      },
      { enabled: false }
    ).transcribe(validAudio);

    expect(result).toMatchObject({
      success: false,
      errorCode: "ASR_DISABLED"
    });
  });

  it("returns ASR_INVALID_AUDIO for missing audio", async () => {
    const result = await serviceWith({
      transcribe: async () => ({ success: true, text: "Xe khó đề" })
    }).transcribe();

    expect(result).toMatchObject({
      success: false,
      errorCode: "ASR_INVALID_AUDIO"
    });
  });

  it("returns ASR_INVALID_AUDIO for invalid audio metadata", async () => {
    const result = await serviceWith({
      transcribe: async () => ({ success: true, text: "Xe khó đề" })
    }).transcribe({
      data: new Uint8Array([1, 2, 3]),
      mimeType: "audio/mp3",
      fileName: "voice.mp3"
    });

    expect(result).toMatchObject({
      success: false,
      errorCode: "ASR_INVALID_AUDIO"
    });
  });

  it("propagates ASR_NOT_AVAILABLE from runtime wrapper", async () => {
    const result = await serviceWith({
      transcribe: async () => ({
        success: false,
        errorCode: "ASR_NOT_AVAILABLE",
        message: "Không thể nhận dạng giọng nói. Vui lòng nhập lỗi xe hoặc ghi âm lại."
      })
    }).transcribe(validAudio);

    expect(result).toMatchObject({
      success: false,
      errorCode: "ASR_NOT_AVAILABLE"
    });
  });

  it("converts empty successful transcription to ASR_EMPTY_TRANSCRIPTION", async () => {
    const result = await serviceWith({
      transcribe: async () => ({ success: true, text: "   " })
    }).transcribe(validAudio);

    expect(result).toMatchObject({
      success: false,
      errorCode: "ASR_EMPTY_TRANSCRIPTION"
    });
  });

  it("returns Vietnamese text from mocked successful ASR", async () => {
    const result = await serviceWith({
      transcribe: async () => ({ success: true, text: "Xe khó đề và đèn yếu", durationMs: 900 })
    }).transcribe(validAudio);

    expect(result).toEqual({
      success: true,
      text: "Xe khó đề và đèn yếu",
      durationMs: 900
    });
  });

  it("logs ASR events without raw audio", async () => {
    const { logger, records } = createLogger();
    const result = await serviceWith(
      {
        transcribe: async () => ({ success: true, text: "Xe khó đề" })
      },
      { logger }
    ).transcribe(validAudio);

    expect(result.success).toBe(true);
    expect(records.map((record) => record.event)).toEqual([
      "chatbot.asr.started",
      "chatbot.asr.completed"
    ]);
    expect(JSON.stringify(records)).not.toContain("1,2,3,4");
    expect(records[0]).toMatchObject({
      input_size: 4,
      mime_type: "audio/wav",
      duration_ms: 1200
    });
  });
});
