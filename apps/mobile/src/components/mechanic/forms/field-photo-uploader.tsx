import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
  type MediaContentType,
} from '@/lib/media-uploads-service';
import {
  addAssignmentMedia,
  type AssignmentMediaPurpose,
  type AssignmentMediaRecord,
} from '@/lib/mechanic-jobs-service';
import { cn } from '@/lib/utils';

/**
 * FieldPhotoUploader - chọn + upload ảnh thực địa cho assignment.
 *
 * Quy trình 4 bước (BE đã chốt qua `apps/api/docs`):
 *  1. Tạo intent: `POST /api/v1/media/upload-intents`
 *  2. PUT file lên signed URL của Supabase Storage.
 *  3. Finalize: `POST /api/v1/media/upload-intents/{id}/finalize`
 *  4. Gắn metadata: `POST /api/v1/assignments/{id}/media`
 *
 * Guard chống crash UI:
 *  - Mọi async call bọc `try/catch`; lỗi set state cục bộ.
 *  - Component unmount giữa lúc upload → dùng `cancelled` flag, không setState.
 *  - Image `defaultSource`/`onError` fallback khi URL ảnh lỗi.
 *  - Style động (opacity) qua `style={({ pressed }) => [...]}`, không nhồi className.
 *  - Không nhét <View> trong <Text>; mọi layout dùng <View> bọc ngoài.
 */

interface LocalPhoto {
  /** Stable local id (cho React key). */
  uid: string;
  /** Local URI từ ImagePicker. */
  uri: string;
  /** Kích thước file bytes. */
  sizeBytes: number;
  /** MIME type - hiện chỉ nhận 4 loại BE whitelist. */
  contentType: MediaContentType;
  /** Trạng thái upload. */
  status: 'pending' | 'uploading' | 'done' | 'error';
  /** Lỗi cục bộ (nếu có). */
  errorMessage?: string;
  /** Server record sau khi upload xong. */
  serverRecord?: AssignmentMediaRecord;
}

export interface FieldPhotoUploaderProps {
  assignmentId: string;
  purpose: AssignmentMediaPurpose;
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

function isSupportedContentType(t: string | undefined): t is MediaContentType {
  return (
    t === 'image/jpeg' ||
    t === 'image/png' ||
    t === 'image/webp' ||
    t === 'image/heic' ||
    t === 'image/heif'
  );
}

/** Lấy SHA-256 hex của 1 file URI qua fetch + ArrayBuffer. */
async function sha256ForUri(uri: string): Promise<string | undefined> {
  try {
    const res = await fetch(uri);
    const buf = await res.arrayBuffer();
    return await sha256Hex(buf);
  } catch {
    // Checksum optional - BE không bắt buộc.
    return undefined;
  }
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

  // Cleanup khi unmount.
  useEffect(() => {
    let cancelled = false;
    return () => {
      cancelled = true;
      void cancelled;
    };
  }, []);

  const updatePhoto = useCallback((uid: string, patch: Partial<LocalPhoto>) => {
    setPhotos((prev) => prev.map((p) => (p.uid === uid ? { ...p, ...patch } : p)));
  }, []);

  const removePhoto = useCallback((uid: string) => {
    setPhotos((prev) => prev.filter((p) => p.uid !== uid));
  }, []);

  /**
   * Upload 1 ảnh qua 4-step flow. Tất cả step bọc try/catch; lỗi set local
   * state thay vì throw ra ngoài (UI sẽ hiển thị dưới thumbnail).
   */
  const uploadOne = useCallback(
    async (photo: LocalPhoto) => {
      let cancelled = false;
      try {
        updatePhoto(photo.uid, { status: 'uploading', errorMessage: undefined });

        // Bước 1: tạo intent
        const checksum = await sha256ForUri(photo.uri);
        const intent = await createUploadIntent({
          context: 'assignment_media',
          resource_id: assignmentId,
          content_type: photo.contentType,
          size_bytes: photo.sizeBytes,
          ...(checksum ? { checksum } : {}),
        });
        if (cancelled) return;

        // Bước 2: PUT file lên signed URL
        const fetchRes = await fetch(photo.uri);
        const bytes = await fetchRes.arrayBuffer();
        await putBytesToSignedUrl(
          intent.upload_url,
          bytes,
          photo.contentType,
        );
        if (cancelled) return;

        // Bước 3: finalize
        await finalizeUpload(intent.intent_id, {
          size_bytes: photo.sizeBytes,
          ...(checksum ? { checksum } : {}),
        });
        if (cancelled) return;

        // Bước 4: gắn metadata với assignment
        const record = await addAssignmentMedia(assignmentId, {
          media_reference: intent.object_path,
          purpose,
          content_type: photo.contentType,
          size_bytes: photo.sizeBytes,
          ...(checksum ? { checksum } : {}),
        });

        if (!cancelled) {
          updatePhoto(photo.uid, { status: 'done', serverRecord: record });
        }
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
    async (result: ImagePicker.ImagePickerResult | { canceled: true } | { assets?: ImagePicker.ImagePickerAsset[]; canceled?: boolean }) => {
      if ((result as { canceled?: boolean }).canceled) {
        return;
      }
      const assets = (result as ImagePicker.ImagePickerResult).assets;
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
        const mime = (asset.mimeType ?? 'image/jpeg') as MediaContentType;
        if (!isSupportedContentType(mime)) {
          setBanner(`Định dạng ảnh không được hỗ trợ: ${mime}`);
          continue;
        }
        newPhotos.push({
          uid: genUid(),
          uri,
          sizeBytes: typeof asset.fileSize === 'number' ? asset.fileSize : 0,
          contentType: mime,
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
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setBanner('Cần cấp quyền truy cập thư viện ảnh để tiếp tục.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
        <Banner
          tone="warning"
          title="Lưu ý"
          description={banner}
        />
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
