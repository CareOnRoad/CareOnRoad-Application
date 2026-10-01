/**
 * Location service - lấy vị trí GPS hiện tại + reverse geocode thành địa chỉ tiếng Việt.
 *
 * Dùng cho flow cứu hộ: trước khi rider gửi yêu cầu, app cần biết vị trí để
 * - Gửi lat/lng lên BE (BE dùng cho dispatch radius).
 * - Autofill ô "Địa chỉ" với chuỗi địa chỉ do thiết bị sinh ra.
 *
 * Lưu ý:
 *  - Permission đã được khai báo trong `app.config.ts` (NSLocationWhenInUseUsageDescription,
 *    ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION).
 *  - Nếu user từ chối permission → trả về lỗi có chuỗi tiếng Việt để UI hiển thị.
 *  - Nếu reverse geocode fail (không có mạng / không có provider) → trả về
 *    toạ độ dạng "lat, lng" để rider vẫn có gì đó gửi đi được.
 *  - Không cache toạ độ - mỗi lần mở màn hình rescue sẽ lấy 1 lần để đảm bảo
 *    freshness.
 */
import * as Location from 'expo-location';

export interface CapturedLocation {
  latitude: number;
  longitude: number;
  /** Địa chỉ dạng text (số nhà, đường, phường/quận, thành phố). Có thể rỗng nếu reverse geocode fail. */
  address: string;
  /** Độ chính xác (mét). Có thể undefined nếu thiết bị không cung cấp. */
  accuracy?: number;
  /** Địa chỉ thô từ reverse geocode, dùng để debug/log. */
  raw?: Location.LocationGeocodedAddress;
}

export type LocationErrorCode =
  | 'PERMISSION_DENIED'
  | 'PERMISSION_UNDETERMINED'
  | 'LOCATION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'UNKNOWN';

export class LocationCaptureError extends Error {
  constructor(
    public readonly code: LocationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'LocationCaptureError';
  }
}

/**
 * Xin quyền location. Trả về true nếu user đồng ý.
 *
 * Expo SDK 52: `Location.requestForegroundPermissionsAsync()` trả về
 * { status: 'granted' | 'denied' | 'undetermined' }.
 */
export async function ensureLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

/**
 * Lấy vị trí hiện tại + reverse geocode.
 *
 * @throws LocationCaptureError với code tương ứng nếu thất bại.
 */
export async function captureCurrentLocation(): Promise<CapturedLocation> {
  const granted = await ensureLocationPermission();
  if (!granted) {
    throw new LocationCaptureError(
      'PERMISSION_DENIED',
      'Bạn cần cấp quyền vị trí để dùng tính năng này.',
    );
  }

  let position: Location.LocationObject;
  try {
    position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
  } catch (err) {
    if (err instanceof Error && err.message.toLowerCase().includes('timeout')) {
      throw new LocationCaptureError(
        'TIMEOUT',
        'Không lấy được vị trí (timeout). Vui lòng thử lại.',
      );
    }
    throw new LocationCaptureError(
      'LOCATION_UNAVAILABLE',
      err instanceof Error ? err.message : 'Không lấy được vị trí hiện tại.',
    );
  }

  const { latitude, longitude, accuracy } = position.coords;
  const coords: CapturedLocation = {
    latitude,
    longitude,
    address: formatCoordFallback(latitude, longitude),
    ...(typeof accuracy === 'number' ? { accuracy } : {}),
  };

  // Reverse geocode - best effort. Nếu fail vẫn trả về toạ độ.
  try {
    const reverse = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });
    const first = reverse[0];
    if (first) {
      const address = formatGeocodedAddress(first);
      if (address) {
        coords.address = address;
        coords.raw = first;
      }
    }
  } catch {
    // ignore - giữ fallback "lat, lng"
  }

  return coords;
}

/**
 * Format geocoded address thành chuỗi tiếng Việt dễ đọc.
 *
 * Ví dụ: "124 Nguyễn Văn Cừ, Quận 5, TP. Hồ Chí Minh"
 */
function formatGeocodedAddress(addr: Location.LocationGeocodedAddress): string {
  // Một số provider Việt Nam trả về district/city thay vì subregion/region.
  // Lấy theo thứ tự ưu tiên: street + subregion + region.
  const parts: string[] = [];
  const streetLine = [addr.streetNumber, addr.street].filter(Boolean).join(' ').trim();
  if (streetLine) parts.push(streetLine);
  // name (POI) bỏ qua - không phải địa chỉ giao thông
  if (addr.district) parts.push(addr.district);
  else if (addr.subregion) parts.push(addr.subregion);
  if (addr.city) parts.push(addr.city);
  else if (addr.region) parts.push(addr.region);
  return parts.join(', ');
}

/** Fallback khi reverse geocode fail. */
function formatCoordFallback(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
