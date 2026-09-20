/**
 * Profile service - lưu trữ thông tin user mở rộng vào AsyncStorage.
 *
 * Phase 1 (MVP): lưu local, không đồng bộ BE.
 * Phase 2: thêm PATCH /api/v1/auth/profile với fields name/phone/email/avatar.
 *
 * Lưu ý: Profile chỉ là bản cache local. Source of truth là auth-context (BE
 * cho production, AsyncStorage session cho demo).
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
 * Lưu profile local, ghi đè nếu đã có.
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

/**
 * Validate các trường trước khi save.
 * Trả về mảng lỗi tiếng Việt; rỗng = OK.
 */
export function validateProfile(input: {
  name: string;
  email: string;
  phone: string;
}): string[] {
  const errors: string[] = [];
  const name = input.name.trim();
  if (name.length < 2) {
    errors.push('Họ và tên phải có ít nhất 2 ký tự.');
  } else if (name.length > 120) {
    errors.push('Họ và tên không quá 120 ký tự.');
  }
  const email = input.email.trim();
  if (!email) {
    errors.push('Vui lòng nhập email.');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Email không hợp lệ.');
  }
  const phone = input.phone.trim();
  if (phone) {
    // Cho phép linh hoạt: +84..., 0xxx, có khoảng trắng/dấu gạch ngang.
    const digits = phone.replace(/[^\d]/g, '');
    if (digits.length < 9 || digits.length > 13) {
      errors.push('Số điện thoại phải có 9-13 chữ số.');
    }
  }
  return errors;
}
