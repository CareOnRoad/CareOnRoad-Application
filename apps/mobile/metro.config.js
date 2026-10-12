const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
// Monorepo root = 2 cấp lên từ apps/mobile
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1) Cho Metro theo dõi toàn bộ monorepo để resolve symlinked packages
config.watchFolders = [monorepoRoot];

// 2) Trỏ Metro resolver vào root node_modules + workspace packages
config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(monorepoRoot, 'node_modules'),
  ],
  // Tránh Metro trùng tên package giữa react (web) và react (native) trong monorepo
  disableHierarchicalLookup: false,
};

// 3) Bảo đảm Metro không bị lẫn với Web bundler khi build
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

module.exports = withNativeWind(config, { input: './app/global.css' });
