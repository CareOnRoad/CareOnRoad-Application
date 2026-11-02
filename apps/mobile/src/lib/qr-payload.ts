import { toQR } from 'toqr';

/**
 * Helper thuần cho QR VietQR (EMVCo payload).
 *
 * Tách riêng khỏi component React để:
 *  - test được bằng `node --test` (không cần runtime React Native),
 *  - giữ component `qr-code.tsx` chỉ lo phần render SVG.
 *
 * payOS trả `qr_code` là **payload EMVCo dạng text** (ví dụ
 * `00020101021238570010A000000727012700069704220113VQRQANGTG...`),
 * KHÔNG phải URL ảnh — nên `<Image source={{ uri: qr_code }}>` sẽ fail
 * im lặng và QR không hiện.
 */

/** Quiet zone (vùng trắng viền) theo chuẩn QR — bắt buộc 4 module. */
export const QR_QUIET_ZONE = 4;

/**
 * Chuỗi này có phải là URL ảnh không?
 * Một số provider trả `qr_code` là URL ảnh PNG — khi đó vẫn dùng `<Image>`.
 */
export function isImageUrl(value: string): boolean {
  return /^(https?:|data:image\/)/i.test(value.trim());
}

/**
 * Chuỗi này có phải payload EMVCo (VietQR) không?
 */
export function isEmvcoPayload(value: string): boolean {
  return value.trim().startsWith('000201');
}

/**
 * Encode chuỗi thành bytes UTF-8.
 *
 * Không dùng `TextEncoder` global vì không đảm bảo có sẵn trên mọi runtime
 * RN/Hermes. Payload VietQR là ASCII nên byte tương đương char code, nhưng
 * ta xử lý đầy đủ multi-byte cho an toàn.
 */
export function utf8Bytes(input: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < input.length; i += 1) {
    let code = input.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
      const next = input.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = (code - 0xd800) * 0x400 + (next - 0xdc00) + 0x10000;
        i += 1;
      }
    }
    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return new Uint8Array(out);
}

export interface QrMatrix {
  /** Kích thước ma trận module (chiều). */
  size: number;
  /** Ma trận module đen (row-major). */
  modules: Uint8Array;
}

/**
 * Encode payload thành ma trận module QR.
 *
 * Trả `null` nếu payload không encode được (quá dài cho mọi version QR).
 */
export function buildQrMatrix(payload: string): QrMatrix | null {
  try {
    // EC level = 1 (L) — payload VietQR ngắn (~120 byte) nên version thấp,
    // module lớn → dễ quét bằng app ngân hàng.
    const modules = toQR(utf8Bytes(payload), 1);
    const size = Math.round(Math.sqrt(modules.length));
    if (!Number.isFinite(size) || size < 21) return null;
    return { size, modules };
  } catch {
    return null;
  }
}

/**
 * Build path SVG từ ma trận module.
 *
 * Ta gộp các module đen liền nhau theo từng hàng thành một hình chữ nhật,
 * rồi ghép tất cả thành **một** `Path` duy nhất để giảm số node trong cây
 * render và tránh vệt seam giữa các module.
 */
export function buildQrPath(matrix: QrMatrix): string {
  const { size, modules } = matrix;
  let path = '';
  for (let row = 0; row < size; row += 1) {
    let col = 0;
    while (col < size) {
      if (!modules[row * size + col]) {
        col += 1;
        continue;
      }
      // Gộp run liền nhau trên cùng hàng.
      let end = col;
      while (end + 1 < size && modules[row * size + end + 1]) end += 1;
      const width = end - col + 1;
      path += `M${col} ${row}h${width}v1h-${width}z`;
      col = end + 1;
    }
  }
  return path;
}

/**
 * Build path SVG trực tiếp từ payload (tiện cho component).
 */
export function buildQrPathFromPayload(payload: string): { path: string; size: number } | null {
  const matrix = buildQrMatrix(payload);
  if (!matrix) return null;
  return { path: buildQrPath(matrix), size: matrix.size };
}

/**
 * Payload này có render được thành QR không?
 *
 * - URL ảnh → render bằng `<Image>`.
 * - Payload EMVCo → encode được thì render bằng SVG.
 * - Còn lại (quá dài / rỗng / sai định dạng) → không render được.
 */
export function canRenderQrCode(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (isImageUrl(trimmed)) return true;
  return buildQrMatrix(trimmed) !== null;
}
