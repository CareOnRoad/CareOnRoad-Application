/**
 * Helper thuần cho "Hồ sơ xe đầy đủ" (gói VIP).
 *
 * Contract BE (`apps/api/src/features/motorcycles/motorcycle.schemas.ts` →
 * `motorcycleDetailsPatchSchema`):
 *  - Schema **strict**: không gửi field lạ.
 *  - Gửi `undefined` (bỏ qua key) → giữ nguyên giá trị đang lưu.
 *  - Gửi `null` → xoá giá trị (luôn được phép, kể cả khi hết gói — D14).
 *  - Gửi giá trị khác `null` → cần gói `vip` hiệu lực, nếu không backend trả
 *    403 `plan_required`.
 *  - Chuỗi rỗng KHÔNG hợp lệ (`z.string().trim().min(1)`) → muốn xoá thì gửi `null`.
 *  - Ngày phải là `YYYY-MM-DD` thật; `purchase_date` không được ở tương lai.
 */
import type { MotorcycleDetails, MotorcycleDetailsPatch } from '@/lib/motorcycles-service';

/** Loại input hiển thị. */
export type VehicleDetailFieldKind = 'text' | 'date' | 'number';

/** Metadata của một trường hồ sơ xe. */
export type VehicleDetailFieldMeta = {
  /** Key đúng tên cột BE (snake_case). */
  key: keyof MotorcycleDetails;
  /** Label tiếng Việt hiển thị trên UI. */
  label: string;
  kind: VehicleDetailFieldKind;
  /** Placeholder / gợi ý nhập. */
  placeholder?: string;
  /** Giá trị tối đa theo schema BE. */
  maxLength?: number;
  /** Đơn vị hiển thị (dùng cho number). */
  unit?: string;
};

/**
 * Danh sách 10 trường hồ sơ xe, đúng thứ tự và giới hạn của schema BE.
 *
 * Nhóm: thông tin xe → mua/bảo hành → bảo hiểm → trung tâm bảo hành.
 */
export const VEHICLE_DETAIL_FIELDS: readonly VehicleDetailFieldMeta[] = [
  {
    key: 'color',
    label: 'Màu sắc',
    kind: 'text',
    placeholder: 'Ví dụ: Đen, Đỏ trắng',
    maxLength: 50,
  },
  {
    key: 'frame_number',
    label: 'Số khung',
    kind: 'text',
    placeholder: 'Số khung in trên xe',
    maxLength: 50,
  },
  {
    key: 'engine_number',
    label: 'Số máy',
    kind: 'text',
    placeholder: 'Số máy in trên xe',
    maxLength: 50,
  },
  {
    key: 'purchase_date',
    label: 'Ngày mua',
    kind: 'date',
  },
  {
    key: 'purchase_price_vnd',
    label: 'Giá mua',
    kind: 'number',
    placeholder: 'Ví dụ: 35000000',
    unit: 'đ',
  },
  {
    key: 'warranty_expires_on',
    label: 'Bảo hành hết hạn',
    kind: 'date',
  },
  {
    key: 'insurance_provider',
    label: 'Nhà cung cấp bảo hiểm',
    kind: 'text',
    placeholder: 'Ví dụ: PICC, Bảo Việt',
    maxLength: 100,
  },
  {
    key: 'insurance_policy_number',
    label: 'Số hợp đồng bảo hiểm',
    kind: 'text',
    placeholder: 'Số hợp đồng',
    maxLength: 100,
  },
  {
    key: 'insurance_expires_on',
    label: 'Bảo hiểm hết hạn',
    kind: 'date',
  },
  {
    key: 'preferred_service_center',
    label: 'Trung tâm bảo hành ưu tiên',
    kind: 'text',
    placeholder: 'Tên garage bạn hay ghé',
    maxLength: 200,
  },
] as const;

/** Giá trị form: mọi trường đều là chuỗi (để nhập dễ). */
export type VehicleDetailsFormState = Record<string, string>;

/** Tạo form state rỗng (mọi field = ''). */
export function emptyDetailsFormState(): VehicleDetailsFormState {
  const state: VehicleDetailsFormState = {};
  for (const field of VEHICLE_DETAIL_FIELDS) {
    state[field.key] = '';
  }
  return state;
}

/** Đổi `details` của BE → form state (string). */
export function detailsToFormState(
  details: MotorcycleDetails | undefined,
): VehicleDetailsFormState {
  const state = emptyDetailsFormState();
  if (!details) return state;
  for (const field of VEHICLE_DETAIL_FIELDS) {
    const value = details[field.key];
    if (value === undefined || value === null) continue;
    state[field.key] = String(value);
  }
  return state;
}

/**
 * Chuẩn hoá 1 giá trị form → giá trị gửi BE.
 *
 *  - Chuỗi rỗng → `null` (xoá) — vì schema BE không nhận chuỗi rỗng.
 *  - Field `number` → parse int, không hợp lệ → `null` (xoá).
 *  - Field `date` → giữ nguyên chuỗi `YYYY-MM-DD`.
 */
function normalizeValue(
  kind: VehicleDetailFieldKind,
  raw: string,
): string | number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (kind === 'number') {
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed)) return null;
    return parsed;
  }
  return trimmed;
}

/**
 * Tính patch partial-update cho `PATCH /api/v1/motorcycles/{id}/details`.
 *
 * Ngữ nghĩa khớp BE:
 *  - Field không đổi so với `original` → `undefined` (giữ giá trị đang lưu).
 *  - Field bị xoá (về rỗng) → `null`.
 *  - Field có giá trị mới → giá trị đó.
 *
 * Nếu patch rỗng (không có key nào khác `undefined`) → trả `null` để caller
 * bỏ qua request (BE yêu cầu "at least one detail field").
 */
export function formStateToDetailsPatch(
  form: VehicleDetailsFormState,
  original: MotorcycleDetails | undefined,
): MotorcycleDetailsPatch | null {
  const patch: MotorcycleDetailsPatch = {};
  let hasChange = false;

  for (const field of VEHICLE_DETAIL_FIELDS) {
    const rawValue = form[field.key] ?? '';
    const normalized = normalizeValue(field.kind, rawValue);
    const before = original?.[field.key];
    const beforeNormalized =
      before === undefined || before === null ? null : before;

    if (normalized === beforeNormalized) {
      // Không đổi → bỏ qua key (BE giữ nguyên giá trị cũ).
      continue;
    }
    if (normalized === null) {
      // Xoá.
      patch[field.key] = null;
      hasChange = true;
      continue;
    }
    patch[field.key] = normalized as never;
    hasChange = true;
  }

  return hasChange ? patch : null;
}

/**
 * Kiểm tra ngày mua không được ở tương lai (BE trả 400 `INVALID_INPUT`).
 *
 * So sánh theo ngày lịch, không theo giờ.
 */
export function isFutureIsoDate(value: string, now: Date = new Date()): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const target = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(target.getTime())) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return target.getTime() > today.getTime();
}

/**
 * Kiểm tra giá mua trong khoảng BE cho phép: 0 <= v <= 999_999_999_999.
 */
export function isValidPurchasePrice(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true; // rỗng = xoá, không cần validate
  if (!/^\d+$/.test(trimmed)) return false;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 999_999_999_999;
}
