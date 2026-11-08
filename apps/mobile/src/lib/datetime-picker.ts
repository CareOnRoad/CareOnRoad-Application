/**
 * Helper thuần cho `DateTimePickerField` (`src/components/ui/datetime-picker-field.tsx`).
 *
 * Tách ra file riêng để:
 *  - test được bằng `node --test` (file .ts không JSX, không import react-native),
 *  - giữ 1 nguồn sự thật cho logic "chọn ngày + giờ" trên Android.
 *
 * Lý do cần helper riêng:
 *  - Android KHÔNG hỗ trợ `mode='datetime'` (chỉ `date` và `time`),
 *    nên `mode='datetime'` phải được tách thành 2 dialog nối tiếp.
 *  - `DateTimePickerAndroid.open()` là imperative API: mỗi lần gọi trả về
 *    một Date đã có sẵn phần "giờ" lấy từ `value` truyền vào → khi ghép
 *    ngày + giờ phải giữ đúng phần ngày đã chọn.
 */

/** Mode mà `DateTimePickerField` hỗ trợ. */
export type PickerMode = 'date' | 'time' | 'datetime';

/** Mode thực sự mà Android native picker hỗ trợ. */
export type AndroidPickerMode = 'date' | 'time';

/**
 * Android native picker chỉ có `date` và `time`.
 *
 * - `time` → mở dialog chọn giờ.
 * - `date` → mở dialog chọn ngày.
 * - `datetime` → mở dialog chọn ngày TRƯỚC, rồi mới mở dialog chọn giờ.
 */
export function resolveAndroidPickerMode(mode: PickerMode): AndroidPickerMode {
  return mode === 'time' ? 'time' : 'date';
}

/**
 * Ghép phần giờ đã chọn vào phần ngày đã chọn.
 *
 * `DateTimePickerAndroid.open({ mode: 'time' })` trả về Date có phần giờ mới
 * nhưng phần ngày là ngày của `value` đã truyền vào. Ta chỉ lấy giờ/phút từ
 * đó và giữ nguyên ngày đã chọn.
 */
export function mergeSelectedTime(selectedDate: Date, timeSelected: Date): Date {
  const next = new Date(selectedDate);
  next.setHours(timeSelected.getHours(), timeSelected.getMinutes(), 0, 0);
  return next;
}

/**
 * Chuẩn hoá Date trả về từ native picker về đầu ngày (00:00:00.000).
 *
 * Dùng cho `mode='date'` để trường ngày luôn là ngày tròn, không kéo theo
 * giờ/phút của `value` hiện tại.
 */
export function startOfDay(value: Date): Date {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}
