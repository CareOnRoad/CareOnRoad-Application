const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { getConfig } = require('@expo/config');
const { checkAndroidPrebuild } = require('../check-android-prebuild.cjs');

const projectRoot = path.resolve(__dirname, '../..');
const fixtureBase = path.join(projectRoot, '.expo', 'native-config-fixture-');
const files = ['package.json', 'android/gradle.properties', 'android/build.gradle', 'android/settings.gradle', 'android/app/build.gradle', 'android/app/src/main/AndroidManifest.xml', 'android/app/src/main/java/com/careonroad/app/MainActivity.kt'];

function fixture(run) {
  const dir = fs.mkdtempSync(fixtureBase);
  try {
    for (const file of files) {
      const target = path.join(dir, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(projectRoot, file), target);
    }
    const { exp } = getConfig(projectRoot);
    fs.writeFileSync(path.join(dir, 'app.json'), JSON.stringify({ expo: exp }));
    run(dir);
  } finally {
    assert.ok(path.resolve(dir).startsWith(path.resolve(fixtureBase)), 'Fixture cleanup must stay inside the test workspace');
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('native configuration gate is read-only and preserves custom native contents', () => {
  fixture(dir => {
    const before = files.map(file => fs.readFileSync(path.join(dir, file)));
    assert.equal(checkAndroidPrebuild(dir).target, 36);
    files.forEach((file, index) => assert.deepEqual(fs.readFileSync(path.join(dir, file)), before[index]));
  });
});

test('release gate rejects an Android API 34 override', () => {
  fixture(dir => {
    const file = path.join(dir, 'android/gradle.properties');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('android.targetSdkVersion=36', 'android.targetSdkVersion=34'));
    assert.throws(() => checkAndroidPrebuild(dir), /24\/36\/36/);
  });
});

test('release gate rejects broad photo access despite the app config block', () => {
  fixture(dir => {
    const file = path.join(dir, 'android/app/src/main/AndroidManifest.xml');
    const content = fs.readFileSync(file, 'utf8').replace('<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" tools:node="remove"/>', '<uses-permission android:name="android.permission.READ_MEDIA_IMAGES"/>');
    fs.writeFileSync(file, content);
    assert.throws(() => checkAndroidPrebuild(dir), /Remove READ_MEDIA_IMAGES/);
  });
});

test('release gate rejects a prebuild command that can erase native modifications', () => {
  fixture(dir => {
    const file = path.join(dir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
    pkg.scripts.prebuild = 'expo prebuild';
    fs.writeFileSync(file, JSON.stringify(pkg));
    assert.throws(() => checkAndroidPrebuild(dir), /explicitly preserve/);
  });
});

test('release gate rejects debug signing in release builds', () => {
  fixture(dir => {
    const file = path.join(dir, 'android/app/build.gradle');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('        release {', '        release {\n            signingConfig signingConfigs.debug'));
    assert.throws(() => checkAndroidPrebuild(dir), /debug signing key/);
  });
});
