# Workflow bảo dưỡng và thanh toán sau khi làm xong

Áp dụng cho yêu cầu mới `service_type: periodic_maintenance`. Chỉ thay đổi
backend/API; mobile và web giữ nguyên. Thanh toán dùng payOS/VietQR, không
có đặt cọc hoặc lựa chọn trả trước cho luồng bảo dưỡng mới.

## Thứ tự nghiệp vụ

1. Khách chọn xe, lịch và địa điểm bảo dưỡng; backend tìm thợ phù hợp.
2. Thợ nhận việc, báo từng khoản công/gói bảo dưỡng và phí đi lại nếu có.
   Khách duyệt trước khi thợ đi. Backend tính tổng và khóa giá đã duyệt.
3. Thợ đến, kiểm tra xe, báo phụ tùng/vật tư. Khách duyệt phạm vi công việc
   trước khi bắt đầu. Không thay phụ tùng chưa được duyệt.
4. Nếu đang làm cần thêm hạng mục, thợ báo phần bổ sung dựa trên báo giá đã
   duyệt. Backend giữ các dòng cũ và cộng các dòng mới. Khách đồng ý mới làm
   phần bổ sung; từ chối thì giữ phạm vi cũ và vẫn giữ thợ hiện tại.
5. Thợ gửi checklist và tóm tắt công việc, báo đã làm xong. Khách đọc checklist
   và thanh toán tổng công + vật tư + các phát sinh đã duyệt.
6. Webhook có chữ ký hoặc worker đối soát xác nhận tiền. Chỉ khi đã trả đủ,
   thợ mới chuyển việc sang `completed`. Nhận tiền không tự đóng việc.

## Trạng thái assignment

| Giai đoạn | Assignment | Service request |
| --- | --- | --- |
| Thợ nhận việc | `accepted` | `assigned` |
| Chờ duyệt công | `quoted` | `awaiting_quote_approval` |
| Đã duyệt công | `accepted` | `assigned` |
| Đang đi | `en_route` | `mechanic_en_route` |
| Tới nơi | `on_site` | `in_service` |
| Kiểm tra xe | `diagnosis` | `in_service` |
| Chờ duyệt vật tư/phạm vi đầu tiên | `quoted` | `awaiting_quote_approval` |
| Đã duyệt phạm vi | `diagnosis` | `in_service` |
| Đang làm, kể cả chờ quyết định phát sinh | `in_progress` | `in_service` |
| Làm xong, chờ tiền | `awaiting_payment` | `awaiting_payment` |
| Đã trả đủ và thợ đóng việc | `completed` | `completed` |

Từ chối báo giá công hoặc vật tư ban đầu giữ trạng thái `quoted`: thợ có thể
gửi bản mới để khách duyệt. Chưa duyệt thì không được đi/bắt đầu. Từ chối
phát sinh trong lúc đang làm giữ `in_progress` và phần giá đã duyệt trước đó.

## API từng bước

Các API dùng `Authorization: Bearer <Supabase JWT>` của đúng khách/thợ.
Tạo request, gửi checklist và tạo payment order cần `X-Idempotency-Key` mới
từ 8–200 ký tự. Retry cùng thao tác dùng lại key và payload ban đầu.

### 1. Đặt bảo dưỡng và thợ nhận việc

Khách gọi `POST /api/v1/service-requests`:

```json
{
  "motorcycle_id": "<motorcycleId-cua-khach>",
  "service_type": "periodic_maintenance",
  "fulfillment_mode": "scheduled_visit",
  "problem_description": "Bảo dưỡng định kỳ, kiểm tra dầu và lọc gió",
  "scheduled_start_at": "<thoi-diem-tuong-lai-ISO-8601>",
  "location": {"latitude": 10.7770, "longitude": 106.7010},
  "address_text": "<dia-chi-bao-duong>"
}
```

Khách gọi `POST /api/v1/service-requests/<requestId>/dispatch` khi yêu cầu còn
`submitted` và chưa được worker tìm thợ. Thợ có kỹ năng
`periodic_maintenance`, profile active, available, vị trí mới và không có
việc active lấy offer từ `GET /api/v1/dispatch/offers`, rồi gọi
`POST /api/v1/dispatch/offers/<offerId>/accept` với
`{"estimated_duration_minutes":60}` để giữ khung giờ dự kiến. Lưu
`assignmentId`. Đây là phần đặt lịch đang được bổ sung cùng migration 035;
áp dụng migration đó trước khi dùng API giữ lịch mới.

