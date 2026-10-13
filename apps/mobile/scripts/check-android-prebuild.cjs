const fs = require('node:fs');
const path = require('node:path');
const { getConfig } = require('@expo/config');

// Committed native projects are maintained by upgrade diffs. This gate only reads
// source configuration; it never invokes prebuild or proves a native build passed.
function checkAndroidPrebuild(projectRoot) {
  const read = (file) => fs.readFileSync(path.join(projectRoot, file), 'utf8');
  const pkg = JSON.parse(read('package.json'));
  const { exp } = getConfig(projectRoot);
  const bundled = require('expo/bundledNativeModules.json');
  const installedExpo = require('expo/package.json').version;
  const nativeDefaults = fs.readFileSync(path.join(path.dirname(require.resolve('react-native/package.json')), 'gradle/libs.versions.toml'), 'utf8');
  const properties = Object.fromEntries(read('android/gradle.properties').split(/\r?\n/)
    .filter(line => /^[^#\s][^=]*=/.test(line)).map(line => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }));
  const errors = [];
  const requireCondition = (condition, message) => { if (!condition) errors.push(message); };
  requireCondition(installedExpo.startsWith('57.') && pkg.dependencies.expo.includes('57.'), 'Install the Expo 57 dependency set before checking native configuration.');
  for (const name of ['react', 'react-native', 'react-native-reanimated', 'react-native-worklets']) {
    requireCondition(pkg.dependencies[name] === bundled[name], name + ' must match Expo bundledNativeModules.json.');
  }
  const defaults = {};
  for (const key of ['minSdk', 'compileSdk', 'targetSdk']) {
    defaults[key] = Number(nativeDefaults.match(new RegExp('^' + key + ' = "(\\d+)"', 'm'))?.[1]);
  }
  const levels = {
    min: Number(properties['android.minSdkVersion'] ?? defaults.minSdk),
    compile: Number(properties['android.compileSdkVersion'] ?? defaults.compileSdk),
    target: Number(properties['android.targetSdkVersion'] ?? defaults.targetSdk),
  };
  requireCondition(levels.min === 24 && levels.compile === 36 && levels.target === 36, 'Android min/compile/target must be 24/36/36 for this release.');
  requireCondition(properties.hermesEnabled === 'true', 'Hermes must remain enabled.');
  requireCondition(read('android/build.gradle').includes('apply plugin: "expo-root-project"'), 'Android root build must use the Expo version catalog defaults.');
  requireCondition(read('android/settings.gradle').includes('expoAutolinking.useExpoVersionCatalog()'), 'Android settings must use the Expo version catalog.');
  const appBuild = read('android/app/build.gradle');
  const packageId = exp.android?.package;
  requireCondition(packageId === 'com.careonroad.app', 'Preserve the CareOnRoad Android package ID.');
  for (const key of ['namespace', 'applicationId']) {
    requireCondition(new RegExp(key + '\\s+["\x27]' + packageId.replaceAll('.', '\\.') + '["\x27]').test(appBuild), key + ' does not match app.config.ts.');
  }
  requireCondition(appBuild.includes('resValue "string", "app_name", appName') && appBuild.includes("getConfig(process.cwd()).exp.name"), 'Native app name must use the app.config.ts variant.');
  const release = appBuild.match(/release\s*\{([\s\S]*?)\n\s{8}\}/)?.[1];
  requireCondition(release && !release.includes('signingConfig signingConfigs.debug'), 'Release must not fall back to the debug signing key.');
  const activity = read('android/app/src/main/java/com/careonroad/app/MainActivity.kt');
  requireCondition(activity.includes('SplashScreenManager.registerOnActivity(this)'), 'Register the supported native splash screen before React activity creation.');
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const permissions = [...manifest.matchAll(/<uses-permission\b([^>]+)>/g)].map(match => ({
    name: match[1].match(/android:name="([^"]+)"/)?.[1],
    removed: /tools:node="remove"/.test(match[1]),
  }));
  for (const name of ['READ_MEDIA_IMAGES', 'READ_MEDIA_VIDEO', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE', 'RECORD_AUDIO']) {
    const fullName = 'android.permission.' + name;
    requireCondition(exp.android?.blockedPermissions?.includes(fullName), 'Block ' + name + ' in app.config.ts.');
    requireCondition(permissions.some(p => p.name === fullName && p.removed) && !permissions.some(p => p.name === fullName && !p.removed), 'Remove ' + name + ' from the native release manifest.');
  }
  requireCondition(Array.isArray(exp.scheme) ? exp.scheme.includes('careonroad') : exp.scheme === 'careonroad', 'Preserve the careonroad deep-link scheme.');
  requireCondition(manifest.includes('android:scheme="careonroad"') && manifest.includes('android:host="auth"'), 'Preserve native OAuth intent filters.');
  for (const name of ['prebuild', 'prebuild:android']) {
    requireCondition(pkg.scripts[name]?.includes('--no-clean'), name + ' must explicitly preserve existing native directories.');
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return { packageId, installedExpo, ...levels };
}

module.exports = { checkAndroidPrebuild };

if (require.main === module) {
  try {
    const result = checkAndroidPrebuild(path.resolve(__dirname, '..'));
    console.log('PASS: Android source configuration is consistent (' + JSON.stringify(result) + ').');
    console.log('APK/AAB signing, merged permissions and 16 KB alignment still require artifact verification.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
