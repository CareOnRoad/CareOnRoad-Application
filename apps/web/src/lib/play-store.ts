/**
 * Nguồn cấu hình DUY NHẤT cho toàn bộ nội dung liên quan tải app trên
 * landing page web (apps/web).
 *
 * Mọi CTA "tải app / tham gia beta" ở header, hero, services grid, CTA
 * glass, emergency banner và contact quick link đều đọc từ file này.
 * Muốn đổi link tải app (Google Play closed beta, TestFlight, APK trực
 * tiếp...) hoặc đổi nhãn hiển thị → chỉ sửa file này, không cần đụng vào
 * component nào.
 *
 * Ghi đè qua biến môi trường (không cần sửa code, áp dụng khi deploy):
 *   NEXT_PUBLIC_APP_DOWNLOAD_URL   - URL tải app
 *   NEXT_PUBLIC_APP_DOWNLOAD_LABEL  - nhãn nút
 *
 * Lưu ý: `NEXT_PUBLIC_*` được nhúng lúc build. Nếu đổi giá trị env mà không
 * rebuild, web vẫn dùng giá trị mặc định trong file này.
 */

/** Đường dẫn tải app mặc định — Google Play closed beta. */
const DEFAULT_DOWNLOAD_URL =
  "https://play.google.com/apps/internaltest/4701123392411738843";

/** Nhãn nút mặc định. */
const DEFAULT_DOWNLOAD_LABEL = "Tham gia thử nghiệm ngay";

/** URL tải app dùng cho mọi CTA. */
export const PLAY_STORE_BETA_URL =
  process.env.NEXT_PUBLIC_APP_DOWNLOAD_URL?.trim() || DEFAULT_DOWNLOAD_URL;

/** Nhãn nút tải app. */
export const JOIN_BETA_LABEL =
  process.env.NEXT_PUBLIC_APP_DOWNLOAD_LABEL?.trim() || DEFAULT_DOWNLOAD_LABEL;

/** Nhãn nút tải app dạng nhấn mạnh (hero). */
export const JOIN_BETA_LABEL_EMPHASIS = `${JOIN_BETA_LABEL}!`;

/**
 * Nội dung mô tả về giai đoạn thử nghiệm.
 *
 * Gom vào đây để khi đổi từ "closed beta" sang bản phát hành chính thức
 * chỉ cần sửa một chỗ thay vì rà khắp landing page.
 */
export const BETA_COPY = {
  /** Eyebrow nhỏ trên pill contact quick link. */
  eyebrow: "CAREBETA — MỜI BẠN THỬ NGHIỆM",
  /** Tiêu đề chính của các section kêu gọi tải app. */
  headline: "CareOnRoad đang trong giai đoạn thử nghiệm",
  /** Mô tả ngắn dưới tiêu đề. */
  description:
    "Tải app ngay hôm nay để trở thành một trong những người đầu tiên trải nghiệm dịch vụ cứu hộ và bảo dưỡng xe máy lưu động.",
  /** Mô tả riêng cho emergency banner (nhấn mạnh closed beta). */
  emergencyDescription:
    "CareOnRoad đang trong giai đoạn thử nghiệm closed beta. Tải app ngay để trải nghiệm sớm nhất khi hệ thống điều phối chính thức ra mắt.",
  /** Ghi chú nhỏ dưới nút tải app. */
  storeHint: "Mở Google Play closed beta",
} as const;
