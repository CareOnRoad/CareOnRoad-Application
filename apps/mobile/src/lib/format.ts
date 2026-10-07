/**
 * Helper format dùng chung cho UI mobile.
 *
 * Trước đây nằm trong `@/lib/mock-data`. Tách ra để có thể xoá mock data
 * user (mockVehicles, mockServices, ...) khỏi codebase mà không phá vỡ
 * các component chỉ dùng helper format.
 *
 * Không chứa business logic — chỉ là pure function format string.
 */

/**
 * Format một số tiền (VND) thành chuỗi hiển thị kiểu Việt Nam.
 *
 * Ví dụ: 250000 -> "250.000₫"
 */
export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + '₫';
}

/**
 * Format chuỗi ISO date (YYYY-MM-DD hoặc ISO datetime) thành chuỗi ngắn.
 *
 * Ví dụ: "2026-04-02" -> "02 Apr 2026"
 *
 * Lưu ý: locale 'en-GB' được giữ từ bản cũ để không phá UI hiện tại.
 * Nếu cần localize sang 'vi-VN' hãy dùng `formatDateVi` hoặc `formatDdMmYyyy`.
 */
export function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// =========================================================
// Vietnamese date/time formatters + validators
//
// Ưu tiên dùng các helper này cho UI tiếng Việt:
//  - formatDdMmYyyy(iso|Date)       -> "02/04/2026"
//  - formatDdMmYyyyHHmm(iso|Date)   -> "02/04/2026 09:30"
//  - formatDdMmYyyyLong(iso|Date)   -> "Thứ Tư, 02/04/2026"
//  - parseDdMmYyyy(input)           -> Date | null (cho fallback TextInput)
//  - isPastDate(d, now?)            -> true nếu ngày đã qua (so với đầu ngày)
//  - isPastDateTime(d, now?)        -> true nếu date+time đã qua
//  - formatRelativeVi(iso)           -> "Hôm nay 09:30", "Ngày mai 09:30", "02/04 09:30"
// =========================================================

function toDate(input: string | Date | null | undefined): Date | null {
  if (!input) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

const PAD2 = (n: number) => String(n).padStart(2, '0');

/**
 * Trả về phần ngày của Date dưới dạng "dd/mm/yyyy".
 */
function padDate(d: Date): string {
  return `${PAD2(d.getDate())}/${PAD2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Trả về phần giờ của Date dưới dạng "HH:mm".
 */
function padTime(d: Date): string {
  return `${PAD2(d.getHours())}:${PAD2(d.getMinutes())}`;
}

/**
 * Format ngày theo locale Việt Nam `dd/mm/yyyy`.
 */
export function formatDdMmYyyy(input: string | Date): string {
  const d = toDate(input);
  if (!d) return '';
  return padDate(d);
}

/**
 * Format ngày + giờ `dd/mm/yyyy HH:mm` (24h).
 */
export function formatDdMmYyyyHHmm(input: string | Date): string {
  const d = toDate(input);
  if (!d) return '';
  return `${padDate(d)} ${padTime(d)}`;
}

/**
 * Format ngày + giờ `dd/mm/yyyy HH:mm:ss` (24h).
 */
export function formatDdMmYyyyHHmmss(input: string | Date): string {
  const d = toDate(input);
  if (!d) return '';
  return `${padDate(d)} ${padTime(d)}:${PAD2(d.getSeconds())}`;
}

/**
 * Format ngày dài kiểu Việt: "Thứ Tư, 02/04/2026".
 *
 * Lưu ý: sử dụng `toLocaleDateString('vi-VN', { weekday: 'long' })` để lấy tên thứ.
 */
export function formatDdMmYyyyLong(input: string | Date): string {
  const d = toDate(input);
  if (!d) return '';
  const weekday = d.toLocaleDateString('vi-VN', { weekday: 'long' });
  return `${weekday}, ${padDate(d)}`;
}

/**
 * Format giờ `HH:mm`.
 */
export function formatHHmm(input: string | Date): string {
  const d = toDate(input);
  if (!d) return '';
  return padTime(d);
}

/**
 * Parse chuỗi `dd/mm/yyyy` hoặc `d/m/yyyy` thành Date. Trả `null` nếu sai.
 *
 * Hỗ trợ cả input có kèm giờ phía sau: "02/04/2026 09:30" hoặc "02/04/2026T09:30".
 */
export function parseDdMmYyyy(input: string): Date | null {
  if (!input) return null;
  const trimmed = input.trim();
  // Tách phần ngày và phần giờ nếu có
  const [datePart, timePart] = trimmed.split(/[ T]/);
  const parts = datePart.split(/[\/\-\.]/);
  if (parts.length !== 3) return null;
  const day = Number(parts[0]);
  const month = Number(parts[1]);
  const year = Number(parts[2]);
  if (!day || !month || !year) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (year < 1900 || year > 2999) return null;
  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }
  if (timePart) {
    const [hh, mm] = timePart.split(':');
    const hour = Number(hh);
    const minute = Number(mm ?? 0);
    if (Number.isFinite(hour) && hour >= 0 && hour <= 23) {
      d.setHours(hour, Number.isFinite(minute) ? minute : 0, 0, 0);
    }
  }
  return d;
}

/**
 * Kiểm tra một ngày (chỉ phần ngày, không tính giờ) đã nằm trong quá khứ so với `now`.
 *
 * Trả `true` nếu ngày của `d` < hôm nay (so sánh 00:00 local).
 */
export function isPastDate(input: string | Date, now: Date = new Date()): boolean {
  const d = toDate(input);
  if (!d) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return target.getTime() < today.getTime();
}

/**
 * Kiểm tra ngày + giờ đã qua so với `now` (so sánh timestamp).
 */
export function isPastDateTime(input: string | Date, now: Date = new Date()): boolean {
  const d = toDate(input);
  if (!d) return false;
  return d.getTime() < now.getTime();
}

/**
 * Format ngày tương đối kiểu Việt: "Hôm nay 09:30", "Ngày mai 14:00", "Hôm qua 08:00",
 * nếu khác năm "02/04/2026 09:30".
 */
export function formatRelativeVi(
  input: string | Date,
  now: Date = new Date(),
): string {
  const d = toDate(input);
  if (!d) return '';
  const startOf = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (startOf(d).getTime() - startOf(now).getTime()) / (1000 * 60 * 60 * 24),
  );
  const time = padTime(d);
  if (diffDays === 0) return `Hôm nay ${time}`;
  if (diffDays === 1) return `Ngày mai ${time}`;
  if (diffDays === -1) return `Hôm qua ${time}`;
  if (d.getFullYear() === now.getFullYear()) {
    return `${PAD2(d.getDate())}/${PAD2(d.getMonth() + 1)} ${time}`;
  }
  return `${padDate(d)} ${time}`;
}

/**
 * Trả về phần ngày `YYYY-MM-DD` từ Date (format BE friendly).
 */
export function toIsoDate(input: Date): string {
  return `${input.getFullYear()}-${PAD2(input.getMonth() + 1)}-${PAD2(input.getDate())}`;
}

/**
 * Trả về phần giờ `HH:mm` từ Date.
 */
export function toIsoTime(input: Date): string {
  return padTime(input);
}
