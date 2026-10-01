# Đặt lịch bảo dưỡng và thông báo

Thay đổi backend theo plan ngày 01/10/2026. Mobile/web vẫn cần tích hợp API.
Luồng báo giá, vật tư, checklist và thanh toán sau dịch vụ xem
[MAINTENANCE-WORKFLOW.md](MAINTENANCE-WORKFLOW.md).

## Đặt lịch và xác nhận

1. Rider tạo `POST /api/v1/service-requests` với `X-Idempotency-Key`,
   `service_type: "periodic_maintenance"`, xe thuộc sở hữu, `location` và
   `scheduled_start_at` tương lai. Backend lưu request `submitted` cùng
   sự kiện `maintenance.dispatch.requested` trong một transaction.
2. Outbox worker xử lý sự kiện và tìm thợ ngay trong chu kỳ kế tiếp. Không
   cần đợi đến ngày bảo dưỡng hoặc để client gọi dispatch. Khi có lời mời,
   request thành `offered`; chưa có assignment thì lịch chưa được chốt.
3. Thợ xem `GET /api/v1/dispatch/offers`. Offer thuộc thợ chứa loại dịch vụ,
   giờ hẹn, mô tả, địa chỉ/tọa độ để ước lượng công việc. Thợ nhận qua
   `POST /api/v1/dispatch/offers/<offerId>/accept` với body:

   ```json
   { "estimated_duration_minutes": 90 }
   ```

   Lịch tương lai bắt buộc ước lượng từ 15–480 phút. Assignment trả
   `appointment_status: "confirmed"`, `scheduled_start_at`,
   `reservation_start_at` và `reservation_end_at`; rider nhận thông báo
   xác nhận. Retry offer đã nhận trả assignment ban đầu.
4. Reservation giữ 30 phút trước và sau buổi bảo dưỡng. Ví dụ hẹn 10:00,
   dự kiến làm 90 phút thì giữ 09:30–12:00. Không nhận các khung giờ chồng
   nhau; khoảng kết thúc đúng bằng khoảng bắt đầu kế tiếp được phép.
   Lịch tương lai tách khỏi việc hiện tại, nên thợ có thể nhận việc khác
   không trùng. Việc tức thời mặc định 120 phút, hoặc dùng ước lượng được gửi.
5. Dispatch worker gửi nhắc chuẩn bị một lần cho cả khách và thợ khi vào
   khoảng 30 phút trước giờ hẹn. Thợ chỉ chuyển `en_route` sau khi khách
   duyệt giá công, vào khoảng chuẩn bị và không còn việc hiện tại.
   Khi đó `activated_at` được ghi và `appointment_status` thành `active`.

Lịch vẫn dùng điều kiện thợ được duyệt, available, kỹ năng, bán kính và vị
trí mới của dispatch hiện có. Công việc quá thời lượng ước tính vẫn chặn
kích hoạt lịch tiếp theo. Không tự hủy hay phân công lại lịch đã xác nhận.
Tìm thợ hết các vòng cho phép chuyển sang `manual_escalation` và thông báo
khách rằng lịch chưa được xác nhận. Hủy trước khi có assignment thu hồi
offer và thông báo các thợ đang được mời; sau nhận việc dùng chính sách
hủy/recovery hiện có, không thêm hoàn tiền hoặc đổi lịch đã chốt.

## Reminder và inbox

Mỗi rule đến hạn được xử lý riêng trong một transaction: occurrence,
notification inbox, outbox gửi push và lịch nhắc kỳ tiếp theo cùng commit.
Rule lỗi rollback và có thể retry; rule khác vẫn được xử lý. `queued` là
đã lưu inbox; bộ đếm `sent` cũ luôn bằng 0 và không chứng minh push thành công.
`last_processed_at` là mốc xử lý reminder; `last_completed_at` giữ tương
thích cùng nghĩa đó, không phải ngày hoàn thành bảo dưỡng.

Inbox/push giữ các UUID điều hướng hợp lệ: `reminder_id`,
`reminder_context_id`, `motorcycle_id`, `request_id`, `assignment_id`,
`quote_id`, `candidate_id`, `payment_order_id` và `notification_id`.
Rider tạo request từ reminder với hai reference reminder, xe và tọa độ;
có thể thêm giờ hẹn tương lai hoặc yêu cầu phục vụ ngay. Occurrence chỉ
thành `dismissed` khi request được tạo thành công. Hoàn thành dịch vụ
không thay đổi lịch lặp theo ngày đã đặt.

