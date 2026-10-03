/**
 * Service đăng ký device (push token) với backend.
 *
 * Backend schema:
 *  - POST /api/v1/auth/devices
 *    { device_key: string (8-1000), platform: string, push_provider?, push_token? }
 *    Header: X-Idempotency-Key
 *  - PUT  /api/v1/auth/devices/{deviceId}/push-token
 *    { push_provider: 'fcm'|'apns'|'webpush', push_token: string (8-4096) }
 *
 * `device_key` là chuỗi client-generated định danh device (vd: UUID + tên máy).
 * Backend hash + lưu; idempotency key ngăn đăng ký trùng.
 *
 * Im lặng khi fail: đăng ký device không quan trọng bằng login → chỉ log warn.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { apiPost, apiPut } from '@/lib/api';
import { newIdempotencyKey } from '@/lib/idempotency';

const DEVICE_KEY_STORAGE = 'careonroad.device.key.v1';

interface DeviceResponse {
  id?: string;
  device_id?: string;
  platform?: string;
  enabled?: boolean;
  push_token_registered?: boolean;
}

interface PersistedDeviceKey {
  key: string;
  deviceId?: string;
}

function resolvePlatform(): string {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'web') return 'web';
  return (Platform.OS || 'unknown').toLowerCase();
}

/**
 * Sinh `device_key` ổn định cho mỗi lần cài app (giữ qua các session).
 * Lưu AsyncStorage để dùng lại; nếu mất (clear data) thì sinh mới.
 */
async function getOrCreateDeviceKey(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_KEY_STORAGE);
  if (existing && existing.length >= 8) return existing;
  const fresh = `dev_${newIdempotencyKey().replace(/-/g, '')}`;
  await AsyncStorage.setItem(DEVICE_KEY_STORAGE, fresh);
  return fresh;
}

async function loadPersistedDeviceKey(): Promise<PersistedDeviceKey | null> {
  const raw = await AsyncStorage.getItem(DEVICE_KEY_STORAGE);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedDeviceKey;
  } catch {
    return { key: raw };
  }
}

async function persistDeviceKey(p: PersistedDeviceKey): Promise<void> {
  await AsyncStorage.setItem(DEVICE_KEY_STORAGE, JSON.stringify(p));
}

/**
 * Đăng ký device với backend (idempotent qua header X-Idempotency-Key).
 * Cache device_id trong AsyncStorage để lần sau gọi `updatePushToken` không phải
 * register lại.
 *
 * @returns device id nếu thành công, null nếu fail (im lặng).
 */
export async function registerCurrentDevice(): Promise<string | null> {
  try {
    const persisted = await loadPersistedDeviceKey();
    if (persisted?.deviceId) return persisted.deviceId;

    const deviceKey = persisted?.key ?? (await getOrCreateDeviceKey());
    const idem = newIdempotencyKey();
    const res = await apiPost<DeviceResponse>(
      '/api/v1/auth/devices',
      {
        device_key: deviceKey,
        platform: resolvePlatform(),
      },
      {
        headers: { 'X-Idempotency-Key': idem },
        timeoutMs: 15000,
      },
    );
    const deviceId = res.id ?? res.device_id ?? null;
    if (deviceId) {
      await persistDeviceKey({ key: deviceKey, deviceId });
    }
    return deviceId;
  } catch (err) {
    if (__DEV__) {
      // Log đầy đủ stack để debug 500 errors từ BE.
      // eslint-disable-next-line no-console
      console.warn(
        '[device] register failed:',
        err instanceof Error ? err.message : err,
        err,
      );
    }
    return null;
  }
}

/**
 * Cập nhật push token cho device đã đăng ký.
 * BE: PUT /api/v1/auth/devices/{deviceId}/push-token
 * Body: `{ push_provider, push_token }`
 */
export async function updatePushToken(
  deviceId: string,
  token: string,
  provider: 'fcm' | 'apns' | 'webpush' = 'fcm',
): Promise<void> {
  await apiPut(`/api/v1/auth/devices/${encodeURIComponent(deviceId)}/push-token`, {
    push_provider: provider,
    push_token: token,
  });
}

/**
 * Đảm bảo device đã được đăng ký; nếu có pushToken thì set luôn.
 * An toàn gọi nhiều lần (idempotent + cache).
 */
export async function ensureDeviceRegistered(pushToken?: string): Promise<string | null> {
  const deviceId = await registerCurrentDevice();
  if (deviceId && pushToken && pushToken.length >= 8) {
    try {
      await updatePushToken(deviceId, pushToken);
    } catch (err) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[device] push token update failed:', err instanceof Error ? err.message : err);
      }
    }
  }
  return deviceId;
}

/**
 * Phát hiện Expo push token khi có sẵn (expo-notifications).
 * Stub: luôn trả null vì expo-notifications chưa được cài.
 * Khi cần push notification, cài expo-notifications và uncomment.
 */
export async function maybeGetExpoPushToken(): Promise<string | null> {
  return null;
}
