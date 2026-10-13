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

const BASE_PACKAGE_ID = 'com.careonroad.app';

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
  icon: './assets/logo.png',
  ios: {
    supportsTablet: false,
    bundleIdentifier: `${BASE_PACKAGE_ID}${settings.bundleSuffix}`,
    infoPlist: {
      NSCameraUsageDescription:
        'CareOnRoad needs camera to take photos of motorcycle issues',
      NSLocationWhenInUseUsageDescription:
        'CareOnRoad needs location to find nearby mechanics',
      // Background location là optional; chỉ bật khi BE có opt-in flow
      // cho live tracking khi app ở background. Hiện tại FE chỉ dùng
      // foreground watch.
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'CareOnRoad uses background location to keep your live tracking accurate when the app is not in the foreground.',
      NSPhotoLibraryUsageDescription:
        'CareOnRoad needs photo library to send issue photos',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/logo.png',
      backgroundColor: '#16202f',
    },
    // Lưu ý: Khi EAS build phát hiện folder `android/` tồn tại, nó sẽ bỏ qua
    // giá trị `package` ở đây và dùng `applicationId`/`namespace` trong
    // `android/app/build.gradle`. Giá trị dưới đây vẫn cần khớp để Expo Go
    // (chạy JS-only) hoạt động đúng.
    package: BASE_PACKAGE_ID,
    versionCode: 1,
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'POST_NOTIFICATIONS',
    ],
    blockedPermissions: [
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.RECORD_AUDIO',
    ],
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
  plugins: [
    'expo-router',
    'expo-font',
    ['expo-image-picker', { microphonePermission: false }],
    ['expo-splash-screen', { image: './assets/logo.png', resizeMode: 'contain', backgroundColor: '#16202f' }],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: false,
  },
  // Extra chứa metadata runtime (chỉ là debug info).
  extra: {
    appVariant: variant,
    eas: {
      // EAS project ID — được generate khi chạy `eas init`.
      // Cần thiết để EAS Build, Submit, Update liên kết với project này.
      projectId: 'a692153d-e5e8-4b0a-8293-3c846bffcafd',
    },
  },
};

export default config;
