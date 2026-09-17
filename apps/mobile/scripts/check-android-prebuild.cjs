const { spawnSync } = require('node:child_process');

const projectRoot = __dirname + '/..';
const expoArgs = ['exec', 'expo', 'prebuild', '--no-install', '--platform', 'android'];
const isWindows = process.platform === 'win32';

const prebuild = spawnSync(
  isWindows ? process.env.ComSpec || 'cmd.exe' : 'pnpm',
  isWindows ? ['/d', '/s', '/c', `pnpm.cmd ${expoArgs.join(' ')}`] : expoArgs,
  { cwd: projectRoot, stdio: 'inherit' },
);

if (prebuild.error) {
  throw prebuild.error;
}

if (prebuild.status !== 0) {
  process.exit(prebuild.status ?? 1);
}

const nativeDiff = spawnSync(
  'git',
  ['diff', '--exit-code', '--', 'android'],
  { cwd: projectRoot, stdio: 'inherit' },
);

if (nativeDiff.error) {
  throw nativeDiff.error;
}

if (nativeDiff.status !== 0) {
  console.error(
    'Android native files are out of sync with app.json. Review and commit the generated android/ diff.',
  );
  process.exit(nativeDiff.status ?? 1);
}

console.log('Android native configuration is synchronized with app.json.');
