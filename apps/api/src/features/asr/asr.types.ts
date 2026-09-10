export type AsrErrorCode =
  | "ASR_DISABLED"
  | "ASR_NOT_AVAILABLE"
  | "ASR_MODEL_NOT_FOUND"
  | "ASR_INVALID_AUDIO"
  | "ASR_EMPTY_TRANSCRIPTION"
  | "ASR_TRANSCRIPTION_FAILED";

export type AsrAudioInput = {
  data?: Uint8Array | ArrayBuffer;
  mimeType?: string;
  fileName?: string;
  durationMs?: number;
};

export type AsrSuccessResult = {
  success: true;
  text: string;
  durationMs?: number;
};

export type AsrFailureResult = {
  success: false;
  errorCode: AsrErrorCode;
  message: string;
};

export type AsrResult = AsrSuccessResult | AsrFailureResult;

export type AsrTranscriber = {
  transcribe(input: AsrAudioInput): Promise<AsrResult>;
};

export function asrFailure(errorCode: AsrErrorCode, message = retryMessage()): AsrFailureResult {
  return {
    success: false,
    errorCode,
    message
  };
}

export function retryMessage(): string {
  return "Không thể nhận dạng giọng nói. Vui lòng nhập lỗi xe hoặc ghi âm lại.";
}
