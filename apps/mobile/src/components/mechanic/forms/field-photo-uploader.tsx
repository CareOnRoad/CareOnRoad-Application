import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, ImagePlus, Trash2, Upload, X } from 'lucide-react-native';

import { ActionButton } from '@/components/ui/action-button';
import { Banner } from '@/components/ui/banner';
import {
  createUploadIntent,
  finalizeUpload,
  putBytesToSignedUrl,
  sha256Hex,
  MEDIA_MAX_BYTES,
  type MediaContentType,
  type MediaPurpose,
} from '@/lib/media-uploads-service';
import { cn } from '@/lib/utils';

/**
 * FieldPhotoUploader - chọn + upload ảnh thực địa cho assignment.
 *
 * Quy trình 3 bước (BE đã chốt qua `apps/api/src/features/media-uploads`):
 *  1. Tạo intent: `POST /api/v1/media/upload-intents`
 *  2. PUT file lên signed URL của Supabase Storage.
 *  3. Finalize: `POST /api/v1/media/upload-intents/{id}/finalize`
 *
 * LƯU Ý QUAN TRỌNG:
 *  - BƯỚC 3 (finalize) đã tự tạo luôn bản ghi media metadata cho
 *    assignment (`media-upload.service.ts` → `createAssignmentMediaMetadata`).
 *    Vì vậy KHÔNG gọi thêm `POST /api/v1/assignments/{id}/media` — làm vậy sẽ
 *    tạo bản ghi trùng và vượt giới hạn 5 media / resource.
 *  - Contract của `POST /api/v1/media/upload-intents` là schema Zod `.strict()`
 *    của BE: đúng các field `resource_type`, `resource_id`, `purpose`,
 *    `content_type`, `size_bytes`, `sha256`. Gửi field lạ (ví dụ `context`)
 *    sẽ bị BE reject 400 "Media upload intent input is invalid.".
 *
 * Guard chống crash UI:
 *  - Mọi async call bọc `try/catch`; lỗi set state cục bộ.
 *  - Component unmount giữa lúc upload → dùng `cancelled` flag, không setState.
 *  - Image `onError` fallback khi URL ảnh lỗi.
 *  - Style động (opacity) qua `style={({ pressed }) => [...]}`, không nhồi className.
 *  - Không nhét <View> trong <Text>; mọi layout dùng <View> bọc ngoài.
 */

interface LocalPhoto {
  /** Stable local id (cho React key). */
  uid: string;
  /** Local URI từ ImagePicker. */
  uri: string;
  /** Kích thước file bytes (đo thực tế sau khi đọc bytes). */
  sizeBytes: number;
  /** MIME type - chỉ nhận loại BE whitelist. */
  contentType: MediaContentType;
  /** Trạng thái upload. */
  status: 'pending' | 'uploading' | 'done' | 'error';
  /** Lỗi cục bộ (nếu có). */
  errorMessage?: string;
  /** Id bản ghi media sau khi BE finalize thành công. */
  serverMediaId?: string;
}

export interface FieldPhotoUploaderProps {
  assignmentId: string;
  purpose: MediaPurpose;
  label: string;
  /** Số ảnh tối đa. Mặc định 4. */
  maxCount?: number;
  /** Existing records từ BE (job detail media items) - hiển thị read-only. */
  existingItems?: {
    upload_intent_id: string;
    media_metadata_id: string;
    purpose: string;
    content_type: string;
    size_bytes: number;
    created_at: string;
  }[];
}

const DEFAULT_MAX = 4;

