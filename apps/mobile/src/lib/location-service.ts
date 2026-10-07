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
import { Linking } from 'react-native';

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
 * Read-only check permission hiện tại (không hiện dialog).
 *
 * Trả về:
 *  - `true` nếu user đã cấp foreground permission.
 *  - `false` nếu đã từ chối hoặc chưa từng hỏi.
 *
 * Dùng cho idempotent init ở auth-context (tránh hỏi permission 2 lần).
 */
export async function isLocationPermissionGranted(): Promise<boolean> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Hỏi quyền foreground permission một cách idempotent.
 *
 * - Nếu đã granted → return `true` ngay, không hiện dialog.
 * - Nếu chưa hỏi hoặc bị undetermined → hiện dialog system 1 lần.
 * - Nếu đã denied → return `false` (user phải mở Settings thủ công).
 *
 * Helper riêng cho auto-init flow: chỉ xin 1 lần, idempotent trên reload.
 */
export async function requestLocationPermissionOnce(): Promise<boolean> {
  const already = await isLocationPermissionGranted();
  if (already) return true;
  return ensureLocationPermission();
}

/**
 * Mở Settings của OS để user cấp lại permission đã bị từ chối.
 * Dùng cho "Mở cài đặt vị trí" button khi user đã deny trước đó.
 */
export async function openLocationSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // ignore - user tự mở
  }
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

// =========================================================
// Watch position (continuous streaming)
// =========================================================

export type LocationWatchHandle = {
  /** Dừng theo dõi vị trí, giải phóng tài nguyên GPS. */
  stop: () => void;
};

export interface WatchOptions {
  /** Khoảng cách tối thiểu giữa 2 lần update (mét). Mặc định 25m. */
  distanceInterval?: number;
  /** Khoảng thời gian tối thiểu giữa 2 lần update (ms). Mặc định 15000 (15s). */
  timeInterval?: number;
  /** Mức accuracy tối thiểu yêu cầu. Mặc định Balanced. */
  accuracy?: Location.Accuracy;
}

/**
 * Theo dõi vị trí liên tục và gọi `onUpdate` mỗi khi có fix mới.
 *
 * Dùng cho flow mechanic publish live-location: BE rate-limit theo
 * `LIVE_TRACKING_MIN_UPDATE_INTERVAL_SECONDS`, nên 15s interval là hợp lý.
 *
 * Lưu ý:
 *  - Phải gọi `handle.stop()` khi không dùng nữa (rời màn hình, job completed).
 *  - Permission đã được khai báo trong `app.config.ts`.
 *  - `onError` chỉ được gọi khi permission bị từ chối lúc khởi tạo watch. Lỗi
 *    runtime (timeout, GPS off) sẽ không gọi callback này mà chỉ im lặng.
 *
 * @throws LocationCaptureError với code `PERMISSION_DENIED` nếu user không cấp quyền.
 */
export async function watchCurrentPosition(
  onUpdate: (loc: CapturedLocation) => void,
  onError?: (err: LocationCaptureError) => void,
  options: WatchOptions = {},
): Promise<LocationWatchHandle> {
  const granted = await ensureLocationPermission();
  if (!granted) {
    const err = new LocationCaptureError(
      'PERMISSION_DENIED',
      'Bạn cần cấp quyền vị trí để dùng tính năng này.',
    );
    onError?.(err);
    throw err;
  }

  const subscription = await Location.watchPositionAsync(
    {
      accuracy: options.accuracy ?? Location.Accuracy.Balanced,
      timeInterval: options.timeInterval ?? 15_000,
      distanceInterval: options.distanceInterval ?? 25,
    },
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      onUpdate({
        latitude,
        longitude,
        address: formatCoordFallback(latitude, longitude),
        ...(typeof accuracy === 'number' ? { accuracy } : {}),
      });
    },
  );

  return {
    stop: () => subscription.remove(),
  };
}

// =========================================================
// Auto tracking (idempotent background watch for mechanic)
// =========================================================

