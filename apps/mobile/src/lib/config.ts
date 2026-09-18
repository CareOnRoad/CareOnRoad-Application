/**
 * Cấu hình runtime cho mobile app.
 *
 * Tất cả giá trị đền có thể được override qua:
 *  - biến môi trường khi build (Expo EXPO_PUBLIC_*)
 *  - file `.env` trong apps/mobile/
 *
 * Expo sẽ tự inject các biến EXPO_PUBLIC_* vào process.env khi bundle.
 *
 * ⚠️ KHÔNG commit giá trị thật vào git. Dùng `.env` (gitignore) cho dev.
 */

type EnvShape = {
  /** Backend API base URL (Next.js server). */
  apiBaseUrl: string;
  /** Supabase project URL. */
  supabaseUrl: string;
  /** Supabase anon key (publishable key). */
  supabaseAnonKey: string;
};

const DEFAULT_API_BASE_URL = 'http://localhost:3000';

/**
 * Đọc env từ process.env một cách tường minh (mỗi biến 1 dòng).
 * Lint rule `expo/no-dynamic-env-var` không cho phép truy cập động, nên ta
 * đọc từng biến theo tên cố định. Điều này cũng giúp Metro tree-shake tốt hơn.
 */
function readEnv(): {
  apiBaseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
} {
  return {
    apiBaseUrl:
      typeof process.env.EXPO_PUBLIC_API_BASE_URL === 'string' &&
      process.env.EXPO_PUBLIC_API_BASE_URL.length > 0
        ? process.env.EXPO_PUBLIC_API_BASE_URL
        : DEFAULT_API_BASE_URL,
    supabaseUrl:
      typeof process.env.EXPO_PUBLIC_SUPABASE_URL === 'string'
        ? process.env.EXPO_PUBLIC_SUPABASE_URL
        : '',
    supabaseAnonKey:
      typeof process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY === 'string'
        ? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
        : '',
  };
}

/**
 * Singleton config. Trả về warning nếu env thiếu - mobile vẫn chạy được nhưng
 * auth flow sẽ fail. Các màn hình login sẽ báo lỗi cụ thể khi cố gọi API.
 */
let cached: EnvShape | null = null;

export function getEnv(): EnvShape {
  if (!cached) cached = readEnv();
  return cached;
}

/**
 * Trả về true nếu đã cấu hình đủ cho auth (Supabase URL + anon key).
 * Dùng để gate UI demo fallback khi chưa setup backend.
 */
export function isAuthConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.supabaseUrl) && Boolean(env.supabaseAnonKey);
}
