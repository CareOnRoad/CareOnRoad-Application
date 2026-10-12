// Generate 10 mipmap icons (5 densities x 2 shapes) từ assets/logo.png.
// Chạy: node scripts/generate-mipmaps.mjs
//
// Yêu cầu: cài 'sharp' (npm i -D sharp) — dùng để resize PNG → WebP.
// Nếu chưa có sharp, chạy: pnpm.cmd add -D sharp trước.

import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SOURCE = join(ROOT, 'assets', 'logo.png');
const RES_DIR = join(ROOT, 'android', 'app', 'src', 'main', 'res');

const SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

async function main() {
  if (!existsSync(SOURCE)) {
    throw new Error(`Source logo not found: ${SOURCE}`);
  }
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch (e) {
    throw new Error('Missing dependency "sharp". Run: pnpm.cmd add -D sharp');
  }

  for (const [folder, size] of Object.entries(SIZES)) {
    const dir = join(RES_DIR, folder);
    await mkdir(dir, { recursive: true });

    // ic_launcher.webp (vuông — Android auto-mask thành tròn/squircle theo launcher)
    await sharp(SOURCE)
      .resize(size, size, { fit: 'cover' })
      .webp({ quality: 90 })
      .toFile(join(dir, 'ic_launcher.webp'));

    // ic_launcher_round.webp (giống ic_launcher — Android xử lý riêng cho launcher hỗ trợ)
    await sharp(SOURCE)
      .resize(size, size, { fit: 'cover' })
      .webp({ quality: 90 })
      .toFile(join(dir, 'ic_launcher_round.webp'));

    console.log(`Generated ${folder} (${size}x${size})`);
  }
  console.log('\nDone. 10 mipmap files updated.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
