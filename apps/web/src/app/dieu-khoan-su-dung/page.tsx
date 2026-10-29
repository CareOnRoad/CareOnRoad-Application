import { PolicyPage } from "@/components/layout/policy-page";

/**
 * Điều khoản sử dụng — CareOnRoad
 * Tuân thủ:
 *  - Bộ luật Dân sự 2015, Luật Bảo vệ quyền lợi người tiêu dùng 2023.
 *  - Google Play Developer Distribution Agreement & User Data Policy.
 */
export default function TermsPage() {
  return (
    <PolicyPage
      title="Điều khoản sử dụng"
      lastUpdated="20/10/2026"
      intro={
        <>
          Bằng việc cài đặt hoặc sử dụng ứng dụng <strong>CareOnRoad</strong>,
          bạn đồng ý với các điều khoản dưới đây. Nếu bạn không đồng ý, vui
          lòng không sử dụng dịch vụ.
        </>
      }
    >
      <h2>1. Giới thiệu</h2>
      <p>
        CareOnRoad là nền tảng kết nối kỹ thuật viên cứu hộ và bảo dưỡng xe
        máy lưu động tại Việt Nam. Dịch vụ cung cấp gồm: cứu hộ khẩn cấp, bảo
        dưỡng tận nơi, tư vấn chẩn đoán qua chatbot AI.
      </p>

      <h2>2. Điều kiện sử dụng</h2>
      <ul>
        <li>Người dùng từ 16 tuổi trở lên, có đủ năng lực hành vi dân sự.</li>
        <li>
          Cung cấp thông tin trung thực khi đăng ký và tạo yêu cầu cứu hộ.
        </li>
        <li>
          Không sử dụng dịch vụ cho mục đích phi pháp, gian lận, hoặc gây rối.
        </li>
        <li>
          Tuân thủ hướng dẫn an toàn từ kỹ thuật viên trong quá trình xử lý sự
          cố.
        </li>
      </ul>

      <h2>3. Tài khoản & bảo mật</h2>
      <ul>
        <li>
          Bạn chịu trách nhiệm bảo mật mật khẩu và thiết bị đăng nhập.
        </li>
        <li>
          Mọi hoạt động phát sinh từ tài khoản của bạn được coi là do bạn thực
          hiện.
        </li>
        <li>
          Thông báo ngay cho chúng tôi khi phát hiện truy cập trái phép tại{" "}
          <a href="mailto:careonroad.work@gmail.com">
            careonroad.work@gmail.com
          </a>
          .
        </li>
      </ul>

      <h2>4. Phạm vi dịch vụ</h2>
      <ol>
        <li>
          <strong>Cứu hộ khẩn cấp</strong> — kỹ thuật viên tới địa điểm bạn
          cung cấp. Phí dịch vụ + phụ tùng (nếu có) theo báo giá trước khi
          thực hiện.
        </li>
        <li>
          <strong>Bảo dưỡng định kỳ</strong> — theo nhắc nhở app hoặc bạn đặt
          lịch.
        </li>
        <li>
          <strong>Chatbot tư vấn</strong> — chỉ mang tính tham khảo ban đầu,
          <strong>không thay thế chẩn đoán trực tiếp</strong> của kỹ thuật viên
          hay cơ sở sửa chữa.
        </li>
      </ol>

      <h2>5. Thanh toán và hoàn tiền</h2>
      <ul>
        <li>
          Thanh toán qua payOS/VietQR được <strong>xác minh tự động</strong>.
        </li>
        <li>
          Đơn hàng chưa thanh toán sẽ tự động huỷ sau 24 giờ.
        </li>
        <li>
          Yêu cầu hoàn tiền xử lý trong <strong>7–14 ngày làm việc</strong>{" "}
          nếu lỗi thuộc về CareOnRoad.
        </li>
      </ul>

      <h2>6. Giới hạn trách nhiệm</h2>
      <p>
        CareOnRoad <strong>không chịu trách nhiệm</strong> cho:
      </p>
      <ul>
        <li>
          Thiệt hại gián tiếp, tổn thất doanh thu, mất dữ liệu ngoài tầm
          kiểm soát.
        </li>
        <li>
          Chậm trễ do điều kiện giao thông, thiên tai, hoặc lực lượng chức năng
          phong toả.
        </li>
        <li>
          Tư vấn từ chatbot AI mang tính tham khảo — quyết định cuối cùng vẫn
          thuộc về kỹ thuật viên và bạn.
        </li>
      </ul>

      <h2>7. Hành vi bị cấm</h2>
      <ul>
        <li>
          Đăng nội dung vi phạm pháp luật, phân biệt đối xử, quấy rối.
        </li>
        <li>
          Giả mạo danh tính kỹ thuật viên hoặc người dùng khác.
        </li>
        <li>
          Cố tình phá hoại hệ thống, dò mật khẩu, tấn công DDoS hoặc các hành
          vi vi phạm Luật An ninh mạng 2018.
        </li>
      </ul>

      <h2>8. Tạm ngưng và chấm dứt</h2>
      <p>
        Chúng tôi có quyền tạm ngưng hoặc chấm dứt tài khoản của bạn nếu vi
        phạm điều khoản này hoặc theo yêu cầu của cơ quan có thẩm quyền. Bạn
        có thể yêu cầu xoá tài khoản tại trang{" "}
        <a href="/yeu-cau-xoa-tai-khoan">Yêu cầu xoá tài khoản</a>.
      </p>

      <h2>9. Sở hữu trí tuệ</h2>
      <p>
        Toàn bộ mã nguồn, thiết kế, nhãn hiệu <strong>CareOnRoad</strong> thuộc
        quyền sở hữu của chúng tôi. Bạn không được sao chép, phân phối khi
        chưa có văn bản cho phép.
      </p>

      <h2>10. Luật áp dụng và giải quyết tranh chấp</h2>
      <ul>
        <li>
          Điều khoản này được điều chỉnh bởi <strong>pháp luật Việt Nam</strong>.
        </li>
        <li>
          Tranh chấp phát sinh sẽ ưu tiên giải quyết qua thương lượng; nếu
          không đạt được thoả thuận, vụ việc sẽ đưa ra Toà án nhân dân có
          thẩm quyền tại TP. Hồ Chí Minh.
        </li>
      </ul>

      <h2>11. Liên hệ</h2>
      <p>
        Email hỗ trợ pháp lý:{" "}
        <a href="mailto:careonroad.work@gmail.com">
          careonroad.work@gmail.com
        </a>
        <br />
        Địa chỉ: TP. Hồ Chí Minh, Việt Nam
      </p>
    </PolicyPage>
  );
}
