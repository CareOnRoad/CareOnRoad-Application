import type { ExpoConfig } from 'expo/config';

/**
 * app.config.ts - dynamic Expo config.
 *
 * Đọc các biến môi trường tại build-time:
 *  - APP_VARIANT: development | preview | staging | production (set bởi EAS)
 *  - EXPO_PUBLIC_API_BASE_URL: URL backend
 *  - EXPO_PUBLIC_SUPABASE_URL: Supabase project URL
 *
 * Lợi ích:
 *  - Cùng source code build cho nhiều môi trường chỉ bằng cách đổi env.
 *  - Bundle ID và tên app có thể khác nhau giữa dev/production.
 *  - Không cần sửa file JSON thủ công khi chuyển môi trường.
 */

const variant = process.env.APP_VARIANT ?? 'development';

const variantSettings: Record<
  string,
  { name: string; bundleSuffix: string; packageSuffix: string }
> = {
  development: { name: 'CareOnRoad (Dev)', bundleSuffix: '.dev', packageSuffix: '.dev' },
  preview: { name: 'CareOnRoad (Preview)', bundleSuffix: '.preview', packageSuffix: '.preview' },
  staging: { name: 'CareOnRoad (Staging)', bundleSuffix: '.staging', packageSuffix: '.staging' },
  production: { name: 'CareOnRoad', bundleSuffix: '', packageSuffix: '' },
};

const settings = variantSettings[variant] ?? variantSettings.development;

const config: ExpoConfig = {
  name: settings.name,
  slug: 'careonroad-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  // URL scheme cho deep-link (vd: careonroad://auth/callback).
  // Supabase OAuth redirect về scheme này sau khi user đăng nhập Google.
  scheme: ['careonroad'],
  splash: {
    backgroundColor: '#16202f',
  },
  assetBundlePatterns: ['**/*'],
  newArchEnabled: true,
  ios: {
    supportsTablet: false,
    bundleIdentifier: `com.careonroad.mobile${settings.bundleSuffix}`,
    infoPlist: {
      NSCameraUsageDescription:
        'CareOnRoad needs camera to take photos of motorcycle issues',
      NSLocationWhenInUseUsageDescription:
        'CareOnRoad needs location to find nearby mechanics',
      NSPhotoLibraryUsageDescription:
        'CareOnRoad needs photo library to send issue photos',
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#16202f',
    },
    package: `com.careonroad.mobile${settings.packageSuffix}`,
    permissions: ['CAMERA', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'],
    // Intent filter để Android nhận deep-link scheme careonroad://
    // (vd: careonroad://auth/callback từ Google OAuth redirect).
    // Lưu ý Android 11+ (API 30+) yêu cầu cả scheme + host/pathPrefix rõ ràng
    // để intent filter hoạt động chính xác; chỉ khai báo scheme có thể bị
    // OS bỏ qua khi app không ở foreground.
    intentFilters: [
      {
        action: 'VIEW',
        category: ['DEFAULT', 'BROWSABLE'],
        data: [
          { scheme: 'careonroad', host: 'auth' },
          { scheme: 'careonroad', host: 'auth', pathPrefix: '/callback' },
        ],
      },
    ],
  },
  web: {
    bundler: 'metro',
    output: 'single',
  },
  plugins: ['expo-router', 'expo-font'],
  experiments: {
    typedRoutes: true,
  },
  // Extra chứa metadata runtime (chỉ là debug info).
  extra: {
    appVariant: variant,
    eas: {
      // Khi build qua EAS, các biến này sẽ có giá trị thật.
      // Khi dev local, chúng rỗng hoặc lấy từ .env.
    },
  },
};

export default config;
