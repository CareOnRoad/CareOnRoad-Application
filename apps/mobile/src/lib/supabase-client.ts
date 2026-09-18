/**
 * Supabase client wrapper + AsyncStorage adapter cho phép duy trì phiên đăng nhập
 * giữa các lần mở app.
 *
 * - `supabaseClient`: instance Supabase duy nhất, cấu hình qua env.
 * - `createAsyncStorageAdapter()`: adapter tuân thủ Supabase SupportedStorage,
 *   giúp session được persist vào AsyncStorage và tự động restore khi app mở.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';

import { getEnv } from '@/lib/config';

/**
 * AsyncStorage adapter tuân thủ interface `SupportedStorage` của Supabase.
 * Lưu session dưới dạng JSON string với prefix để tránh xung đột với key khác.
 */
function createAsyncStorageAdapter(): SupportedStorage {
  const PREFIX = 'careonroad.supabase.';
  return {
    async getItem(key: string) {
      try {
        return await AsyncStorage.getItem(`${PREFIX}${key}`);
      } catch {
        return null;
      }
    },
    async setItem(key: string, value: string) {
      try {
        await AsyncStorage.setItem(`${PREFIX}${key}`, value);
      } catch {
        // Bỏ qua lỗi storage - auth vẫn hoạt động trong phiên hiện tại
      }
    },
    async removeItem(key: string) {
      try {
        await AsyncStorage.removeItem(`${PREFIX}${key}`);
      } catch {
        // Bỏ qua lỗi storage
      }
    },
  };
}

/**
 * Tạo Supabase client.
 *
 * Nếu env chưa cấu hình (chưa set EXPO_PUBLIC_SUPABASE_URL/ANON_KEY),
 * trả về null. AuthContext sẽ dùng fallback "demo mode" để app vẫn chạy
 * được và báo cho dev biết cần setup backend.
 */
let clientInstance: ReturnType<typeof createClient> | null = null;
let clientInitialized = false;

export function getSupabase(): ReturnType<typeof createClient> | null {
  if (clientInitialized) return clientInstance;
  clientInitialized = true;
  const env = getEnv();
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn(
        '[supabase] EXPO_PUBLIC_SUPABASE_URL/ANON_KEY chưa được cấu hình. ' +
          'App sẽ chạy ở chế độ demo (không có auth thật).',
      );
    }
    clientInstance = null;
    return null;
  }
  clientInstance = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      storage: createAsyncStorageAdapter(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return clientInstance;
}
