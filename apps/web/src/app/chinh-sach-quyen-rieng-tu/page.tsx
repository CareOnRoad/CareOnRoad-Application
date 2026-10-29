import { PolicyPage } from "@/components/layout/policy-page";

/**
 * Chính sách quyền riêng tư — CareOnRoad
 * Tuân thủ:
 *  - Nghị định 13/2023/NĐ-CP (bảo vệ dữ liệu cá nhân tại Việt Nam).
 *  - Chính sách dữ liệu người dùng Google Play (Account deletion, Data safety, Permissions).
 *  - Luật An ninh mạng 2018.
 */
export default function PrivacyPolicyPage() {
  return (
    <PolicyPage
      title="Chính sách quyền riêng tư"
      lastUpdated="20/10/2026"
      intro={
        <>
          CareOnRoad (&ldquo;chúng tôi&rdquo;) tôn trọng quyền riêng tư của
          bạn và cam kết bảo vệ dữ liệu cá nhân theo{" "}
          <strong>Nghị định 13/2023/NĐ-CP</strong> và chính sách của Google
          Play. Tài liệu này giải thích chúng tôi thu thập, sử dụng, lưu trữ
          và chia sẻ dữ liệu cá nhân của bạn như thế nào.
        </>
      }
    >
      <h2>1. Dữ liệu chúng tôi thu thập</h2>
      <p>
        Khi bạn đăng ký, sử dụng dịch vụ cứu hộ/bảo dưỡng, hoặc tương tác với
        chatbot AI, chúng tôi thu thập các loại dữ liệu sau:
      </p>
      <table>
        <thead>
          <tr>
            <th>Loại dữ liệu</th>
            <th>Mục đích</th>
            <th>Bắt buộc?</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Email, mật khẩu</td>
            <td>Xác thực tài khoản, liên hệ</td>
            <td>Có</td>
          </tr>
          <tr>
            <td>Họ tên, số điện thoại</td>
            <td>Liên lạc khi cứu hộ</td>
            <td>Có</td>
          </tr>
          <tr>
            <td>Địa chỉ GPS (tự nhập hoặc 1 lần chụp)</td>
            <td>Điều phối kỹ thuật viên tới vị trí</td>
            <td>Có (khi dùng dịch vụ)</td>
          </tr>
          <tr>
            <td>Ảnh đại diện (tuỳ chọn)</td>
            <td>Hiển thị hồ sơ</td>
            <td>Không</td>
          </tr>
          <tr>
            <td>Thông tin xe (biển số, dòng xe)</td>
            <td>Phục vụ yêu cầu cứu hộ/bảo dưỡng</td>
            <td>Có (khi tạo yêu cầu)</td>
          </tr>
          <tr>
            <td>Lịch sử yêu cầu, đánh giá</td>
            <td>Quản lý dịch vụ, cải thiện chất lượng</td>
            <td>Tự động</td>
          </tr>
          <tr>
            <td>Thông báo đẩy (push token)</td>
            <td>Gửi cảnh báo cứu hộ, cập nhật trạng thái</td>
            <td>Không (có thể tắt)</td>
          </tr>
          <tr>
            <td>Device ID, IP, log kỹ thuật</td>
            <td>Bảo mật, chống gian lận</td>
            <td>Tự động</td>
          </tr>
        </tbody>
      </table>

      <h2>2. Dữ liệu xử lý qua AI Chatbot</h2>
      <p>
        Khi bạn dùng chatbot tư vấn, chúng tôi có thể gửi <strong>văn bản câu
        hỏi</strong> hoặc <strong>file âm thanh WAV</strong> của bạn tới:
      </p>
      <ul>
        <li>
          <strong>Gemini / OpenRouter</strong> — chỉ để tạo nội dung tư vấn
          chẩn đoán sự cố xe máy. Tin nhắn được gửi qua HTTPS và không chứa
          thông tin cá nhân nhận dạng (PII) bắt buộc.
        </li>
        <li>
          <strong>Sherpa-ONNX (cục bộ)</strong> — phiên âm giọng nói sang văn
          bản được xử lý <strong>trực tiếp trên máy chủ của chúng tôi</strong>,
          không gửi file gốc cho bên thứ ba.
        </li>
      </ul>
      <p>
        Bạn có thể <strong>từ chối</strong> dùng chatbot bất kỳ lúc nào; lịch
        sử hội thoại có thể bị xoá theo mục 5.
      </p>

      <h2>3. Cơ sở pháp lý cho việc xử lý</h2>
      <ul>
        <li>
          <strong>Đồng ý của bạn</strong> — khi tick chấp nhận chính sách này.
        </li>
        <li>
          <strong>Hợp đồng dịch vụ</strong> — để thực hiện yêu cầu cứu hộ/bảo
          dưỡng bạn đã tạo.
        </li>
        <li>
          <strong>Nghĩa vụ pháp luật</strong> — lưu trữ hóa đơn, bằng chứng
          giao dịch theo quy định thuế.
        </li>
        <li>
          <strong>Lợi ích hợp pháp</strong> — bảo mật, chống gian lận, cải
          thiện dịch vụ.
        </li>
      </ul>

      <h2>4. Chia sẻ dữ liệu với bên thứ ba</h2>
      <p>Chúng tôi <strong>không bán</strong> dữ liệu cá nhân của bạn.</p>
      <ul>
        <li>
          <strong>Supabase</strong> — lưu trữ cơ sở dữ liệu (Singapore/EU,
          tuân thủ GDPR).
        </li>
        <li>
          <strong>Vercel</strong> — máy chủ web và CDN (có trung tâm dữ liệu
          tại Singapore).
        </li>
        <li>
          <strong>Firebase Cloud Messaging</strong> — gửi thông báo đẩy (ẩn danh
          theo device token).
        </li>
        <li>
          <strong>Google Routes API</strong> — chỉ dùng khi bạn yêu cầu xem ETA
          tuyến đường.
        </li>
        <li>
          <strong>Cơ quan nhà nước</strong> — chỉ khi có yêu cầu hợp pháp.
        </li>
      </ul>

      <h2>5. Quyền của bạn</h2>
      <p>Theo Nghị định 13/2023/NĐ-CP, bạn có các quyền:</p>
      <ol>
        <li>Được biết về dữ liệu đang được xử lý.</li>
        <li>Đồng ý hoặc rút lại đồng ý.</li>
        <li>Truy cập, chỉnh sửa dữ liệu của mình.</li>
        <li>
          <strong>Yêu cầu xoá tài khoản và dữ liệu</strong> — xem trang{" "}
          <a href="/yeu-cau-xoa-tai-khoan">Yêu cầu xoá tài khoản</a>.
        </li>
        <li>Hạn chế hoặc phản đối việc xử lý.</li>
        <li>Khiếu nại lên Bộ Công An (Cục An toàn thông tin).</li>
      </ol>

      <h2>6. Lưu trữ và bảo mật</h2>
      <ul>
        <li>Mật khẩu được mã hoá (hash bcrypt).</li>
        <li>Truyền tải HTTPS bắt buộc trên toàn hệ thống.</li>
        <li>
          Dữ liệu thanh toán (nếu có) xử lý qua nhà cung cấp đạt chuẩn PCI-DSS
          — chúng tôi không lưu số thẻ.
        </li>
        <li>
          Thời gian lưu trữ: tối đa <strong>24 tháng</strong> sau lần tương
          tác cuối, trừ khi pháp luật yêu cầu khác.
        </li>
      </ul>

      <h2>7. Trẻ em</h2>
      <p>
        CareOnRoad không dành cho người dưới 16 tuổi (tuổi tối thiểu sử dụng
        dịch vụ vận tải/do Google Play cho phép). Chúng tôi không cố ý thu
        thập dữ liệu của trẻ em.
      </p>

      <h2>8. Thay đổi chính sách</h2>
      <p>
        Khi có thay đổi quan trọng, chúng tôi sẽ thông báo trong app và qua
        email đăng ký ít nhất <strong>30 ngày</strong> trước khi áp dụng.
      </p>

      <h2>9. Liên hệ</h2>
      <p>
        Mọi câu hỏi về quyền riêng tư vui lòng liên hệ:
        <br />
        <strong>Email:</strong>{" "}
        <a href="mailto:careonroad.work@gmail.com">
          careonroad.work@gmail.com
        </a>
        <br />
        <strong>Đơn vị:</strong> CareOnRoad
        <br />
        <strong>Địa chỉ:</strong> TP. Hồ Chí Minh, Việt Nam
      </p>
    </PolicyPage>
  );
}
