# Test có hệ thống ngoài hoặc thiết bị thật

Các ca thiết bị/ngân hàng/legacy bên dưới cần bằng chứng ngoài bộ HTTP tự động.
Crash, thiếu FCM và fencing có chế độ runner riêng, xem README và kết quả theo ID;
Legacy có `--legacy-smoke`: tạo dữ liệu qua API Git trước034/035 rồi nâng schema
riêng; quy trình dưới đây vẫn dùng được cho dữ liệu dev đã tồn tại.
provider vẫn mô phỏng, không thay thế quan sát ngân hàng/điện thoại. Cần ghi thời
gian, ID request/assignment/quote/payment/notification, kết quả API và quan sát
ngoài hệ thống. Không ghi JWT, token thiết bị, khóa provider hoặc thông tin ngân hàng.
Không coi provider trả 200 là bằng chứng máy đã hiển thị thông báo hoặc ngân hàng
đã thực sự ghi nhận tiền.

## Thanh toán ngân hàng thật

Điều kiện: project dev có migrations001–035, payOS dev/test được phép sử dụng,
webhook HTTPS hoạt động, tài khoản thanh toán được chủ sở hữu cho phép chuyển tiền.

1. Tạo xe và request bảo dưỡng qua API; chạy matching; thợ nhận offer.
2. Thợ báo `maintenance_labor`; khách duyệt; thợ `en_route`, `on_site`, `diagnosis`.
3. Thợ báo `maintenance_work`; khách duyệt; thợ `in_progress`; gửi checklist;
   chuyển `awaiting_payment`.
4. GET payment-summary; POST payment order bằng quote đã duyệt. So sánh amount
   với remaining_amount và các dòng được duyệt.
5. Chủ tài khoản thực hiện khoản chuyển đã được cho phép qua checkout/QR.
6. Quan sát webhook HTTPS từ payOS; GET order/summary. Kỳ vọng succeeded, paid
   đúng và remaining=0, assignment vẫn awaiting_payment. Refresh return URL không
   được tự xác nhận tiền. Thợ chủ động completed; hai trạng thái đồng bộ.
7. Chặn callback ở môi trường test và chạy reconcile theo lịch để kiểm tra khôi
   phục mất webhook. Replay callback không cộng thêm tiền/notice.

Under/over/late payment phải được đối chiếu theo provider và ngân hàng, giữ review
khi chưa đủ bằng chứng; không dùng SQL để ép paid/succeeded. Các mẫu sai chữ ký,
sai số tiền, trùng webhook, canceled-late-success và admin resolution đã có ca HTTP
với provider wire mô phỏng trong catalogue.

## Bảo dưỡng legacy standard

Điều kiện: fixture được tạo hợp lệ qua deployment trước migration034, gồm quote
standard và lịch sử gốc. Không giả dữ liệu legacy bằng cách sửa trạng thái DB.

1. Lưu amount, trạng thái và payment đã thu trước migration.
2. Sau migration, đọc lại qua API: lịch sử/amount giữ nguyên.
3. Quote standard legacy đã duyệt vẫn cần verified payment trước in_progress.
4. Tiền đã thu không được tính lại thành khoản trả sau hoặc thu thêm lần nữa.
5. Request mới phải bị chặn purpose standard; hoàn tất legacy theo state machine
   và payment prerequisite của nó.

## Notice trên Android/iOS

Điều kiện: FCM service account hợp lệ, app dev tích hợp FCM, đăng nhập đúng fixture,
thiết bị thật và người/automation quan sát máy. API trên máy phải trỏ đúng môi trường
test chứa các ID trong notice.

1. POST auth/devices với device_key/platform và cặp push_token/push_provider=fcm;
   response chỉ trả metadata, không trả token. Dùng deviceId để rotate/revoke.
2. Tạo một sự kiện ở mỗi loại: reminder đến hạn, offer/accepted cứu hộ, và
   booking/quote/preparation/payment/completed bảo dưỡng. Chạy workers phù hợp.
3. GET inbox để lấy notification_id; đối chiếu ID đó với dữ liệu FCM/SDK/thiết bị.
4. Chạy ma trận dưới đây ở cả Android và iOS; lặp cho các loại sự kiện ở bước2.

| Trạng thái máy/app | Kiểm tra | Kỳ vọng |
|---|---|---|
| Foreground, được cấp quyền | SDK callback, UI theo thiết kế, inbox | Đúng notification_id/nội dung; không gửi lộ thông tin user khác |
| Background, được cấp quyền | Notice hệ điều hành; mở app | ID/nội dung đúng; inbox vẫn tồn tại; read state độc lập |
| App đóng/OS dừng app | Ghi loại thao tác đóng; mở lại và kiểm tra | Đánh giá theo hạn chế OS/SDK; inbox không mất, không suy diễn đã nhận từ provider200 |
| Từ chối quyền | Tạo notice, đọc inbox | Không ép hiển thị OS; inbox vẫn đọc được; không false claim physical receipt |
| Offline rồi online | Ghi thời gian offline/reconnect và chính sách TTL | Nhận theo TTL/provider; retry không tạo thêm inbox; gộp trùng theo notification_id |
| Nhiều thiết bị | Hai token cùng user | Đúng recipient trên từng máy, receipt từng version; lỗi một máy không mất inbox |
| Rotate/reinstall | Token cũ invalid, token mới valid | Token bị từ chối chỉ vô hiệu đúng version; token mới vẫn dùng được |
| Logout/account switch | Revoke token/session cũ rồi đăng nhập user khác | User mới không thấy notice/dữ liệu riêng của user cũ |
| Tap notice | Mở reminder/request/assignment/quote/payment | UUID điều hướng tồn tại và đúng quyền; không mở resource của user khác |

Hành vi nhận/hiển thị cần theo cấu hình client và OS, xem
[FCM receiving messages](https://firebase.google.com/docs/cloud-messaging/flutter/receive).
Backend inbox và provider acceptance đã được kiểm tra riêng trong HTTP suite.

## Crash, fencing và cấu hình

1. Dùng provider barrier, hai worker process và lease có thời gian điều khiển.
   Dừng worker sau provider-success, trước receipt commit; khởi động lại. Inbox
   không nhân đôi; nếu transport lặp thì giữ cùng notification_id cho client gộp.
2. Cho lease cũ hết hạn, worker mới claim; thả worker cũ. Worker cũ không được ghi
   đè receipt/outbox đã hoàn tất bởi lease/token mới.
3. Rotate token trong lúc FCM trả UNREGISTERED của version cũ. Credential mới
   phải còn enabled; chỉ version bị từ chối được vô hiệu.
4. Restart API dev thiếu FCM config; tạo notice và chạy worker. Inbox tồn tại,
   cấu hình lỗi/retry được ghi nhận, không đánh dấu provider gửi thành công giả.
5. Dừng API sau payOS đã tạo link, trước khi trả201; restart/retry cùng key. Một
   logical payment link/order; không thu lại tiền đã verified.

Chưa có crash barrier/physical observer thì kết quả là BLOCKED. Concurrent HTTP
worker/offer cases không thay thế các thời điểm crash/fencing đặc biệt này.
