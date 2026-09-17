// Legacy entry point retained for local users. Delegate to Expo instead of
// calling Metro's internal API, which differs across Metro releases.
const { spawnSync } = require('node:child_process');

const args = [
  'exec',
  'expo',
  'export',
  '--platform',
  'android',
  '--output-dir',
  'dist',
];
const isWindows = process.platform === 'win32';
const result = spawnSync(
  isWindows ? process.env.ComSpec || 'cmd.exe' : 'pnpm',
  isWindows ? ['/d', '/s', '/c', `pnpm.cmd ${args.join(' ')}`] : args,
  {
    cwd: __dirname,
    stdio: 'inherit',
  },
);

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
