const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo hardening:
// - Workspace chứa nhiều React versions (mobile 18, api/web 19).
// - Metro không được watch các app khác để tránh resolve nhầm React/renderer.
// - Chỉ giữ lại root node_modules (nơi chứa deps được dedupe) và các package shared.
config.watchFolders = [
  path.resolve(workspaceRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'packages'),
];

// Cho phép Metro theo symlink pnpm — đây là điểm mấu chốt cho monorepo Expo+pnpm.
config.resolver.unstable_enableSymlinks = true;

// Blocklist mọi file thuộc apps/web, apps/api để Metro không bao giờ resolve code từ đó.
config.resolver = {
  ...config.resolver,
  blockList: [
    /\/apps\/web\/.*/,
    /\/apps\/api\/.*/,
  ],
};

// Node module paths: ưu tiên mobile/node_modules, fallback workspace root.
// apps/mobile/node_modules/react là symlink hợp lệ (đã verify).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Tìm symlink `react`/`react-dom`/`react-native` thực sự trong apps/mobile/node_modules
// rồi resolve về file thực (realpath) bên trong .pnpm store.
// Tránh được lỗi "Failed to get SHA-1" vì trỏ vào path không tồn tại.
function resolveMobileSymlink(moduleName) {
  const symlinkPath = path.resolve(projectRoot, 'node_modules', moduleName);
  if (!fs.existsSync(symlinkPath)) {
    return null;
  }
  // realpath sẽ trả về path vật lý bên trong .pnpm store, Metro có thể getSha1 được.
  return fs.realpathSync(symlinkPath);
}

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === 'react' ||
    moduleName === 'react-dom' ||
    moduleName === 'react-native'
  ) {
    const realFilePath = resolveMobileSymlink(moduleName);
    if (realFilePath) {
      return {
        filePath: realFilePath,
        type: 'sourceFile',
      };
    }
  }
  if (typeof defaultResolveRequest === 'function') {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './nativewind.config.ts' });
