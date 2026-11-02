/**
 * Mock các module native của React Native / Expo để có thể import
 * `auth-service.ts` trong `node --test`.
 *
 * Lý do: `react-native` và `expo-linking` ship **source TypeScript/Flow**
 * trong `node_modules`, Node không parse được (và Node cũng không strip type
 * cho file trong `node_modules`). Vì vậy test phải mock trước khi import.
 *
 * File `.mjs` (JS thuần) vì Node không strip type cho file này.
 */
import { mock } from "node:test";

export function mockNativeModules() {
  mock.module("react-native", {
    namedExports: {
      Linking: {
        openURL: async () => true,
        canOpenURL: async () => true,
        getInitialURL: async () => null,
        addEventListener: () => ({ remove: () => undefined }),
      },
      Platform: { OS: "android", select: (options) => options },
    },
  });

  mock.module("expo-linking", {
    namedExports: {
      createURL: (path) => `careonroad://${path}`,
    },
  });
}
