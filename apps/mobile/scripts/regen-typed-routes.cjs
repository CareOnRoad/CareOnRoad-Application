const path = require('node:path');
const fs = require('node:fs');

process.env.EXPO_ROUTER_APP_ROOT = path.resolve(process.cwd(), 'app');

const { getTypedRoutesDeclarationFile } = require('@expo/router-server/build/typed-routes/generate');
const { requireContext } = require('expo-router/internal/testing');
const { EXPO_ROUTER_CTX_IGNORE } = require('expo-router/_ctx-shared');

const ctx = requireContext(process.env.EXPO_ROUTER_APP_ROOT, true, EXPO_ROUTER_CTX_IGNORE);
const file = getTypedRoutesDeclarationFile(ctx, {});
fs.writeFileSync(path.resolve(process.cwd(), '.expo/types/router.d.ts'), file);
console.log('written');
