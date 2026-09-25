/**
 * Cấu hình runtime cho mobile app.
 *
 * Thứ tự ưu tiên khi đọc `apiBaseUrl` (từ cao xuống thấp):
 *  1. `EXPO_PUBLIC_API_BASE_URL_OVERRIDE` - set qua terminal khi start Metro
 *     (vd: `pnpm start:lan` script tự detect IP LAN rồi set biến này).
 *     KHÔNG commit vào git, KHÔNG đặt vào .env.
 *  2. `EXPO_PUBLIC_API_BASE_URL` - set trong `.env` hoặc EAS profile.
 *  3. `APP_VARIANT` (EAS) + hardcoded fallback theo variant.
 *
 * Tại sao cần OVERRIDE?
 *  Khi dev trên thiết bị thật qua WiFi LAN, IP máy dev thường đổi (DHCP).
 *  Thay vì sửa .env mỗi lần, dùng `pnpm start:lan` tự detect IP.
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
  /** EAS variant (development | preview | staging | production) - phục vụ debug. */
  appVariant: string;
  /** Cho biết URL đang dùng có phải localhost không (emulator/simulator). */
  isLocalhost: boolean;
};

const DEFAULT_LOCAL_API_URL = 'http://localhost:3000';

/**
 * Hardcoded fallback theo EAS profile. CHỈ dùng cho production build khi
 * EAS secrets đã set. KHÔNG dùng cho dev.
 */
const VARIANT_FALLBACK: Record<string, string> = {
  production: 'https://api.careonroad.example',
  staging: 'https://staging-api.careonroad.example',
  preview: 'http://localhost:3000',
  development: DEFAULT_LOCAL_API_URL,
};

function isLocalhostUrl(url: string): boolean {
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1|10\.0\.2\.2)/i.test(url);
}

/**
 * Đọc env từ process.env một cách tường minh (mỗi biến 1 dòng).
 * Lint rule `expo/no-dynamic-env-var` không cho phép truy cập động, nên ta
 * đọc từng biến theo tên cố định. Điều này cũng giúp Metro tree-shake tốt hơn.
 */
function readEnv(): EnvShape {
  // 1) Override từ terminal (cao nhất)
  const override =
    typeof process.env.EXPO_PUBLIC_API_BASE_URL_OVERRIDE === 'string' &&
    process.env.EXPO_PUBLIC_API_BASE_URL_OVERRIDE.length > 0
      ? process.env.EXPO_PUBLIC_API_BASE_URL_OVERRIDE
      : null;

  // 2) Từ .env hoặc EAS profile env
  const fromEnv =
    typeof process.env.EXPO_PUBLIC_API_BASE_URL === 'string' &&
    process.env.EXPO_PUBLIC_API_BASE_URL.length > 0
      ? process.env.EXPO_PUBLIC_API_BASE_URL
      : null;

  // 3) Fallback theo APP_VARIANT (EAS)
  const variant =
    typeof process.env.APP_VARIANT === 'string' && process.env.APP_VARIANT.length > 0
      ? process.env.APP_VARIANT
      : 'development';
  const variantFallback = VARIANT_FALLBACK[variant] ?? DEFAULT_LOCAL_API_URL;

  const apiBaseUrl = override ?? fromEnv ?? variantFallback;

  return {
    apiBaseUrl,
    supabaseUrl:
      typeof process.env.EXPO_PUBLIC_SUPABASE_URL === 'string'
        ? process.env.EXPO_PUBLIC_SUPABASE_URL
        : '',
    supabaseAnonKey:
      typeof process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY === 'string'
        ? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
        : '',
    appVariant: variant,
    isLocalhost: isLocalhostUrl(apiBaseUrl),
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
