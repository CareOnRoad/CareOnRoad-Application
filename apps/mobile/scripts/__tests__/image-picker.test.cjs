const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../../src/lib/avatar-upload.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function loadPicker(platform, { granted = false, result = { canceled: true } } = {}) {
  const calls = [];
  const imagePicker = { __esModule: true };
  for (const method of ['requestMediaLibraryPermissionsAsync', 'requestCameraPermissionsAsync']) {
    imagePicker[method] = async () => { calls.push({ method }); return { granted }; };
  }
  for (const method of ['launchImageLibraryAsync', 'launchCameraAsync']) {
    imagePicker[method] = async (options) => { calls.push({ method, options }); return result; };
  }
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require(name) {
      if (name === 'expo-image-picker') return imagePicker;
      if (name === 'react-native') return { Platform: { OS: platform } };
      throw new Error('Unexpected import: ' + name);
    },
  }, { filename: 'avatar-upload.js' });
  return { api: exports, calls };
}

test('Android opens the system picker without broad library permission', async () => {
  const { api, calls } = loadPicker('android');
  assert.equal(await api.pickAvatar(), null);
  assert.deepEqual(calls.map(x => x.method), ['launchImageLibraryAsync']);
  assert.deepEqual(Array.from(calls[0].options.mediaTypes), ['images']);
});

test('iOS keeps the permission denial and does not open the picker', async () => {
  const { api, calls } = loadPicker('ios');
  await assert.rejects(api.pickAvatar(), /Cần cấp quyền truy cập thư viện ảnh/);
  assert.deepEqual(calls.map(x => x.method), ['requestMediaLibraryPermissionsAsync']);
});

test('iOS opens the picker after permission is granted', async () => {
  const { api, calls } = loadPicker('ios', { granted: true });
  assert.equal(await api.pickAvatar(), null);
  assert.deepEqual(calls.map(x => x.method), ['requestMediaLibraryPermissionsAsync', 'launchImageLibraryAsync']);
});

test('camera denial still blocks capture on Android', async () => {
  const { api, calls } = loadPicker('android');
  await assert.rejects(api.captureAvatarFromCamera(), /Cần cấp quyền camera/);
  assert.deepEqual(calls.map(x => x.method), ['requestCameraPermissionsAsync']);
});

test('selected image metadata and the existing URI contract are preserved', async () => {
  const result = { canceled: false, assets: [{ uri: 'file:///fixture.jpg', fileSize: 120, mimeType: 'image/jpeg', width: 20, height: 30 }] };
  const { api } = loadPicker('android', { result });
  assert.deepEqual(JSON.parse(JSON.stringify(await api.pickAvatar())), {
    uri: 'file:///fixture.jpg', sizeBytes: 120, contentType: 'image/jpeg', width: 20, height: 30,
  });
});
