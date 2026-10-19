import type { Metadata } from "next";
import { PolicyPage } from "@/components/layout/policy-page";
import { DeletionRequestForm } from "./deletion-form";

/**
 * Yêu cầu xoá tài khoản — CareOnRoad.
 *
 * Tuân thủ Google Play User Data Policy: cho phép người dùng khởi tạo yêu cầu
 * xoá tài khoản và toàn bộ dữ liệu liên quan từ trong app hoặc website.
 *
 * Quy trình:
 *  1. Người dùng điền form bên dưới.
 *  2. Hệ thống gửi email nội bộ tới đội ngũ CareOnRoad (careonroad.work@gmail.com).
 *  3. Trong vòng 7 ngày làm việc:
 *     - Xác minh danh tính qua email đăng ký.
 *     - Đóng tài khoản + xoá lịch sử yêu cầu, đánh giá, push token.
 *     - Xoá dữ liệu cá nhân khỏi database lưu trữ (giữ lại dữ liệu kế toán
 *       theo quy định thuế nếu có giao dịch trong vòng 5 năm).
 */
export const metadata: Metadata = {
  title: "Yêu cầu xoá tài khoản — CareOnRoad",
  description:
    "Yêu cầu xoá tài khoản CareOnRoad và toàn bộ dữ liệu cá nhân liên quan, theo Nghị định 13/2023/NĐ-CP và chính sách Google Play.",
};

export default function DeletionRequestPage() {
  return (
    <PolicyPage
      title="Yêu cầu xoá tài khoản"
      lastUpdated="20/10/2026"
      intro={
        <>
          Bạn có thể yêu cầu <strong>xóa vĩnh viễn tài khoản</strong> và toàn
          bộ dữ liệu cá nhân liên quan bất kỳ lúc nào. Việc này tuân thủ Nghị
          định 13/2023/NĐ-CP và chính sách Google Play. Sau khi xoá,
          <strong> không thể khôi phục</strong>.
        </>
      }
    >
      <h2>Dữ liệu sẽ được xoá</h2>
      <ul>
        <li>Thông tin hồ sơ (họ tên, email, SĐT, địa chỉ, ảnh đại diện).</li>
        <li>Danh sách xe máy đã đăng ký.</li>
        <li>
          Lịch sử yêu cầu cứu hộ/bảo dưỡng, đánh giá, lịch sử nhắc nhở.
        </li>
        <li>Lịch sử hội thoại chatbot AI.</li>
        <li>Thông báo đẩy, device token, device record.</li>
        <li>Toàn bộ phiên đăng nhập đang hoạt động.</li>
      </ul>

      <h2>Dữ liệu có thể được giữ lại</h2>
      <ul>
        <li>
          <strong>Hoá đơn, chứng từ thanh toán</strong> — tối đa 5 năm theo quy
          định thuế Việt Nam.
        </li>
        <li>
          <strong>Dữ liệu ẩn danh phục vụ thống kê tổng hợp</strong> (đã loại
          bỏ mọi thông tin nhận dạng cá nhân).
        </li>
        <li>
          <strong>Bản ghi log bảo mật</strong> — tối đa 12 tháng cho mục đích
          điều tra sự cố.
        </li>
      </ul>

      <h2>Quy trình xử lý</h2>
      <ol>
        <li>
          <strong>Gửi yêu cầu</strong> qua form bên dưới hoặc email trực tiếp
          tới <strong>careonroad.work@gmail.com</strong>.
        </li>
        <li>
          <strong>Xác minh danh tính</strong> — chúng tôi sẽ gửi email xác
          nhận về địa chỉ đăng ký tài khoản.
        </li>
        <li>
          <strong>Đóng tài khoản</strong> — sau khi xác minh, tài khoản bị vô
          hiệu hoá, không thể đăng nhập.
        </li>
        <li>
          <strong>Xoá dữ liệu</strong> — trong vòng 7 ngày làm việc, toàn bộ
          dữ liệu cá nhân bị xoá khỏi database lưu trữ và backup.
        </li>
        <li>
          <strong>Thông báo hoàn tất</strong> qua email đăng ký.
        </li>
      </ol>

      <h2>Cách khác để yêu cầu</h2>
      <ul>
        <li>
          Trong app: <em>Cài đặt → Tài khoản → Xoá tài khoản</em>.
        </li>
        <li>
          Email:{" "}
          <a href="mailto:careonroad.work@gmail.com">
            careonroad.work@gmail.com
          </a>{" "}
          với tiêu đề &ldquo;Yêu cầu xoá tài khoản&rdquo;.
        </li>
      </ul>

      <h2>Bắt đầu yêu cầu</h2>
      <DeletionRequestForm />
    </PolicyPage>
  );
}
