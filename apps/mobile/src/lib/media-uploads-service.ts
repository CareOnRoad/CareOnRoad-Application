/**
 * Service wrappers cho media upload APIs:
 *
 *  - POST /api/v1/media/upload-intents                 - tạo intent (intent_id, upload URL, expires_at)
 *  - POST /api/v1/media/upload-intents/{id}/finalize   - xác nhận upload từ client (BE verify byte-for-byte)
 *
 * BE cấp signed URL trỏ vào Supabase Storage; client upload trực tiếp rồi
 * gọi finalize để BE verify metadata.
 *
 * ⚠️ CONTRACT (mirror `apps/api/src/features/media-uploads/media-upload.schemas.ts`):
 *  - `resource_type` BẮT BUỘC: `service_request` | `assignment` (KHÔNG dùng
 *    `context` — BE schema `.strict()` sẽ reject field lạ).
 *  - `purpose` BẮT BUỘC: `problem_photo` (rider) | `diagnosis` | `work_proof`
 *    | `safety` | `other` (mechanic).
 *  - `content_type` chỉ được `image/jpeg` | `image/png` | `image/webp`.
 *  - `sha256` BẮT BUỘC (hex 64 ký tự) — BE dùng để verify byte-for-byte sau
 *    khi upload. Không có `crypto.subtle` trên Hermes nên dùng helper thuần
 *    TS tại `@/lib/sha256`.
 *  - `size_bytes` BẮT BUỘC, ≥ 1 byte, ≤ 8MB.
 */
import { apiPost } from '@/lib/api';
import { newIdempotencyKey } from '@/lib/idempotency';
import { sha256Hex as sha256HexBytes } from '@/lib/sha256';

export type MediaResourceType = 'service_request' | 'assignment';

/** Purpose hợp lệ theo resource type (mirror BE). */
export type MediaPurpose =
  | 'problem_photo'
  | 'diagnosis'
  | 'work_proof'
  | 'safety'
  | 'other';

/**
 * Content type BE whitelist (storage provider cũng dùng để tạo object key).
 * `image/heic` / `image/heif` KHÔNG được — phải chuyển sang jpeg trước.
 */
export type MediaContentType = 'image/jpeg' | 'image/png' | 'image/webp';

export const MEDIA_CONTENT_TYPES: readonly MediaContentType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

/** Kích thước tối đa (mirror `MEDIA_MAX_BYTES` của BE = 8MB). */
export const MEDIA_MAX_BYTES = 8 * 1024 * 1024;

export interface CreateUploadIntentInput {
  resource_type: MediaResourceType;
  /** UUID của resource liên quan (request_id / assignment_id). */
  resource_id: string;
  purpose: MediaPurpose;
  content_type: MediaContentType;
  /** Kích thước bytes đã đo thực tế (bắt buộc). */
  size_bytes: number;
  /** SHA-256 hex của payload (lowercase, 64 ký tự) — bắt buộc. */
  sha256: string;
}

export interface UploadIntentResponse {
  intent_id: string;
  /** Signed PUT URL trỏ vào Supabase Storage. */
  upload_url: string;
  /** Path bắt buộc phải upload tới (BE gọi là `object_key`). */
  object_key: string;
  /** Method HTTP cho signed URL (luôn `PUT`). */
  upload_method: 'PUT';
  /** Header bắt buộc khi PUT (thường là `content-type`). */
  required_headers: Record<string, string>;
  /** Thời điểm hết hạn (sau thời điểm này URL sẽ không dùng được). */
  expires_at: string;
}

export interface FinalizedUploadResponse {
  intent_id: string;
  status: 'finalized';
  resource_type: MediaResourceType;
  resource_id: string;
  media: {
    id: string;
    purpose: string;
    content_type: string;
    size_bytes: number;
    created_at: string;
  };
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

/**
 * Finalize upload.
 *
 * BE đọc thông tin từ intent đã lưu (không nhận body) và tự verify
 * content-type / size / sha256 của object trên storage → nếu lệch sẽ xoá
 * object và trả 409.
 */
export async function finalizeUpload(
  intentId: string,
  options: { signal?: AbortSignal } = {},
): Promise<FinalizedUploadResponse> {
  return apiPost<FinalizedUploadResponse>(
    `/api/v1/media/upload-intents/${encodeURIComponent(intentId)}/finalize`,
    undefined,
    {
      headers: {
        'X-Idempotency-Key': newIdempotencyKey(),
      },
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
}

/**
 * Upload 1 file nhỏ qua fetch PUT tới signed URL. Throws nếu thất bại.
 * Với file > 5MB trên RN nên dùng XHR để stream.
 *
 * `required_headers` của BE thường là `{ "content-type": "image/jpeg" }`
 * (chữ thường). Nếu gửi kèm `Content-Type` (chữ hoa) → 2 header trùng
 * nhau → storage provider có thể từ chối signature. Vì vậy chuẩn hoá về
 * MỘT key `Content-Type` duy nhất.
 */
export async function putBytesToSignedUrl(
  url: string,
  bytes: ArrayBuffer | Uint8Array,
  contentType: MediaContentType,
  requiredHeaders: Record<string, string> = {},
): Promise<void> {
  const headers: Record<string, string> = {};
  let resolvedContentType = contentType;
  for (const [key, value] of Object.entries(requiredHeaders)) {
    if (key.toLowerCase() === 'content-type') {
      resolvedContentType = value as MediaContentType;
      continue;
    }
    headers[key] = value;
  }
  headers['Content-Type'] = resolvedContentType;

  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: bytes as BodyInit,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upload failed: ${res.status} ${text.slice(0, 200)}`);
  }
}

/** SHA-256 hex của ArrayBuffer (lowercase). */
export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  return sha256HexBytes(new Uint8Array(buf));
}

export function mediaErrorCode(err: unknown): string | null {
  if (err && typeof err === 'object' && 'errorCode' in err) {
    return String((err as { errorCode: string }).errorCode);
  }
  return null;
}