export interface AutoTrackingOptions {
  /**
   * Client-side rate limit tối thiểu giữa 2 lần gọi `onTick` (ms).
   * Mặc định 10_000 (10s) — khớp với rate-limit BE (`LIVE_TRACKING_MIN_UPDATE_INTERVAL_SECONDS`).
   * Provider dùng giá trị này để skip emit khi fix quá sát nhau.
   */
  minTickIntervalMs?: number;
  /**
   * Skip nếu `loc.accuracy` (mét) lớn hơn ngưỡng này. Mặc định 100 (khớp BE `LIVE_TRACKING_MAX_ACCURACY_METERS`).
   * Set `null` để tắt filter.
   */
  maxAccuracyMeters?: number | null;
  /**
   * Khoảng cách tối thiểu giữa 2 lần update (mét). Mặc định 25.
   */
  distanceInterval?: number;
}

export type AutoTrackingHandle = LocationWatchHandle & {
  /** True nếu permission đã granted trước khi start watch. */
  permissionGranted: boolean;
};

/**
 * Auto-tracking wrapper dành cho mechanic flow.
 *
 * Flow:
 *  1. Idempotent foreground permission request (`requestLocationPermissionOnce`).
 *  2. Nếu denied → trả về handle "noop" với `permissionGranted: false`; gọi
 *     `onError` (nếu có) với `LocationCaptureError('PERMISSION_DENIED')` rồi
 *     resolve luôn — caller vẫn nhận handle để quản lý lifecycle đồng nhất.
 *  3. Nếu granted → khởi `Location.watchPositionAsync` với cùng interval 15s/25m.
 *  4. Mỗi lần có fix mới, áp dụng rate-limit + accuracy filter trước khi
 *     phát ra `onTick` (provider chỉ cần xử lý `CapturedLocation` thuần).
 *
 * Ưu điểm so với `watchCurrentPosition`:
 *  - Không throw nếu permission đã bị deny — chỉ báo qua flag và onError.
 *  - Bộ filter client-side (rate-limit + accuracy) được áp dụng ở đây nên
 *    context không phải tự duplicate logic.
 *  - `onError` chỉ fire cho lỗi permission; runtime errors (timeout / GPS off)
 *    sẽ tự im lặng để không spam UI khi user đi vào vùng mất sóng.
 *
 * @example
 *   const handle = await startAutoTracking({
 *     onTick: (loc) => { void ingestLiveLocation(assignmentId, ...); },
 *     onError: (err) => setError(err.message),
 *   });
 *   if (!handle.permissionGranted) showSettingsHint();
 *   // ...
 *   handle.stop();
 */
export async function startAutoTracking(
  onTick: (loc: CapturedLocation) => void,
  onError?: (err: LocationCaptureError) => void,
  options: AutoTrackingOptions = {},
): Promise<AutoTrackingHandle> {
  const granted = await requestLocationPermissionOnce();
  if (!granted) {
    const err = new LocationCaptureError(
      'PERMISSION_DENIED',
      'Bạn cần cấp quyền vị trí để dùng tính năng này.',
    );
    onError?.(err);
    return {
      stop: () => undefined,
      permissionGranted: false,
    };
  }

  const lastEmitAtRef: { current: number } = { current: 0 };
  const maxAcc = options.maxAccuracyMeters ?? 100;
  const minInterval = options.minTickIntervalMs ?? 10_000;

  const handle = await watchCurrentPosition(
    (loc) => {
      // Skip nếu accuracy quá kém.
      if (maxAcc !== null && typeof loc.accuracy === 'number' && loc.accuracy > maxAcc) {
        return;
      }
      // Client-side rate-limit (giảm traffic + khớp BE).
      const now = Date.now();
      if (now - lastEmitAtRef.current < minInterval) return;
      lastEmitAtRef.current = now;
      onTick(loc);
    },
    undefined, // watchCurrentPosition đã throw PERMISSION_DENIED, ta đã chặn ở trên.
    {
      timeInterval: 15_000,
      ...(options.distanceInterval !== undefined
        ? { distanceInterval: options.distanceInterval }
        : { distanceInterval: 25 }),
    },
  );

  return {
    stop: handle.stop,
    permissionGranted: true,
  };
}