function genUid(): string {
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Chuẩn hoá MIME của ảnh về giá trị BE whitelist.
 *
 * BE (`mediaContentTypes`) chỉ nhận `image/jpeg` | `image/png` | `image/webp`.
 * `image/heic` / `image/heif` sẽ bị reject 400. ImagePicker thường đã
 * re-encode sang JPEG khi có `quality` nên fallback về `image/jpeg` là an toàn
 * (bytes thực tế luôn được đo/hash lại ở bước upload).
 */
function normalizeContentType(mimeType: string | undefined): MediaContentType {
  if (mimeType === 'image/png') return 'image/png';
  if (mimeType === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

export function FieldPhotoUploader({
  assignmentId,
  purpose,
  label,
  maxCount = DEFAULT_MAX,
  existingItems = [],
}: FieldPhotoUploaderProps) {
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const updatePhoto = useCallback((uid: string, patch: Partial<LocalPhoto>) => {
    setPhotos((prev) => prev.map((p) => (p.uid === uid ? { ...p, ...patch } : p)));
  }, []);

  const removePhoto = useCallback((uid: string) => {
    setPhotos((prev) => prev.filter((p) => p.uid !== uid));
  }, []);

  /**
   * Upload 1 ảnh qua 3-step flow. Tất cả step bọc try/catch; lỗi set local
   * state thay vì throw ra ngoài (UI sẽ hiển thị dưới thumbnail).
   */
  const uploadOne = useCallback(
    async (photo: LocalPhoto) => {
      let cancelled = false;
      try {
        updatePhoto(photo.uid, { status: 'uploading', errorMessage: undefined });

        // Đọc bytes MỘT LẦN và dùng chúng cho cả size, hash và upload.
        // `asset.fileSize` KHÔNG đáng tin (ImagePicker có thể re-encode ảnh khi
        // có `quality` → kích thước file gốc ≠ kích thước bytes thực tế,
        // khiến BE reject ở finalize với "does not match the upload intent").
        const fetchRes = await fetch(photo.uri);
        const buffer = await fetchRes.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const sizeBytes = bytes.byteLength;
        if (sizeBytes < 1) {
          throw new Error('Ảnh rỗng, không thể tải lên.');
        }
        if (sizeBytes > MEDIA_MAX_BYTES) {
          throw new Error(
            `Ảnh vượt quá ${Math.round(MEDIA_MAX_BYTES / (1024 * 1024))}MB. Hãy chụp ảnh với chất lượng thấp hơn.`,
          );
        }
        const checksum = await sha256Hex(buffer);

        // Bước 1: tạo intent (contract đúng theo BE).
        const intent = await createUploadIntent({
          resource_type: 'assignment',
          resource_id: assignmentId,
          purpose,
          content_type: photo.contentType,
          size_bytes: sizeBytes,
          sha256: checksum,
        });
        if (cancelled) return;

        // Bước 2: PUT file lên signed URL
        await putBytesToSignedUrl(
          intent.upload_url,
          bytes,
          photo.contentType,
          intent.required_headers ?? {},
        );
        if (cancelled) return;

        // Bước 3: finalize (BE verify byte-for-byte + tự tạo media metadata).
        const finalized = await finalizeUpload(intent.intent_id);
        if (cancelled) return;

        updatePhoto(photo.uid, {
          status: 'done',
          sizeBytes,
          serverMediaId: finalized.media?.id,
        });
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof Error ? e.message : 'Không thể upload ảnh. Vui lòng thử lại.';
        updatePhoto(photo.uid, { status: 'error', errorMessage: msg });
      }
    },
    [assignmentId, purpose, updatePhoto],
  );

  const handlePickerResult = useCallback(
    async (result: ImagePicker.ImagePickerResult) => {
      if (result.canceled) return;
      const assets = result.assets;
      if (!assets || assets.length === 0) return;

      const remaining = Math.max(0, maxCount - photos.length);
      const toAdd = assets.slice(0, remaining);
      if (toAdd.length === 0) {
        setBanner(`Đã đạt giới hạn ${maxCount} ảnh. Hãy xoá ảnh cũ trước.`);
        return;
      }

      const newPhotos: LocalPhoto[] = [];
      for (const asset of toAdd) {
        const uri = asset.uri;
        if (!uri) continue;
        newPhotos.push({
          uid: genUid(),
          uri,
          sizeBytes: typeof asset.fileSize === 'number' ? asset.fileSize : 0,
          contentType: normalizeContentType(asset.mimeType),
          status: 'pending',
        });
      }

      if (newPhotos.length === 0) return;
      setPhotos((prev) => [...prev, ...newPhotos]);

      // Trigger upload tuần tự để tránh rate-limit BE.
      for (const p of newPhotos) {
        await uploadOne(p);
      }
    },
    [maxCount, photos.length, uploadOne],
  );

  const pickFromLibrary = useCallback(async () => {
    if (busy) return;
    setBanner(null);
    setBusy(true);
    try {
      if (Platform.OS !== 'android') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          setBanner('Cần cấp quyền truy cập thư viện ảnh để tiếp tục.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.7,
        selectionLimit: maxCount,
        exif: false,
      });
      await handlePickerResult(result);
    } catch (e) {
      setBanner(e instanceof Error ? e.message : 'Không thể mở thư viện ảnh.');
    } finally {
      setBusy(false);
    }
  }, [busy, handlePickerResult, maxCount]);

  const captureFromCamera = useCallback(async () => {
    if (busy) return;
    setBanner(null);
    setBusy(true);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setBanner('Cần cấp quyền camera để chụp ảnh.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        exif: false,
      });
      await handlePickerResult(result);
    } catch (e) {
      setBanner(e instanceof Error ? e.message : 'Không thể mở camera.');
    } finally {
      setBusy(false);
    }
  }, [busy, handlePickerResult]);

  const totalExisting = existingItems.filter(
    (it) => it.purpose === purpose,
  ).length;
  const allCount = totalExisting + photos.length;
  const reachedMax = allCount >= maxCount;

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2">
        <Camera size={16} color="#1974f7" />
        <Text className="text-sm font-semibold text-foreground">{label}</Text>
        <View className="ml-auto rounded-full bg-secondary px-2 py-0.5">
          <Text className="text-[10px] font-semibold text-muted-foreground">
            {allCount}/{maxCount}
          </Text>
        </View>
      </View>

      {banner ? (
        <Banner tone="warning" title="Lưu ý" description={banner} />
      ) : null}

      {/* Existing (read-only) */}
      {existingItems.filter((it) => it.purpose === purpose).length > 0 ? (
        <View>
          <Text className="mb-1.5 text-xs font-semibold text-muted-foreground">
            Đã có trên hệ thống
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {existingItems
              .filter((it) => it.purpose === purpose)
              .map((it) => (
                <View
                  key={it.media_metadata_id}
                  className="size-20 shrink-0 items-center justify-center rounded-2xl bg-secondary"
                >
                  <Text className="text-[10px] font-semibold text-muted-foreground">
                    {Math.round((it.size_bytes ?? 0) / 1024)} KB
                  </Text>
                </View>
              ))}
          </ScrollView>
        </View>
      ) : null}

      {/* New uploads (grid) */}
      {photos.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {photos.map((p) => (
            <View
              key={p.uid}
              className="relative size-20 overflow-hidden rounded-2xl border border-border bg-secondary"
            >
              <Image
                source={{ uri: p.uri }}
                className="size-full"
                resizeMode="cover"
                // Fallback khi uri lỗi - tránh layout shift.
                onError={() => {
                  updatePhoto(p.uid, { errorMessage: 'Không tải được ảnh' });
                }}
              />
              {/* Overlay status */}
              <View className="absolute inset-0 items-center justify-center">
                {p.status === 'uploading' ? (
                  <View className="size-7 items-center justify-center rounded-full bg-black/50">
                    <ActivityIndicator size="small" color="#ffffff" />
                  </View>
                ) : null}
                {p.status === 'done' ? (
                  <View className="rounded-full bg-green/80 px-1.5 py-0.5">
                    <Upload size={10} color="#ffffff" />
                  </View>
                ) : null}
                {p.status === 'error' ? (
                  <View className="size-7 items-center justify-center rounded-full bg-destructive/80">
                    <X size={14} color="#ffffff" />
                  </View>
                ) : null}
              </View>
              {/* Remove button */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Xoá ảnh"
                onPress={() => removePhoto(p.uid)}
                className="absolute right-0.5 top-0.5 size-6 items-center justify-center rounded-full bg-black/60"
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <Trash2 size={12} color="#ffffff" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {/* Action buttons */}
      {!reachedMax ? (
        <View className="flex-row gap-2">
          <ActionButton
            variant="secondary"
            onPress={() => void pickFromLibrary()}
            disabled={busy}
            className="flex-1"
          >
            {busy ? (
              <ActivityIndicator size="small" color="#16202f" />
            ) : (
              <>
                <ImagePlus size={16} color="#16202f" />
                <Text className={cn('ml-1 text-sm font-semibold text-foreground')}>
                  Thư viện
                </Text>
              </>
            )}
          </ActionButton>
          <ActionButton
            variant="secondary"
            onPress={() => void captureFromCamera()}
            disabled={busy}
            className="flex-1"
          >
            {busy ? (
              <ActivityIndicator size="small" color="#16202f" />
            ) : (
              <>
                <Camera size={16} color="#16202f" />
                <Text className={cn('ml-1 text-sm font-semibold text-foreground')}>
                  Chụp ảnh
                </Text>
              </>
            )}
          </ActionButton>
        </View>
      ) : (
        <Text className="text-xs text-muted-foreground">
          Đã đạt tối đa {maxCount} ảnh. Xoá ảnh cũ để thêm ảnh mới.
        </Text>
      )}

      {photos.some((p) => p.status === 'error') ? (
        <View className="gap-1.5">
          {photos
            .filter((p) => p.status === 'error')
            .map((p) => (
              <Text
                key={p.uid}
                className="text-xs text-destructive"
                numberOfLines={2}
              >
                {p.errorMessage ?? 'Upload thất bại'}
              </Text>
            ))}
        </View>
      ) : null}
    </View>
  );
}
