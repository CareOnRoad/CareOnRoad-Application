// Quick bundle test - verifies metro can resolve React without duplicate
const path = require('path');

// Hard-coded metro path from pnpm store
const metroPath = path.resolve(__dirname, '../../node_modules/.pnpm/metro@0.81.5_supports-color@8.1.1/node_modules/metro');
const Metro = require(metroPath);
const config = require('./metro.config.js');

async function main() {
  try {
    console.log('Building bundle...');
    await Metro.runBuild(config, {
      entry: path.resolve(__dirname, 'app/index.tsx'),
      out: path.resolve(__dirname, 'test-bundle.js'),
      platform: 'android',
      dev: true,
      minify: false,
      sourceMap: false,
      optimize: false,
    });
    console.log('SUCCESS: bundle built');
  } catch (e) {
    console.error('FAILED:', e.message);
    if (e.stack) console.error(e.stack.substring(0, 2000));
    process.exit(1);
  }
}

main();
