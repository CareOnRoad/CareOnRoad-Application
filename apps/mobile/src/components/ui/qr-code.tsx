import React, { useMemo } from 'react';
import { Image } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import {
  QR_QUIET_ZONE,
  buildQrPathFromPayload,
  isImageUrl,
} from '@/lib/qr-payload';

/**
 * QrCode - render QR code từ payload chuẩn EMVCo (VietQR) bằng SVG.
 *
 * payOS trả `qr_code` là **payload EMVCo dạng text** (ví dụ
 * `00020101021238570010A000000727012700069704220113VQRQANGTG...`),
 * KHÔNG phải URL ảnh. Vì vậy `<Image source={{ uri: qr_code }}>` sẽ
 * fail im lặng — ảnh không hiển thị.
 *
 * Thay vào đó ta encode payload thành ma trận module QR (`toqr`) rồi vẽ
 * bằng `react-native-svg` (một path duy nhất → nhẹ, không nhân bản thể
 * React Native).
 */

/** Kích thước mặc định (px) — khớp với `size-56` (224) đang dùng ở màn thanh toán. */
const DEFAULT_SIZE = 224;

export interface QrCodeProps {
  /** Payload QR (EMVCo/VietQR) hoặc URL ảnh. */
  value: string;
  /** Kích thước vuông (px). */
  size?: number;
  /** Màu module đen. */
  color?: string;
  /** Nền trắng phía sau (giúp app ngân hàng quét dễ hơn). */
  backgroundColor?: string;
  accessibilityLabel?: string;
}

/**
 * QrCode - hiển thị QR từ payload text hoặc từ URL ảnh.
 *
 * - Nếu `value` là URL ảnh (`http(s)://` hoặc `data:image/...`) → dùng `<Image>`.
 * - Nếu `value` là payload EMVCo → encode + vẽ SVG.
 * - Nếu không encode được → trả `null` để caller hiển thị fallback.
 */
export function QrCode({
  value,
  size = DEFAULT_SIZE,
  color = '#16202f',
  backgroundColor = '#ffffff',
  accessibilityLabel = 'QR code thanh toán',
}: QrCodeProps) {
  const trimmed = value.trim();
  const isImage = isImageUrl(trimmed);

  const svg = useMemo(
    () => (isImage ? null : buildQrPathFromPayload(trimmed)),
    [isImage, trimmed],
  );

  if (isImage) {
    return (
      <Image
        source={{ uri: trimmed }}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityLabel={accessibilityLabel}
      />
    );
  }

  if (!svg) return null;

  const total = svg.size + QR_QUIET_ZONE * 2;
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`${-QR_QUIET_ZONE} ${-QR_QUIET_ZONE} ${total} ${total}`}
      accessibilityLabel={accessibilityLabel}
    >
      <Path
        d={`M${-QR_QUIET_ZONE} ${-QR_QUIET_ZONE}h${total}v${total}h-${total}z`}
        fill={backgroundColor}
      />
      <Path d={svg.path} fill={color} />
    </Svg>
  );
}
