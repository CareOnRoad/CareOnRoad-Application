/**
 * Avatar upload helper - MVP scope (Mục 4 plan).
 *
 * BE hiện tại chưa có resource type `user_profile` cho media-upload-intents
 * (chỉ whitelist `service_request` và `assignment`). Vì vậy trong scope
 * này ta chỉ:
 *  1. Mở image picker (expo-image-picker đã có sẵn trong package.json).
 *  2. Trả về local URI (file://...) để caller lưu AsyncStorage qua
 *     `LocalProfile.avatar` (đã có sẵn field `avatar: string`).
 *  3. UI render local URI ngay (React Native <Image> chấp nhận file:// URI).
 *
 * Khi BE bổ sung `user_profile` resource_type cho media-upload thì sẽ thay
 * thế phần "fetch bytes → createUploadIntent → PUT → finalize" (tương tự
 * `FieldPhotoUploader`). Wrapper hiện tại được thiết kế để chuyển sang mode
 * upload-to-BE mà không phải đổi signature của `pickAndUploadAvatar`.
 */
import * as ImagePicker from 'expo-image-picker';

export type PickedAvatar = {
  uri: string;
  sizeBytes: number;
  contentType: string;
  width?: number;
  height?: number;
};

/**
 * Mở gallery, user chọn 1 ảnh. Trả về local URI + metadata.
 * Trả `null` nếu user huỷ.
 *
 * Lưu ý security/permission:
 *  - iOS: cần `NSPhotoLibraryUsageDescription` trong `app.config.ts`.
 *  - Android: cần `READ_MEDIA_IMAGES` permission.
 *  - Helper này KHÔNG tự request permission vì caller (EditProfileSheet)
 *    sẽ check trước và show banner nếu deny.
 */
export async function pickAvatarFromLibrary(
  options: { quality?: number } = {},
): Promise<PickedAvatar | null> {
  const quality = options.quality ?? 0.85;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    allowsMultipleSelection: false,
    quality,
    exif: false,
  });

  if (result.canceled) {
    return null;
  }
  const asset = result.assets[0];
  if (!asset || !asset.uri) {
    return null;
  }
  return {
    uri: asset.uri,
    sizeBytes: typeof asset.fileSize === 'number' ? asset.fileSize : 0,
    contentType: asset.mimeType ?? 'image/jpeg',
    ...(typeof asset.width === 'number' ? { width: asset.width } : {}),
    ...(typeof asset.height === 'number' ? { height: asset.height } : {}),
  };
}

/**
 * Mở camera, user chụp 1 ảnh. Trả về local URI + metadata.
 * Trả `null` nếu user huỷ hoặc thiếu permission.
 *
 * Lưu ý: yêu cầu permission camera (`NSCameraUsageDescription` trên iOS).
 */
export async function captureAvatarFromCamera(
  options: { quality?: number } = {},
): Promise<PickedAvatar | null> {
  const quality = options.quality ?? 0.85;
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Cần cấp quyền camera để chụp ảnh.');
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality,
    exif: false,
  });

  if (result.canceled) {
    return null;
  }
  const asset = result.assets[0];
  if (!asset || !asset.uri) {
    return null;
  }
  return {
    uri: asset.uri,
    sizeBytes: typeof asset.fileSize === 'number' ? asset.fileSize : 0,
    contentType: asset.mimeType ?? 'image/jpeg',
    ...(typeof asset.width === 'number' ? { width: asset.width } : {}),
    ...(typeof asset.height === 'number' ? { height: asset.height } : {}),
  };
}

/**
 * Convenience: xin permission gallery + mở picker. Throw nếu deny.
 */
export async function pickAvatar(): Promise<PickedAvatar | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Cần cấp quyền truy cập thư viện ảnh để tiếp tục.');
  }
  return pickAvatarFromLibrary();
}