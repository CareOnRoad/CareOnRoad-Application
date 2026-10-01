/**
 * Profile service - hỗ trợ cache local cho UI trong khi BE xử lý chính.
 *
 * Lưu ý: Profile (name/phone/email/avatar/address) hiện đã được BE lưu qua
 * `PATCH /api/v1/auth/profile` và `GET /api/v1/auth/me`. AsyncStorage chỉ còn
 * đóng vai trò cache tạm để UI hydrate ngay khi mở tab Profile (tránh flash
 * rỗng) trước khi AuthContext refresh actor.
 *
 * Source of truth là BE - cache này sẽ được cập nhật lại mỗi khi
 * `AuthContext.updateProfile()` hoặc hydrate từ session.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_PREFIX = 'careonroad.profile.v1.';

/**
 * Profile đầy đủ lưu trên thiết bị.
 *
 * Avatar là URL tuyệt đối (https://...) hoặc data URI sau khi user chọn ảnh.
 */
export interface LocalProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  avatar: string;
  updatedAt: string;
}

function key(userId: string): string {
  return `${PROFILE_PREFIX}${userId}`;
}

/**
 * Đọc profile local theo user id. Trả về null nếu chưa có.
 */
export async function loadProfile(userId: string): Promise<LocalProfile | null> {
  if (!userId) return null;
  const stored = await AsyncStorage.getItem(key(userId));
  if (!stored) return null;
  try {
    return JSON.parse(stored) as LocalProfile;
  } catch {
    return null;
  }
}

/**
 * Lưu profile local, ghi đè nếu đã có. Dùng để cache dữ liệu BE trả về.
 */
export async function saveProfile(profile: LocalProfile): Promise<void> {
  if (!profile.id) throw new Error('Profile phải có id');
  const payload: LocalProfile = {
    ...profile,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(key(profile.id), JSON.stringify(payload));
}

/**
 * Xoá profile local (khi logout nếu muốn).
 */
export async function clearProfile(userId: string): Promise<void> {
  if (!userId) return;
  await AsyncStorage.removeItem(key(userId));
}
