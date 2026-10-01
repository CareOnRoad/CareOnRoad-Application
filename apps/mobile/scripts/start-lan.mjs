#!/usr/bin/env node
/**
 * start-lan.mjs - Khởi động Metro với API URL trỏ về máy dev qua LAN.
 *
 * Vấn đề: khi dev mobile trên thiết bị thật (điện thoại qua Expo Go),
 * thiết bị cần gọi BE Next.js qua địa chỉ LAN (vd 192.168.1.194:3000).
 * IP này đổi thường xuyên (DHCP), sửa .env mỗi lần rất mệt.
 *
 * Script này:
 *  1. Tự động detect IPv4 LAN của máy dev qua os.networkInterfaces().
 *  2. Set EXPO_PUBLIC_API_BASE_URL_OVERRIDE = http://<IP>:3000
 *  3. Gọi `npx expo start` với env đã set.
 *  4. In ra URL để user scan QR / mở app.
 *
 * Cách dùng:
 *   pnpm start:lan
 *
 * Tuỳ chọn cổng BE:
 *   BE_PORT=4000 pnpm start:lan
 *
 * Nếu không detect được IP (chỉ có localhost / VPN), in cảnh báo.
 */

import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';

/**
 * Tìm IPv4 LAN đầu tiên (không phải internal, không phải loopback).
 * Trên Windows: thường là 192.168.x.x hoặc 10.x.x.x.
 * Trên macOS: en0 thường là WiFi.
 */
function detectLanIp() {
  const interfaces = networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family !== 'IPv4') continue;
      if (iface.internal) continue;
      candidates.push({ name, address: iface.address });
    }
  }

  // Ưu tiên 192.168.x.x (LAN nhà/VPN phổ biến nhất), rồi 10.x.x.x.
  const preferred =
    candidates.find((c) => /^192\.168\./.test(c.address)) ??
    candidates.find((c) => /^10\./.test(c.address)) ??
    candidates.find((c) => /^172\.(1[6-9]|2\d|3[01])\./.test(c.address)) ??
    candidates[0];

  return preferred ?? null;
}

const bePort = process.env.BE_PORT ?? '3000';
const lan = detectLanIp();

if (!lan) {
  console.error('\u26a0\ufe0f  Không tìm được IP LAN. Có thể bạn chỉ offline hoặc VPN đang chặn.');
  console.error('   Hãy chạy BE với --hostname 0.0.0.0 và dùng IP thủ công:');
  console.error('   EXPO_PUBLIC_API_BASE_URL_OVERRIDE=http://<IP>:<PORT> pnpm start');
  process.exit(1);
}

const apiUrl = `http://${lan.address}:${bePort}`;

console.log('\u270d\ufe0f  CareOnRoad - Dev LAN Mode');
console.log(`   Interface: ${lan.name}`);
console.log(`   API URL:   ${apiUrl}`);
console.log('');

// Inject env vào process con. Expo đọc EXPO_PUBLIC_* khi bundle.
// shell: true để spawn('npx', ...) chạy được trên Windows, nơi npx thực ra là npx.cmd.
const child = spawn('npx', ['expo', 'start', '--clear'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    EXPO_PUBLIC_API_BASE_URL_OVERRIDE: apiUrl,
    APP_VARIANT: 'development',
  },
});

child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (err) => {
  console.error('\u274c  Không thể khởi động Expo:', err.message);
  process.exit(1);
});