// =========================================================
// Availability heartbeat (1.x) - giữ `mechanic_profiles.latest_location`
// fresh khi mechanic đang available nhưng chưa accept assignment.
// =========================================================

/**
 * Handle từ `startAvailabilityHeartbeat`. Có thể `stop()` để clear interval
 * + cancel inflight getCurrentPositionAsync. Idempotent.
 */
export interface AvailabilityHeartbeatHandle {
  stop: () => void;
  /** True nếu permission đã cấp, false nếu chưa. */
  permissionGranted: boolean;
}

export interface AvailabilityHeartbeatOptions {
  /**
   * Khoảng cách giữa 2 lần ping. Mặc định 180s (3 phút) — nhỏ hơn
   * `DISPATCH_LOCATION_MAX_AGE_SECONDS` (5 phút) ở BE để đảm bảo
   * `mechanic_profiles.latest_location` luôn trong fresh window.
   */
  intervalMs?: number;
  /**
   * Ngưỡng accuracy tối đa (mét) chấp nhận được. Mặc định 100m — quá
   * tệ thì skip lần ping đó.
   */
  maxAccuracyMeters?: number;
}

/**
 * Lấy vị trí foreground 1 lần, best-effort. Throw `LocationCaptureError`
 * nếu permission bị deny giữa chừng.
 */
async function captureOneFix(
  options: { maxAccuracyMeters?: number } = {},
): Promise<CapturedLocation> {
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const { latitude, longitude, accuracy } = pos.coords;
  if (typeof accuracy === 'number' && options.maxAccuracyMeters && accuracy > options.maxAccuracyMeters) {
    throw new LocationCaptureError(
      'LOCATION_UNAVAILABLE',
      `Độ chính xác quá thấp (±${Math.round(accuracy)}m).`,
    );
  }
  return {
    latitude,
    longitude,
    address: formatCoordFallback(latitude, longitude),
    ...(typeof accuracy === 'number' ? { accuracy } : {}),
  };
}

/**
 * Ping vị trí định kỳ lên BE thông qua callback `onPing` để giữ
 * `mechanic_profiles.latest_location` trong fresh window.
 *
 *  - Idempotent start: caller chỉ cần gọi khi `is_available=true` và stop
 *    khi chuyển sang `false` hoặc khi unmount/logout.
 *  - Skip lần ping nếu accuracy vượt `maxAccuracyMeters`.
 *  - Skip lần ping nếu BE fail → vẫn tiếp tục loop (không vòng lặp fail).
 *  - Không block UI: tất cả work chạy trong setInterval + promise.
 *
 * Caller chịu trách nhiệm gọi `stop()` khi không cần nữa (cleanup
 * useEffect return). Stop an toàn ngay cả khi permission đã revoke.
 */
export function startAvailabilityHeartbeat(
  onPing: (loc: { latitude: number; longitude: number; accuracy?: number }) => Promise<void> | void,
  options: AvailabilityHeartbeatOptions = {},
): AvailabilityHeartbeatHandle {
  const intervalMs = options.intervalMs ?? 180_000; // 3 phút
  const maxAccuracyMeters = options.maxAccuracyMeters ?? 100;

  let permissionGranted = false;
  let inFlight = false;
  let intervalHandle: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const tick = async () => {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      const loc = await captureOneFix({ maxAccuracyMeters });
      permissionGranted = true;
      await onPing({
        latitude: loc.latitude,
        longitude: loc.longitude,
        ...(typeof loc.accuracy === 'number' ? { accuracy: loc.accuracy } : {}),
      });
    } catch (err) {
      if (err instanceof LocationCaptureError && err.code === 'PERMISSION_DENIED') {
        permissionGranted = false;
        // Tự stop để caller có thể detect qua permissionGranted = false.
        stop();
        return;
      }
      // Lỗi khác (timeout, accuracy, network) → bỏ qua tick này, loop tiếp.
    } finally {
      inFlight = false;
    }
  };

  // Ping ngay 1 lần + schedule interval.
  void tick();
  intervalHandle = setInterval(() => {
    void tick();
  }, intervalMs);

  function stop() {
    if (stopped) return;
    stopped = true;
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
  }

  return { stop, get permissionGranted() { return permissionGranted; } };
}
