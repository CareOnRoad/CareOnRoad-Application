export type RecordingStatus = "idle" | "recording" | "transcribing" | "ready" | "failed";

export const recordingStatusMessages: Record<RecordingStatus, string> = {
  idle: "",
  recording: "Đang ghi âm...",
  transcribing: "Đang chuyển giọng nói thành văn bản...",
  ready: "Đã điền nội dung từ giọng nói. Bạn có thể sửa rồi bấm Gửi.",
  failed: "Không nhận dạng được giọng nói. Bạn có thể ghi âm lại hoặc nhập text."
};

export function applyTranscribedTextDraft(transcribedText: string): string {
  return transcribedText.trim();
}

export function hasRecordedAudio(audioBlob: Blob): boolean {
  return audioBlob.size > 0;
}

export function createTextDiagnosisPayload(contentText: string) {
  return {
    input_mode: "text" as const,
    content_text: contentText.trim()
  };
}
