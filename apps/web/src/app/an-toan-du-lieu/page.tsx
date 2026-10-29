import { PolicyPage } from "@/components/layout/policy-page";

/**
 * An toàn dữ liệu — CareOnRoad
 * Tuân thủ:
 *  - Google Play Data safety form (các loại dữ liệu, mã hoá, xoá, chia sẻ).
 *  - Google Play Account Deletion requirements.
 *  - Nghị định 13/2023/NĐ-CP, Luật An toàn thông tin mạng 2015.
 */
export default function DataSafetyPage() {
  return (
    <PolicyPage
      title="An toàn dữ liệu"
      lastUpdated="20/10/2026"
      intro={
        <>
          Trang này tổng hợp cách CareOnRoad bảo vệ dữ liệu của bạn — phù hợp
          với phần khai báo <strong>Data safety</strong> trên Google Play và
          các quy định pháp luật Việt Nam về bảo vệ dữ liệu cá nhân.
        </>
      }
    >
      <h2>1. Mã hoá khi truyền tải và lưu trữ</h2>
      <ul>
        <li>
          <strong>Truyền tải:</strong> toàn bộ kết nối giữa app và máy chủ dùng
          HTTPS/TLS 1.3.
        </li>
        <li>
          <strong>Lưu trữ:</strong> mật khẩu được hash bcrypt; dữ liệu nhạy cảm
          (số tài khoản ngân hàng nếu có, push token) được mã hoá tại
          database.
        </li>
        <li>
          <strong>Backup:</strong> sao lưu mã hoá AES-256, lưu trữ tại trung
          tâm dữ liệu Supabase (Singapore/EU).
        </li>
      </ul>

      <h2>2. Ai có thể truy cập dữ liệu?</h2>
      <table>
        <thead>
          <tr>
            <th>Vai trò</th>
            <th>Quyền truy cập</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Bạn (chủ tài khoản)</td>
            <td>Toàn quyền xem, sửa, xoá dữ liệu của mình</td>
          </tr>
          <tr>
            <td>Kỹ thuật viên được phân công</td>
            <td>
              Chỉ thấy tên, SĐT, địa chỉ, chi tiết yêu cầu của bạn khi đang
              xử lý
            </td>
          </tr>
          <tr>
            <td>Quản trị viên hệ thống</td>
            <td>
              Truy cập hạn chế cho mục đích hỗ trợ kỹ thuật, đã log đầy đủ
            </td>
          </tr>
          <tr>
            <td>Cơ quan nhà nước</td>
            <td>
              Chỉ khi có văn bản yêu cầu hợp pháp theo Luật An ninh mạng 2018
            </td>
          </tr>
        </tbody>
      </table>

      <h2>3. Chia sẻ với bên thứ ba</h2>
      <p>
        Không bán, không cho thuê dữ liệu. Dữ liệu chỉ được chia sẻ tối thiểu
        với:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> — lưu trữ database, RLS bảo vệ theo hàng.
        </li>
        <li>
          <strong>Vercel</strong> — máy chủ web, CDN.
        </li>
        <li>
          <strong>Firebase Cloud Messaging (Google)</strong> — gửi thông báo
          đẩy (token ẩn danh theo thiết bị).
        </li>
        <li>
          <strong>Google AI / OpenRouter</strong> — chỉ xử lý câu hỏi chatbot
          bạn gửi, không kèm PII bắt buộc.
        </li>
      </ul>

      <h2>4. Loại dữ liệu & mục đích (Google Play Data Safety)</h2>
      <table>
        <thead>
          <tr>
            <th>Danh mục Google Play</th>
            <th>Dữ liệu cụ thể</th>
            <th>Có chia sẻ?</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Thông tin cá nhân</td>
            <td>Họ tên, email, SĐT, địa chỉ</td>
            <td>Không</td>
          </tr>
          <tr>
            <td>Vị trí</td>
            <td>GPS 1 lần khi tạo yêu cầu cứu hộ</td>
            <td>Không</td>
          </tr>
          <tr>
            <td>Hoạt động trong ứng dụng</td>
            <td>Lịch sử yêu cầu, đánh giá</td>
            <td>Không</td>
          </tr>
          <tr>
            <td>Ảnh / video</td>
            <td>Ảnh đại diện (tuỳ chọn), ảnh yêu cầu</td>
            <td>Không</td>
          </tr>
          <tr>
            <td>Thiết bị</td>
            <td>Device ID, hệ điều hành, push token</td>
            <td>Có (FCM)</td>
          </tr>
          <tr>
            <td>Âm thanh</td>
            <td>File WAV chatbot (chỉ khi bạn gửi)</td>
            <td>Không (xử lý nội bộ)</td>
          </tr>
        </tbody>
      </table>

      <h2>5. Cách chúng tôi phản hồi sự cố</h2>
      <ul>
        <li>
          Khi phát hiện vi phạm dữ liệu, chúng tôi thông báo cho bạn và Cục
          An toàn thông tin trong vòng <strong>72 giờ</strong> (theo Nghị định
          13/2023/NĐ-CP).
        </li>
        <li>
          Mọi sự cố được điều tra, khắc phục và báo cáo kết quả qua email
          đăng ký.
        </li>
      </ul>

      <h2>6. Tuỳ chọn quyền riêng tư</h2>
      <p>
        Bạn có thể quản lý ngay trong app tại <em>Cài đặt → Quyền riêng tư</em>:
      </p>
      <ul>
        <li>Bật / tắt thông báo đẩy.</li>
        <li>Bật / tắt GPS khi tạo yêu cầu cứu hộ.</li>
        <li>Xoá lịch sử hội thoại chatbot.</li>
        <li>Yêu cầu xoá vĩnh viễn tài khoản và toàn bộ dữ liệu.</li>
      </ul>

      <h2>7. Yêu cầu xoá tài khoản (Google Play)</h2>
      <p>
        Theo chính sách Google Play, bạn có quyền yêu cầu xoá tài khoản và
        toàn bộ dữ liệu liên quan bất kỳ lúc nào. Vui lòng truy cập trang{" "}
        <a href="/yeu-cau-xoa-tai-khoan">Yêu cầu xoá tài khoản</a>.
      </p>

      <h2>8. Liên hệ về an toàn dữ liệu</h2>
      <p>
        Nếu bạn phát hiện lỗ hổng hoặc có thắc mắc, vui lòng email:{" "}
        <a href="mailto:careonroad.work@gmail.com">
          careonroad.work@gmail.com
        </a>
      </p>
    </PolicyPage>
  );
}