### 2. Báo công trước khi đi

Thợ gọi `POST /api/v1/service-requests/<requestId>/quotes`:

```json
{
  "assignment_id": "<assignmentId>",
  "purpose": "maintenance_labor",
  "lines": [
    {"line_type": "labor", "description": "Công bảo dưỡng", "quantity": 1, "unit_amount": 100000},
    {"line_type": "other", "description": "Phí đi lại", "quantity": 1, "unit_amount": 20000}
  ]
}
```

Phải có tiền công dương. Chưa được gửi `part`, `diagnosis_id` hoặc
`labor_pricing` cứu hộ; `discount_amount` phải bằng 0. Backend trả tổng
120.000đ. Khách gọi `POST /api/v1/quotes/<laborQuoteId>/approve` với `{}`;
không gửi `payment_timing`. Giá này được lưu thành
`maintenance_labor_quote_id` trên assignment và không sửa được sau duyệt.

Thợ gọi `POST /api/v1/assignments/<assignmentId>/status` lần lượt với
`{"status":"en_route"}`, `{"status":"on_site"}`, `{"status":"diagnosis"}`.
Nếu chưa duyệt công, bước `en_route` trả 409. Chưa thu tiền ở giai đoạn này.
Với lịch hẹn được giữ riêng, chỉ bắt đầu di chuyển từ khoảng đệm 30 phút
trước giờ hẹn và khi thợ không còn công việc hiện tại.

### 3. Duyệt vật tư rồi bắt đầu

Thợ gọi API tạo quote với:

```json
{
  "assignment_id": "<assignmentId>",
  "purpose": "maintenance_work",
  "lines": [
    {"line_type": "part", "description": "Dầu động cơ", "quantity": 1, "unit_amount": 120000},
    {"line_type": "part", "description": "Lọc gió", "quantity": 1, "unit_amount": 50000}
  ]
}
```

Chỉ gửi vật tư mới; backend thêm công/phí đi lại đã chốt. Tổng báo giá là
290.000đ. Nếu không có vật tư, gửi `lines: []` và vẫn cần khách duyệt phạm vi.

Khách gọi `/quotes/<workQuoteId>/approve` với `{}`; thợ chuyển
`{"status":"in_progress"}`. Khi chưa duyệt hoặc cố thu tiền trước khi làm
xong, backend trả 409. Có thể gắn `diagnosis_id` hợp lệ của assignment khi
báo vật tư; chẩn đoán không tự mở quyền làm/thanh toán.

### 4. Phát sinh trong khi đang làm

Thợ tạo quote mới, tham chiếu **bản `maintenance_work` đã duyệt gần nhất**:

```json
{
  "assignment_id": "<assignmentId>",
  "purpose": "maintenance_work",
  "basis_quote_id": "<latestApprovedWorkQuoteId>",
  "lines": [
    {"line_type": "part", "description": "Bugi bổ sung", "quantity": 1, "unit_amount": 40000},
    {"line_type": "labor", "description": "Công vệ sinh bổ sung", "quantity": 1, "unit_amount": 30000}
  ]
}
```

Chỉ gửi phần thêm, không gửi lại dòng cũ. Backend giữ nguyên công/vật tư cũ,
cộng 70.000đ thành báo giá tổng 360.000đ. `basis_quote_id` cũ hoặc không đúng
assignment bị chặn. Được thêm `labor`, `part`, `other` với tổng bổ sung dương.

Khách gọi `/quotes/<additionQuoteId>/approve` hoặc `/reject` với `{}`.
Chỉ bản pending mới nhất có thể được quyết định; báo giá hết hạn không được
duyệt. Bản pending mới thay bản pending trước bằng `superseded`.

Khi phát sinh còn pending, chưa được chuyển `awaiting_payment`. Phần cũ đã
duyệt vẫn được làm; không làm phần phát sinh trước khi khách đồng ý. Sau từ
chối, `payment-summary.quote_id` vẫn là bản đã duyệt trước đó, ví dụ tổng
290.000đ, không tính 70.000đ bị từ chối. Lần báo bổ sung sau tiếp tục lấy
`basis_quote_id` từ bản đã duyệt, không lấy bản bị từ chối.