Đổi lịch nhắc xóa snooze cũ. Snooze phải muộn hơn thời điểm hiệu lực hiện
tại và thời gian hiện tại. Archive xe tắt rule; worker cũng kiểm tra xe
và tài khoản hoạt động. Inbox vẫn tồn tại khi không có thiết bị push.

Thông báo nghiệp vụ gồm offer bảo dưỡng, xác nhận nhận việc, chuẩn bị,
đang đi, hủy, báo giá/quyết định, thanh toán đã xác minh và hoàn tất.
Trạng thái đọc inbox độc lập với trạng thái gửi thiết bị.

## Workers và migration

Áp dụng và kiểm chứng migration 001–035 trên môi trường development trước
khi chạy backend mới. Migration 035 thêm reservation/khóa chống trùng,
phân biệt việc hiện tại, lease của receipt và quy tắc reminder/địa điểm.
Chưa áp dụng migration hoặc thay đổi database trong lần triển khai code này.

Chạy API, cấu hình `INTERNAL_WORKER_SECRET` và `WORKER_API_BASE_URL`, rồi:

```powershell
pnpm.cmd run workers:payments:watch
```

Runner gọi reminders, outbox và dispatch bằng các vòng lặp độc lập, mỗi
route không chạy chồng lên chính nó. Reconcile payment chạy khi enabled.
Mỗi vòng chờ 30 giây sau khi hoàn tất. Worker secret chỉ nằm ở backend.
FCM cần đủ ba biến FCM và `PUSH_TOKEN_ENCRYPTION_KEY` base64 32 byte;
readiness phát hiện cấu hình thiếu/sai. Thiếu thiết bị vẫn xử lý inbox.

Outbox claim từng event, gia hạn lease, mỗi lần chạy có định danh riêng.
Receipt có lease/token riêng và không cho worker cũ ghi đè kết quả cuối.
FCM detail có type đúng được ưu tiên để vô hiệu token hỏng đúng phiên bản;
429/503 tôn trọng `Retry-After`, quota chờ tối thiểu 60 giây. Gửi push có
thể lặp nếu tiến trình chết sau khi provider nhận nhưng trước khi DB commit;
client dùng `notification_id` để gộp cùng thông báo.

## Sửa dữ liệu cũ

Admin đọc `/api/v1/admin/operations/dispatch-stuck`: request bảo dưỡng
`submitted` thiếu tọa độ có `reason_code: "missing_location"`. Chủ sở hữu
có thể PATCH `/api/v1/service-requests/<requestId>` với tọa độ thật và key
idempotency; chỉ cho sửa trước khi có dispatch round/assignment. Cùng key
và payload replay trả kết quả cũ; payload khác bị từ chối. Sửa thành công
phát sự kiện tìm thợ mới. Không tự đoán tọa độ hoặc hồi sinh request đã hủy.

Occurrence cũ bị đánh dấu gửi nhưng chưa có notification được sửa theo
UUID lựa chọn rõ ràng, mặc định chỉ preview:

```powershell
node apps/api/scripts/repair-reminder-notifications.mjs --ids=<occurrence-uuid>
node apps/api/scripts/repair-reminder-notifications.mjs --ids=<occurrence-uuid> --execute
```

Tối đa 100 ID/lần. Bỏ qua occurrence chưa đến hạn, đã có notification,
đã dismissed/được request dùng, xe archive hoặc user không hoạt động.
Thao tác ghi khóa rule rồi occurrence, kiểm tra lại điều kiện và tái dùng
dedupe; không thay lịch lặp và không replay toàn bộ outbox cũ.

## Kiểm chứng

API unit/static/route: 168 file, 564 test đạt. Bao phủ inbox reminder,
rollback từng rule, snooze/archive, FCM, retry/lease, tạo lịch/tìm thợ,
chống trùng, kích hoạt, nhắc chuẩn bị, hủy và tìm thợ thất bại; giữ các test
báo giá/thanh toán bảo dưỡng và cứu hộ. Test dùng provider giả.
`pnpm.cmd run typecheck`, `pnpm.cmd run lint` và `pnpm.cmd run build` đạt;
build toàn workspace chạy các app có build script (API và web).

Đã thêm PostgreSQL integration cho concurrent accept/exclusion và receipt
fencing. Chưa chạy do `TEST_DATABASE_URL` hiện không tách khỏi DB ứng dụng;
cần DB test riêng được xác nhận rồi chạy `pnpm.cmd run test:db`.
Chưa kiểm tra push trên thiết bị hoặc kết nối UI.
