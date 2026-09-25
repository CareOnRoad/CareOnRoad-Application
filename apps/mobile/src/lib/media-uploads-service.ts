/**
 * Service wrappers cho media upload APIs:
 *
 *  - POST /api/v1/media/upload-intents                 - tạo intent (intent_id, upload URL, expires_at)
 *  - POST /api/v1/media/upload-intents/{id}/finalize   - xác nhận upload từ client (size + sha256)
 *
 * BE cấp presigned URL trỏ vào Supabase Storage; client upload trực tiếp rồi
 * gọi finalize để BE verify metadata.
 */
import { apiPost } from '@/lib/api';
import { newIdempotencyKey } from '@/lib/idempotency';

export type MediaUploadContext =
  | 'service_request_media'
  | 'assignment_media'
  | 'rider_review';

export type MediaContentType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/heic'
  | 'image/heif';

export interface CreateUploadIntentInput {
  context: MediaUploadContext;
  /** UUID của resource liên quan (request_id / assignment_id). */
  resource_id: string;
  content_type: MediaContentType;
  /** Kích thước bytes đã xác định trước khi upload (bắt buộc). */
  size_bytes: number;
  /** SHA-256 hex của payload (lowercase). Optional nhưng được khuyến nghị. */
  checksum?: string;
}

export interface UploadIntentResponse {
  intent_id: string;
  /** Signed PUT URL trỏ vào Supabase Storage. */
  upload_url: string;
  /** Path bắt buộc phải upload tới. */
  object_path: string;
  /** Thời điểm hết hạn (sau thời điểm này URL sẽ không dùng được). */
  expires_at: string;
}

export interface FinalizeUploadInput {
  size_bytes: number;
  checksum?: string;
}

export interface FinalizeUploadResponse {
  intent_id: string;
  object_path: string;
  size_bytes: number;
  content_type: string;
  finalized_at: string;
}

export async function createUploadIntent(
  input: CreateUploadIntentInput,
  options: { signal?: AbortSignal } = {},
): Promise<UploadIntentResponse> {
  return apiPost<UploadIntentResponse>(
    '/api/v1/media/upload-intents',
    input,
    {
      headers: {
        'X-Idempotency-Key': newIdempotencyKey(),
      },
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
}

export async function finalizeUpload(
  intentId: string,
  input: FinalizeUploadInput,
  options: { signal?: AbortSignal } = {},
): Promise<FinalizeUploadResponse> {
  return apiPost<FinalizeUploadResponse>(
    `/api/v1/media/upload-intents/${encodeURIComponent(intentId)}/finalize`,
    input,
    {
      headers: {
        'X-Idempotency-Key': newIdempotencyKey(),
      },
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
}

/**
 * Upload 1 file nhỏ qua fetch PUT tới signed URL. Trả về true nếu thành công.
 * Với file > 5MB trên RN nên dùng XHR để stream.
 */
export async function putBytesToSignedUrl(
  url: string,
  bytes: ArrayBuffer | Uint8Array,
  contentType: MediaContentType,
): Promise<void> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: bytes as BodyInit,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upload failed: ${res.status} ${text.slice(0, 200)}`);
  }
}

/** SHA-256 hex của ArrayBuffer (lowercase). */
export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  // expo-crypto & react-native-get-random-values đều có sẵn trong app
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subtle = (globalThis as any).crypto?.subtle;
  if (!subtle) {
    throw new Error('crypto.subtle không khả dụng trên môi trường này.');
  }
  const digest = await subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function mediaErrorCode(err: unknown): string | null {
  if (err && typeof err === 'object' && 'errorCode' in err) {
    return String((err as { errorCode: string }).errorCode);
  }
  return null;
}