### 5. Checklist và báo làm xong

Thợ gọi `POST /api/v1/assignments/<assignmentId>/completion-checklist`:

```json
{
  "work_summary": "Đã thực hiện các hạng mục bảo dưỡng được khách duyệt.",
  "safety_checklist": {
    "test_ride_completed": true,
    "tools_removed": true,
    "area_safe": true,
    "rider_briefed": true,
    "no_fluid_leak": true
  }
}
```

Các cờ phải phản ánh công việc thực tế. Backend tự gắn `approved_quote_id`
của phạm vi đã duyệt; client không được tự chọn giá liên kết checklist.
Khách, thợ được gán và admin đọc bản mới nhất qua **GET cùng URL**.

Sau đó thợ gửi status `{"status":"awaiting_payment"}`. Phải có checklist
gắn đúng quote đã duyệt gần nhất. Nếu gửi checklist rồi khách duyệt thêm
phát sinh, thợ cần hoàn thành phần đó và gửi revision checklist mới với
idempotency key mới. Gửi checklist không tự thay trạng thái assignment.

### 6. Thu tiền và hoàn tất

Đọc `GET /api/v1/service-requests/<requestId>/payment-summary`:

```json
{
  "quote_id": "<latestApprovedWorkQuoteId>",
  "payment_timing": "after_service",
  "labor_amount": 100000,
  "parts_amount": 170000,
  "other_amount": 20000,
  "total_amount": 290000,
  "paid_amount": 0,
  "remaining_amount": 290000,
  "assignment_status": "awaiting_payment"
}
```

Đây là phần trích response. `pending_quote_id` xuất hiện nếu đang có báo giá
mới chờ duyệt. Tổng đã chốt chỉ gồm các khoản được chấp thuận.

Khách tạo `POST /api/v1/payments/orders` với
`{"quote_id":"<payment-summary.quote_id>"}` và key idempotency mới. Dùng
`checkout_url`/QR để thanh toán `remaining_amount`; không dùng ID của báo giá
pending/bị từ chối. Backend giữ cơ chế chống thu lặp và đối soát hiện có.

Đọc `GET /api/v1/payments/orders/<paymentOrderId>` đến `succeeded`; summary
phải còn 0đ. Thợ mới gửi `{"status":"completed"}`. Thiếu tiền, pending hoặc
`needs_review` chưa đủ điều kiện đóng việc. Không coi query trên return URL
là bằng chứng thanh toán. Xem [PAYMENT-SETUP.md](PAYMENT-SETUP.md) để cấu hình
webhook/worker và xử lý review.

## Migration và tương thích

- Áp dụng 001–034 trước khi chạy backend này. Migration
  `202606250034_maintenance_quote_payment_workflow.sql` bổ sung purpose,
  khóa công bảo dưỡng và liên kết quote của checklist; không xóa dữ liệu cũ.
- Đơn bảo dưỡng cũ đã có báo giá `standard` tiếp tục thanh toán trước khi
  làm; không tự chuyển nghĩa của khoản đã thu. Đơn mới phải dùng purpose
  bảo dưỡng. Nếu có việc cũ đã đi nhưng chưa có báo giá tiêu chuẩn, cần rà
  soát/kết thúc theo vận hành, không gán thỏa thuận mới bằng cách sửa DB.
- Cứu hộ giữ hai lựa chọn đã có; dịch vụ `standard` khác giữ điều kiện trả
  trước. Không bổ sung hoàn tiền, tiền mặt, payout hoặc UI trong thay đổi này.
- Notification inbox/outbox có báo giá, báo làm xong, thanh toán và hoàn tất.
  Push thiết bị vẫn phụ thuộc cấu hình FCM và token thiết bị.
- `pnpm.cmd test` kiểm tra provider giả; `pnpm.cmd run test:db` cần project
  test riêng, khác DB app. Tests bao phủ công cố định, phát sinh, từ chối,
  checklist, trả sau, thu lặp, ownership và tương thích đơn cũ.
