import { PLAN_PERIOD_DAYS, type PaidPlanCode, type PlanCode } from "./plan";

/**
 * Catalog gói trả phí cho rider.
 *
 * Nguồn giá và tính năng nằm ở đây (constants, không cần migration) để backend
 * và mobile cùng hiển thị một nguồn. Mọi gói đều tính theo chu kỳ 30 ngày,
 * không có gói năm.
 *
 * Catalog không ảnh hưởng tới mechanic/dispatch: các khoá tính năng chỉ liên
 * quan tới rider (preset nhắc bảo dưỡng + chi tiết VIP của xe).
 */

export type PlanCatalogEntry = {
  code: PlanCode;
  /** Tên gói hiển thị cho người dùng. */
  name: string;
  /** Mô tả ngắn 1 câu. */
  tagline: string;
  /** Giá trong 1 chu kỳ (VND). Gói free luôn bằng 0. */
  price: number;
  currency: "VND";
  /** Số ngày của 1 chu kỳ thanh toán. */
  periodDays: number;
  /** Gói này có thể mua trực tiếp không (free thì không). */
  purchasable: boolean;
  /** Danh sách tính năng được mở khoá (tiếng Việt, dùng để render UI). */
  features: string[];
  /** Ghi chú thêm hiển thị dưới card gói. */
  note?: string;
};

export const PLAN_CATALOG: readonly PlanCatalogEntry[] = [
  {
    code: "free",
    name: "Free",
    tagline: "Dùng cơ bản CareOnRoad, hoàn toàn miễn phí.",
    price: 0,
    currency: "VND",
    periodDays: PLAN_PERIOD_DAYS,
    purchasable: false,
    features: [
      "Cứu hộ và sửa chữa tại chỗ theo yêu cầu",
      "Quản lý xe và lịch sử dịch vụ",
      "Nhắc việc bảo dưỡng cơ bản theo ngày bạn tự đặt"
    ],
    note: "Gói mặc định của mọi tài khoản."
  },
  {
    code: "advance",
    name: "Advance",
    tagline: "Bảo dưỡng định kỳ tự động theo mức sử dụng thực tế.",
    price: 10000,
    currency: "VND",
    periodDays: PLAN_PERIOD_DAYS,
    purchasable: true,
    features: [
      "Toàn bộ tính năng của gói Free",
      "Nhắc thay nhớt máy theo mức sử dụng (nhẹ / vừa / nặng)",
      "Nhắc thay dầu láp, dầu phanh và nước làm mát",
      "Lịch bảo dưỡng được tự tính lại sau mỗi lần đánh dấu đã làm"
    ],
    note: "Áp dụng cho mọi xe đã đăng ký trong tài khoản."
  },
  {
    code: "vip",
    name: "VIP",
    tagline: "Bảo dưỡng định kỳ + hồ sơ xe đầy đủ, ưu tiên nhắc bảo hiểm.",
    price: 50000,
    currency: "VND",
    periodDays: PLAN_PERIOD_DAYS,
    purchasable: true,
    features: [
      "Toàn bộ tính năng của gói Advance",
      "Nhắc gia hạn bảo hiểm TNDS bắt buộc trước khi hết hạn",
      "Lưu chi tiết xe: màu, số khung, số máy, ngày mua, giá mua",
      "Lưu thông tin bảo hành, bảo hiểm và trung tâm bảo hành ưu tiên"
    ],
    note: "Gói cao cấp nhất, dành cho người chạy nhiều."
  }
];

export const NON_REFUNDABLE_NOTICE =
  "Gói đã mua không được hoàn tiền. Vui lòng kiểm tra kỹ trước khi thanh toán.";

export function getPlanCatalog(): PlanCatalogEntry[] {
  return PLAN_CATALOG.map((entry) => ({ ...entry, features: [...entry.features] }));
}

export function getPlanEntry(code: PlanCode): PlanCatalogEntry | undefined {
  const entry = PLAN_CATALOG.find((item) => item.code === code);
  return entry ? { ...entry, features: [...entry.features] } : undefined;
}

/** Chỉ `advance` và `vip` mới mua được. */
export function isPurchasablePlan(code: PlanCode): code is PaidPlanCode {
  return code === "advance" || code === "vip";
}

export function getPurchasablePlans(): PlanCatalogEntry[] {
  return PLAN_CATALOG.filter((entry) => entry.purchasable).map((entry) => ({
    ...entry,
    features: [...entry.features]
  }));
}
