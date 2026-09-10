# Hướng dẫn kiểm thử thủ công toàn bộ CareOnRoad Backend MVP
## tiep tuc 16
Tài liệu này hướng dẫn kiểm thử trực tiếp bằng Supabase Dashboard, Postman và
trình duyệt. Đây không phải test tự động và không yêu cầu viết thêm code.

Phạm vi hiện có:

- Patch 1-5: đã triển khai.
- Feature 005/payment: đã triển khai backend-only payOS/VietQR API, migration
  `202606250020_payments.sql`, signed webhook và worker reconcile.
- Patch 7A, 7B, 8 và 9: đã triển khai.

> Không đưa access token, service-role key, database URL hoặc worker secret thật
> vào tài liệu, ảnh chụp màn hình, Git, log hoặc collection Postman được chia sẻ.

## BẮT ĐẦU Ở ĐÂY — Quy trình tuần tự từ Bước 1

Phần này là đường chạy chính. Thực hiện đúng thứ tự và không chuyển sang bước
tiếp theo nếu kết quả hiện tại chưa đạt. Các phần phía sau cung cấp request body,
SQL và giải thích chi tiết cho từng bước.

### Quy tắc thao tác Postman dùng cho mọi bước

Mỗi khi tài liệu yêu cầu gửi một API request:

1. Trong Postman, bấm **New**.
2. Chọn **HTTP**.
3. Chọn đúng method ở bên trái URL: `GET`, `POST`, `PUT`, `PATCH` hoặc
   `DELETE`.
4. Nhập URL có dạng `{{BASE_URL}}/api/...`.
5. Với API của rider/mechanic:
   - mở tab **Authorization**;
   - chọn **Bearer Token**;
   - nhập biến tương ứng, ví dụ `{{RIDER_1_TOKEN}}`.
6. Với request JSON:
   - mở tab **Body**;
   - chọn **raw**;
   - chọn loại **JSON**;
   - dán đúng body trong hướng dẫn.
7. Với service-request creation:
   - mở tab **Headers**;
   - thêm `X-Idempotency-Key`;
   - nhập đúng key được hướng dẫn.
8. Bấm **Send**.
9. Kiểm tra ba thứ:
   - HTTP status ở góc response;
   - JSON body;
   - resource state trong database nếu bước đó yêu cầu.
10. Nếu cần lưu ID:
    - copy giá trị `id` hoặc `session_id` từ response;
    - mở **Environments**;
    - dán vào cột **Current value** của biến tương ứng;
    - bấm **Save**.

Không thêm Postman test script. Toàn bộ việc kiểm tra và lưu ID trong tài liệu
này được thực hiện thủ công.

### Phiếu giá trị phải điền trong lúc test

Copy bảng này sang note cá nhân hoặc điền vào Postman Environment:

| Biến | Giá trị sau khi hoàn thành bước |
|---|---|
| `BASE_URL` | `http://localhost:3000` |
| `RIDER_1_ID` | Chưa có |
| `RIDER_2_ID` | Chưa có |
| `MECHANIC_1_ID` | Chưa có |
| `MECHANIC_2_ID` | Chưa có |
| `MOTORCYCLE_ID` | Chưa có |
| `REQUEST_ID` | Chưa có |
| `OFFER_1_ID` | Chưa có |
| `OFFER_2_ID` | Chưa có |
| `ASSIGNMENT_ID` | Chưa có |
| `DIAGNOSIS_ID` | Chưa có |
| `QUOTE_1_ID` | Chưa có |
| `QUOTE_2_ID` | Chưa có |
| `REMINDER_ID` | Chưa có |
| `REMINDER_OCCURRENCE_ID` | Chưa có |
| `CHATBOT_SESSION_ID` | Chưa có |

### Bước 1 — Xác nhận đang dùng môi trường test/dev

1. Mở Supabase Dashboard.
2. Nhìn tên organization và project ở góc trên.
3. Xác nhận đây là project test/dev, không phải production.
4. Mở **Project Settings → Database**.
5. Chỉ lấy connection information để cấu hình local; không dán nó vào tài liệu.
6. Mở **Authentication → Users** và xác nhận có thể tạo user test.

Đạt khi:

- Chắc chắn database có thể reset mà không ảnh hưởng dữ liệu thật.
- Không có user/customer thật trong phạm vi test.

### Bước 2 — Xác nhận migration 001-020

1. Mở thư mục repository bằng File Explorer.
2. Đi tới `supabase/migrations`.
3. Sắp xếp file theo tên.
4. Xác nhận file cuối là
   `202606250020_payments.sql`.
5. Xác nhận payment migration đứng sau assignment checklist migration.
6. Trong PowerShell, kiểm tra và apply migration:

```powershell
npx.cmd supabase migration list
npx.cmd supabase db push --dry-run
npx.cmd supabase db push
```

7. Mở **Supabase Dashboard → SQL Editor → New query**.
8. Chạy câu kiểm tra RLS tại mục [3.1](#31-kiểm-tra-migration).
9. Xác nhận các bảng ứng dụng có `rowsecurity = true`.

Không tiếp tục nếu migration 019 chưa được apply.

### Bước 3 — Cấu hình `.env.local`

1. Mở file `.env.local` ở root repository.
2. Điền các biến được liệt kê tại mục [3.2](#32-cấu-hình-backend).
3. Đặt:

```env
CHATBOT_PERSISTENCE_MODE=postgres
```

4. Đảm bảo `INTERNAL_WORKER_SECRET` có một giá trị test riêng.
5. Nếu cần nạp bộ mock data có sẵn, đặt thêm:

```env
SUPABASE_SERVICE_ROLE_KEY=<backend-only-service-role-key>
SEED_USER_PASSWORD=<shared-password-for-seeded-test-users>
```

6. Không đặt secret nào với tiền tố `NEXT_PUBLIC_`.
7. Save file.

Đạt khi:

- Có database connection.
- Có Supabase issuer/audience/JWKS.
- Có worker secret.
- Chatbot đang ở PostgreSQL mode.

#### Tùy chọn — Nạp nhanh mock data hoàn chỉnh

Chỉ dùng tùy chọn này trên project test/dev. Không dùng nếu mục tiêu là kiểm
thử một database hoàn toàn sạch hoặc chạy tuần tự chính xác các bước tạo fixture
bên dưới.

Sau khi migration 001-020 đã được apply:

```powershell
npm.cmd run seed:mock
npm.cmd run seed:mock:verify
```

Script tạo hoặc cập nhật `rider1@gmail.com`, `rider2@gmail.com`,
`mechanic1@gmail.com`, `mechanic2@gmail.com`, rồi upsert motorcycle, service
request, dispatch, assignment, quote, reminder, notification và chatbot
fixtures. Cả bốn Auth user dùng `SEED_USER_PASSWORD`; chạy seed lại sẽ đặt lại
mật khẩu của bốn tài khoản này.

Không commit hoặc ghi vào tài liệu giá trị `DATABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `SEED_USER_PASSWORD` hay nội dung `.env.local`.

### Bước 4 — Chạy backend

1. Mở PowerShell.
2. Chuyển tới:

```powershell
cd D:\fpt\subject\EXE101\CareOnRoad-Application
```

3. Chạy:

```powershell
npm.cmd install
npm.cmd run dev
```

4. Chờ dòng báo server ready.
5. Mở `http://localhost:3000`.
6. Xác nhận trang chatbot hiển thị và không có lỗi 500.
7. Giữ cửa sổ PowerShell này chạy trong toàn bộ quá trình test.

### Bước 5 — Tạo Postman Environment

1. Mở Postman.
2. Bấm **Environments** ở thanh bên trái.
3. Bấm dấu `+`.
4. Đặt tên: `CareOnRoad Manual Local`.
5. Tạo toàn bộ biến tại mục [4.2](#42-biến-postman-nên-tạo).
6. Với `BASE_URL`, nhập:

```text
http://localhost:3000
```

7. Với `WORKER_SECRET`, nhập cùng giá trị
   `INTERNAL_WORKER_SECRET` trong `.env.local`.
8. Bấm **Save**.
9. Ở góc trên bên phải Postman, chọn environment
   `CareOnRoad Manual Local`.

Đạt khi nhập `{{BASE_URL}}` trong một request và Postman hiển thị giá trị đã
resolve.

### Bước 6 — Tạo bốn Supabase Auth user

1. Trong Supabase Dashboard, mở **Authentication → Users**.
2. Bấm **Add user → Create new user**.
3. Tạo Rider 1 bằng email test thứ nhất.
4. Bật tùy chọn xác nhận email nếu Dashboard yêu cầu.
5. Tạo Rider 2 bằng email test thứ hai.
6. Tạo Mechanic 1 bằng email test thứ ba.
7. Tạo Mechanic 2 bằng email test thứ tư.
8. Ghi email/password vào nơi riêng tư, không ghi vào file Markdown.

Đạt khi danh sách Authentication có đủ bốn user.

### Bước 7 — Lấy bốn access token

Thực hiện quy trình mục [4.1](#41-lấy-access-token) bốn lần:

1. Gửi email/password Rider 1.
2. Copy `access_token` vào `RIDER_1_TOKEN`.
3. Gửi email/password Rider 2.
4. Copy `access_token` vào `RIDER_2_TOKEN`.
5. Gửi email/password Mechanic 1.
6. Copy `access_token` vào `MECHANIC_1_TOKEN`.
7. Gửi email/password Mechanic 2.
8. Copy `access_token` vào `MECHANIC_2_TOKEN`.
9. Save Postman Environment.

Không copy `refresh_token` nếu không cần.

### Bước 8 — Test 401 trước khi bootstrap

1. Tạo request `GET {{BASE_URL}}/api/v1/auth/me`.
2. Chọn Authorization **No Auth**.
3. Bấm Send.
4. Xác nhận HTTP `401`.
5. Xác nhận response có `error_code`.

Nếu nhận `200`, request đang vô tình kế thừa token từ collection; xóa
Authorization kế thừa rồi thử lại.

### Bước 9 — Bootstrap bốn application profile

Thực hiện mục [5.2](#52-bootstrap-bốn-profile) cho từng user:

1. Bootstrap Rider 1.
2. Copy response `id` vào `RIDER_1_ID`.
3. Bootstrap Rider 2.
4. Copy response `id` vào `RIDER_2_ID`.
5. Bootstrap Mechanic 1.
6. Copy response `id` vào `MECHANIC_1_ID`.
7. Bootstrap Mechanic 2.
8. Copy response `id` vào `MECHANIC_2_ID`.
9. Save environment.
10. Gọi lại bootstrap Rider 1.
11. Xác nhận ID không đổi và database không có profile trùng.

### Bước 10 — Test current actor và device

1. Gọi `GET /api/v1/auth/me` bằng Rider 1 token.
2. Xác nhận `id = {{RIDER_1_ID}}`.
3. Gọi `POST /api/v1/auth/devices` theo mục
   [5.4](#54-đăng-ký-device).
4. Mở SQL Editor.
5. Kiểm tra `user_devices.device_key_hash`.
6. Xác nhận raw device key không được lưu.
7. Kiểm tra audit/outbox của profile và device.

### Bước 11 — Seed hai mechanic

1. Mở SQL Editor.
2. Copy SQL tại mục [6](#6-seed-roleprofile-mechanic).
3. Thay đủ bốn placeholder mechanic ID.
4. Chạy query.
5. Chạy:

```sql
select u.id, r.role, p.profile_status, p.is_available
from app_users u
join user_roles r on r.user_id = u.id
left join mechanic_profiles p on p.user_id = u.id
where u.id in ('<MECHANIC_1_ID>', '<MECHANIC_2_ID>')
order by u.id, r.role;
```

6. Xác nhận mỗi mechanic có role `mechanic`.
7. Xác nhận mỗi mechanic có profile `active`.

### Bước 12 — Tạo motorcycle

1. Gửi request tại mục [7.1](#71-tạo-motorcycle).
2. Xác nhận HTTP `201`.
3. Copy response `id` vào `MOTORCYCLE_ID`.
4. Save environment.
5. Gọi list và read theo mục [7.2](#72-listreadupdate-motorcycle).
6. Dùng Rider 2 test ownership theo mục [7.3](#73-test-ownership).
7. Chỉ tiếp tục khi Rider 2 nhận `403`.

Không archive motorcycle này vì các bước sau còn dùng nó.

### Bước 13 — Cấu hình Mechanic 1 và Mechanic 2

Với Mechanic 1:

1. GET mechanic profile.
2. PATCH skill/radius.
3. PUT availability thành `true`.
4. PUT location.

Lặp lại bốn thao tác cho Mechanic 2.

Sau đó mở SQL Editor:

```sql
select
  p.user_id,
  p.profile_status,
  p.is_available,
  p.service_radius_km,
  p.location_updated_at,
  array_agg(s.service_type order by s.service_type) as skills
from mechanic_profiles p
left join mechanic_skills s on s.mechanic_id = p.user_id
where p.user_id in ('<MECHANIC_1_ID>', '<MECHANIC_2_ID>')
group by p.user_id
order by p.user_id;
```

Đạt khi:

- Cả hai profile `active`.
- `is_available = true`.
- Có skill `mobile_repair`.
- `location_updated_at` vừa được cập nhật.

### Bước 14 — Tạo service request chính

1. Gửi request ở mục [8.2](#82-tạo-mobile-repair-request).
2. Dùng idempotency key chính xác:

```text
manual-mobile-request-001
```

3. Xác nhận HTTP `201`.
4. Copy `id` vào `REQUEST_ID`.
5. Save environment.
6. Xác nhận `status = submitted`.
7. Xác nhận `request_code` bắt đầu bằng `COR-MOB-`.

### Bước 15 — Test idempotency trước khi dispatch

1. Không thay body.
2. Không thay idempotency key.
3. Bấm Send lần hai.
4. Xác nhận trả cùng request ID.
5. Đổi riêng `problem_description`.
6. Giữ nguyên key.
7. Bấm Send.
8. Xác nhận HTTP `409`.
9. Đổi body lại như cũ để tránh dùng nhầm ở bước sau.

### Bước 16 — Test ownership và media

1. Rider 1 GET request thành công.
2. Rider 2 GET cùng request nhận `403`.
3. Rider 1 POST media metadata theo mục
   [8.5](#85-thêm-media-metadata).
4. Xác nhận HTTP `201`.
5. Kiểm tra database chỉ có metadata, không có raw file.

### Bước 17 — Tạo request phụ và test cancel

1. Copy request tạo service request chính.
2. Đổi idempotency key thành `manual-cancel-request-001`.
3. Có thể giữ cùng motorcycle và vị trí.
4. Gửi request.
5. Copy ID ra note tạm, không ghi đè `REQUEST_ID`.
6. Gọi cancel theo mục [8.6](#86-test-cancel-bằng-một-request-riêng).
7. Xác nhận status thành `canceled`.
8. Gọi cancel lần hai.
9. Xác nhận conflict.

### Bước 18 — Refresh location và bắt đầu dispatch

1. Gọi lại PUT location của cả hai mechanic để tránh quá 300 giây.
2. Ngay lập tức gọi dispatch tại mục [9.1](#91-bắt-đầu-dispatch).
3. Xác nhận HTTP `202`.
4. Xác nhận `round_number = 1`.
5. Xác nhận response có candidate.
6. Nếu không có candidate:
   - kiểm tra skill;
   - kiểm tra `is_available`;
   - kiểm tra fresh location;
   - kiểm tra tọa độ/radius;
   - không tiếp tục cho tới khi có candidate.

### Bước 19 — Lấy hai offer ID

1. GET offers bằng Mechanic 1.
2. Tìm item có `request_id = {{REQUEST_ID}}`.
3. Copy item `id` vào `OFFER_1_ID`.
4. GET offers bằng Mechanic 2.
5. Tìm item cùng request.
6. Copy `id` vào `OFFER_2_ID`.
7. Save environment.

Nếu một mechanic không có offer, quay lại Bước 13 và Bước 18.

### Bước 20 — Accept assignment và test loser

1. Mechanic 1 gọi accept `OFFER_1_ID`.
2. Xác nhận HTTP `201`.
3. Copy assignment `id` vào `ASSIGNMENT_ID`.
4. Save environment.
5. Mechanic 2 gọi accept `OFFER_2_ID`.
6. Xác nhận HTTP `409`.
7. Chạy SQL invariant tại mục [9.4](#94-accept-offer).
8. Xác nhận đúng một assignment.

### Bước 21 — Chuyển assignment đến diagnosis

Gửi tuần tự, không gửi song song:

1. `accepted → en_route`.
2. Kiểm tra HTTP `200`.
3. `en_route → on_site`.
4. Kiểm tra HTTP `200`.
5. `on_site → diagnosis`.
6. Kiểm tra HTTP `200`.
7. GET assignment list.
8. Xác nhận assignment đang `diagnosis`.
9. GET service request.
10. Xác nhận request đang `in_service`.

### Bước 22 — Tạo diagnosis

1. Gửi request tại mục [10.3](#103-tạo-diagnosis).
2. Xác nhận HTTP `201`.
3. Copy `id` vào `DIAGNOSIS_ID`.
4. Save environment.
5. Kiểm tra audit/outbox không chứa full diagnosis text.

### Bước 23 — Tạo quote version 1

1. Gửi body tại mục [10.4](#104-tạo-quote-version-1).
2. Xác nhận HTTP `201`.
3. Kiểm tra tổng:
   - subtotal `600000`;
   - discount `50000`;
   - total `550000`.
4. Copy `id` vào `QUOTE_1_ID`.
5. Save environment.

### Bước 24 — Tạo quote version 2

1. Copy request quote version 1.
2. Đổi ít nhất một line amount hoặc notes.
3. Gửi lại cùng request endpoint.
4. Xác nhận HTTP `201`.
5. Xác nhận `version = 2`.
6. Copy `id` vào `QUOTE_2_ID`.
7. Save environment.
8. GET quote list và xác nhận quote 1 là `superseded`.

### Bước 25 — Test stale approval và approve latest

1. Rider 1 approve `QUOTE_1_ID`.
2. Xác nhận HTTP `409`.
3. Rider 1 approve `QUOTE_2_ID`.
4. Xác nhận HTTP `200`.
5. GET assignment và request.
6. Xác nhận cả hai ở `awaiting_payment`.
7. Chạy payment flow ở bước tiếp theo.
8. Xác nhận assignment không tự động start trước webhook payment success.

### Bước 26 — Tạo payment order payOS/VietQR

1. Gọi:

```http
POST {{BASE_URL}}/api/v1/payments/orders
Authorization: Bearer {{RIDER_1_TOKEN}}
Content-Type: application/json
X-Idempotency-Key: manual-payment-quote-2-001

{
  "quote_id": "{{QUOTE_2_ID}}"
}
```

2. Xác nhận response có `checkout_url`, `qr_code`, `provider_order_code` và
   status `pending`.
3. Gọi lại cùng idempotency key và body để xác nhận replay không tạo order mới.
4. Chỉ test webhook thật trên payOS test account/số tiền nhỏ; không paste secret
   hoặc raw webhook payload vào tài liệu.

### Bước 27 — Tạo reminder due

1. Lấy thời gian UTC hiện tại.
2. Chọn `next_due_at` sớm hơn hiện tại 1-2 phút.
3. Gửi request tại mục [12.1](#121-tạo-reminder-due-ngay).
4. Xác nhận HTTP `201`.
5. Copy `id` vào `REMINDER_ID`.
6. Save environment.

### Bước 28 — Test reminder worker authority

1. Gọi worker không có secret.
2. Xác nhận `401 UNAUTHORIZED`.
3. Gọi worker chỉ có rider bearer token.
4. Xác nhận vẫn `401`.
5. Gọi worker với `X-Worker-Secret: {{WORKER_SECRET}}`.
6. Xác nhận HTTP `202`.
7. Xác nhận `claimed >= 1`.
8. Gọi lại worker lần hai.
9. Xác nhận không có occurrence trùng.

### Bước 29 — Lấy reminder occurrence ID

1. Mở SQL Editor.
2. Chạy query ở mục [12.5](#125-chạy-reminder-worker).
3. Chọn occurrence mới nhất của `REMINDER_ID`.
4. Copy `id` vào `REMINDER_OCCURRENCE_ID`.
5. Save Postman Environment.

### Bước 30 — Tạo maintenance request từ reminder

1. Gửi request ở mục
   [12.6](#126-tạo-periodic-maintenance-request-từ-occurrence).
2. Không gửi `scheduled_start_at`.
3. Xác nhận HTTP `201`.
4. Xác nhận request có cả `reminder_id` và `reminder_context_id`.
5. Replay cùng key/body.
6. Xác nhận cùng logical request.

### Bước 31 — Tạo notification fixture

1. Mở SQL Editor.
2. Copy transaction tại mục
   [13.2](#132-tạo-notificationoutboxaudit-fixture-atomically).
3. Thay `<RIDER_1_ID>`.
4. Chạy transaction.
5. Xác nhận query báo success.
6. Query `notifications` theo dedupe key.
7. Xác nhận status ban đầu là `pending`.

### Bước 32 — Chạy outbox worker

1. Gọi worker không có/sai secret.
2. Xác nhận `401`.
3. Gọi worker với secret hợp lệ.
4. Xác nhận HTTP `202`.
5. Xác nhận `claimed >= 1` và `processed >= 1`.
6. Chạy ba query tại mục [13.4](#134-chạy-outbox-worker-success).
7. Xác nhận notification `sent`.
8. Xác nhận outbox `processed`.
9. Xác nhận có audit `notification.sent`.
10. Xác nhận không có recursive outbox event cho `notification.sent`.

### Bước 33 — Test lease recovery và audit hardening

1. Tạo notification fixture thứ hai với dedupe key mới.
2. Mô phỏng expired lease theo mục
   [13.5](#135-test-crashlease-recovery).
3. Chạy worker.
4. Xác nhận event được reclaim.
5. Thử update một audit row.
6. Xác nhận PostgreSQL từ chối.
7. Thử delete một audit row.
8. Xác nhận PostgreSQL từ chối.
9. Thử insert prohibited metadata theo mục
   [13.8](#138-test-prohibited-metadata).
10. Xác nhận constraint từ chối.

### Bước 34 — Tạo chatbot session và diagnosis

1. Xác nhận `CHATBOT_PERSISTENCE_MODE=postgres`.
2. POST chatbot session.
3. Copy `session_id` vào `CHATBOT_SESSION_ID`.
4. Save environment.
5. POST text message bình thường.
6. Xác nhận response tiếng Việt, advisory và có VND estimate.
7. GET latest diagnosis.
8. Xác nhận diagnosis giống response vừa nhận.

### Bước 35 — Test chatbot restart persistence

1. Giữ nguyên `CHATBOT_SESSION_ID`.
2. Dừng server bằng `Ctrl+C`.
3. Chạy lại `npm.cmd run dev`.
4. Chờ server ready.
5. GET latest diagnosis bằng session cũ.
6. Xác nhận HTTP `200`.
7. Xác nhận diagnosis vẫn còn.
8. Query ba chatbot table theo mục
   [14.5](#145-test-persistence-qua-restart).

### Bước 36 — Test safety, fallback và ASR

1. Tạo session mới.
2. Gửi câu mất phanh.
3. Xác nhận không cho tiếp tục chạy.
4. Tạm bỏ Gemini/OpenRouter API key.
5. Restart server.
6. Tạo session mới và gửi text.
7. Xác nhận `fallback_used = true` và response vẫn tiếng Việt.
8. Khôi phục API key.
9. Restart server.
10. Gửi file WAV qua transcription endpoint.
11. Xác nhận chỉ trả `transcribed_text`.
12. Xác nhận raw audio không nằm trong database/audit/outbox.

### Bước 37 — Test Patch 9 RLS/index/constraint

1. Chạy migration-sequence query.
2. Chạy index query.
3. Chạy foreign-key query.
4. Chạy policy query.
5. Gọi Supabase REST bằng Rider 1.
6. Xác nhận thấy motorcycle của Rider 1.
7. Gọi lại bằng Rider 2.
8. Xác nhận không thấy motorcycle Rider 1.
9. Chạy production build.
10. Kiểm tra `.next/static` không chứa server-only variable.

### Bước 38 — Sign-off

1. Đi tới mục [19](#19-checklist-sign-off-cuối).
2. Tick từng dòng chỉ khi đã có evidence.
3. Dòng nào fail thì ghi:
   - request đã gửi;
   - HTTP status thực tế;
   - `error_code`;
   - resource ID;
   - SQL state liên quan;
   - thời điểm test.
4. Không ghi token hoặc secret vào bug report.
5. Khi toàn bộ dòng thuộc patch đã triển khai đều pass, manual test hoàn tất.

## 1. Mục tiêu cuối cùng

Sau khi hoàn thành tài liệu này, cần xác nhận được:

1. JWT, profile, role và ownership hoạt động đúng.
2. Rider tạo motorcycle và service request idempotent.
3. Dispatch tìm mechanic đủ điều kiện và chỉ một mechanic nhận được assignment.
4. Mechanic đi qua đúng state, tạo diagnosis và quote version.
5. Rider chỉ quyết định được quote mới nhất.
6. Reminder worker tạo occurrence đúng một lần.
7. Reminder occurrence có thể tạo periodic-maintenance request.
8. Notification/outbox worker xử lý lease, success và recovery.
9. Audit là append-only và từ chối metadata bị cấm.
10. Chatbot lưu session/message/diagnosis vào PostgreSQL và phục hồi sau restart.
11. RLS, index, constraint và secret isolation của Patch 9 tồn tại.
12. Admin operations backend-only cho user, mechanic và service request tồn tại
    nhưng không có admin UI.
13. Mechanic operations backend-only cho dashboard, jobs, performance,
    ETA/delay, field media metadata và completion checklist tồn tại.
14. Có backend-only payment API/table payOS/VietQR; không có frontend payment
    UI, refund, settlement hoặc payout workflow.

## 2. Công cụ cần chuẩn bị

- Supabase Dashboard của project test/dev.
- Postman Desktop.
- PowerShell tại thư mục repository.
- Hai tài khoản mechanic và hai tài khoản rider dùng riêng cho test.
- Một file WAV ngắn nếu muốn test ASR.

Không dùng production database hoặc tài khoản người dùng thật.

## 3. Chuẩn bị môi trường

### 3.1. Kiểm tra migration

Trong `supabase/migrations`, thứ tự hiện tại phải kết thúc bằng:

```text
202606250015_admin_foundation.sql
202606250016_admin_mechanic_management.sql
202606250017_assignment_eta_metadata.sql
202606250018_assignment_media_metadata.sql
202606250019_assignment_completion_checklists.sql
202606250020_payments.sql
```

Không được có:

```text
202606250015_indexes_constraints_rls.sql
payments.sql
```

Áp dụng migration 001-020 vào database test/dev trước khi chạy ứng dụng.

Sau khi apply, mở Supabase SQL Editor và chạy:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

Kết quả mong đợi:

- Các bảng ứng dụng đều có `rowsecurity = true`.
- Có các bảng `app_users`, `motorcycles`, `service_requests`,
  `dispatch_candidates`, `assignments`, `mechanic_diagnoses`, `quotes`,
  `reminder_rules`, `reminder_occurrences`, `notifications`, `outbox_events`,
  `audit_logs`, `chatbot_sessions`, `chatbot_messages` và
  `diagnosis_results`.
- Có các bảng admin/mechanic operations `admin_internal_notes`,
  `assignment_eta_metadata`, `assignment_media_metadata` và
  `assignment_completion_checklists`.
- Không có `payment_orders`, `payment_events` hoặc bảng refund.

### 3.2. Cấu hình backend

Trong `.env.local`, cấu hình các biến backend bằng giá trị của môi trường
test/dev. Không dùng tiền tố `NEXT_PUBLIC_` cho secret:

```env
DATABASE_URL=
SUPABASE_URL=
SUPABASE_JWT_ISSUER=
SUPABASE_JWT_AUDIENCE=authenticated
SUPABASE_JWKS_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SEED_USER_PASSWORD=
INTERNAL_WORKER_SECRET=
CHATBOT_PERSISTENCE_MODE=postgres
```

Các biến Gemini/OpenRouter có thể giữ cấu hình hiện tại. Để test local fallback,
có thể tạm bỏ cả hai API key rồi restart server.

### 3.3. Chạy ứng dụng

```powershell
npm.cmd install
npm.cmd run dev
```

Mặc định dùng:

```text
BASE_URL=http://localhost:3000
```

Mở `http://localhost:3000` và xác nhận trang chatbot hiển thị bình thường.

## 4. Tạo tài khoản test và lấy token

Tạo bốn user trong Supabase Authentication. Có thể tạo thủ công cho clean-flow
hoặc chạy `npm.cmd run seed:mock` cho demo fixture đầy đủ:

| Tài khoản | Email seed mặc định | Mục đích |
|---|---|---|
| Rider 1 | `rider1@gmail.com` | Chủ motorcycle/request/reminder |
| Rider 2 | `rider2@gmail.com` | Test ownership denial |
| Mechanic 1 | `mechanic1@gmail.com` | Nhận offer |
| Mechanic 2 | `mechanic2@gmail.com` | Test cạnh tranh nhận offer |

Nên dùng email dạng test và mật khẩu riêng của môi trường dev.

### 4.1. Lấy access token

Cách đơn giản nhất:

1. Mở Postman.
2. Gửi `POST`:

```text
{{SUPABASE_URL}}/auth/v1/token?grant_type=password
```

Headers:

```text
apikey: {{SUPABASE_PUBLISHABLE_KEY}}
Content-Type: application/json
```

Body:

```json
{
  "email": "<EMAIL_TEST>",
  "password": "<PASSWORD_TEST>"
}
```

Lưu `access_token` của từng tài khoản vào biến Postman:

```text
RIDER_1_TOKEN
RIDER_2_TOKEN
MECHANIC_1_TOKEN
MECHANIC_2_TOKEN
```

Không commit hoặc export các giá trị token này.

### 4.2. Biến Postman nên tạo

```text
BASE_URL
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
RIDER_1_TOKEN
RIDER_2_TOKEN
MECHANIC_1_TOKEN
MECHANIC_2_TOKEN
RIDER_1_ID
RIDER_2_ID
MECHANIC_1_ID
MECHANIC_2_ID
MOTORCYCLE_ID
REQUEST_ID
OFFER_1_ID
OFFER_2_ID
ASSIGNMENT_ID
DIAGNOSIS_ID
QUOTE_1_ID
QUOTE_2_ID
REMINDER_ID
REMINDER_OCCURRENCE_ID
CHATBOT_SESSION_ID
WORKER_SECRET
```

Với API bearer-protected, dùng header:

```text
Authorization: Bearer {{RIDER_1_TOKEN}}
Content-Type: application/json
```

## 5. Patch 1 — Auth, profile, device và transaction foundation

### 5.1. Test thiếu token

Gửi:

```http
GET {{BASE_URL}}/api/v1/auth/me
```

Không gửi `Authorization`.

Kết quả mong đợi:

- HTTP `401`.
- JSON có `error_code`.
- Không trả stack trace hoặc secret.

### 5.2. Bootstrap bốn profile

Thực hiện cho từng access token:

```http
POST {{BASE_URL}}/api/v1/auth/profile
Authorization: Bearer <TOKEN_TƯƠNG_ỨNG>
Content-Type: application/json
```

Body ví dụ Rider 1:

```json
{
  "display_name": "Rider Manual 1"
}
```

Body mechanic có thể dùng:

```json
{
  "display_name": "Mechanic Manual 1"
}
```

Kết quả mong đợi:

- HTTP `200`.
- Có `id`, `roles` và `status`.
- Lần đầu role mặc định là `rider`.
- Gọi lại cùng endpoint không tạo profile trùng.

Lưu các trường `id` thành biến `RIDER_1_ID`, `RIDER_2_ID`,
`MECHANIC_1_ID`, `MECHANIC_2_ID`.

### 5.3. Kiểm tra actor hiện tại

```http
GET {{BASE_URL}}/api/v1/auth/me
Authorization: Bearer {{RIDER_1_TOKEN}}
```

Kết quả mong đợi:

- HTTP `200`.
- `id` bằng `RIDER_1_ID`.
- `status = active`.

### 5.4. Đăng ký device

```http
POST {{BASE_URL}}/api/v1/auth/devices
Authorization: Bearer {{RIDER_1_TOKEN}}
Content-Type: application/json
```

```json
{
  "device_key": "manual-fixture-device-token-rider-1",
  "platform": "android"
}
```

Kết quả mong đợi:

- HTTP `200`.
- Response có `id`, `platform`, `enabled`, `last_registered_at`.
- Response không trả lại `device_key`.

Kiểm tra database:

```sql
select user_id, device_key_hash, platform, enabled
from user_devices
where user_id = '<RIDER_1_ID>';
```

Kết quả mong đợi:

- Chỉ lưu hash, không lưu chuỗi `manual-fixture-device-token-rider-1`.

Kiểm tra atomic audit/outbox:

```sql
select action, entity_type, metadata
from audit_logs
where actor_id = '<RIDER_1_ID>'
order by created_at desc;

select topic, aggregate_type, payload
from outbox_events
where aggregate_id = '<RIDER_1_ID>'
order by created_at desc;
```

## 6. Seed role/profile mechanic

Hiện không có API tạo role hoặc tạo mechanic profile ban đầu. Vì vậy bước này
phải thực hiện thủ công trong Supabase SQL Editor.

Chạy lần lượt cho Mechanic 1 và Mechanic 2:

```sql
insert into user_roles (user_id, role)
values
  ('<MECHANIC_1_ID>', 'mechanic'),
  ('<MECHANIC_2_ID>', 'mechanic')
on conflict do nothing;

insert into mechanic_profiles (
  user_id,
  profile_status,
  is_available,
  service_radius_km,
  availability_updated_at,
  rating_avg,
  rating_count,
  created_at,
  updated_at
)
values
  (
    '<MECHANIC_1_ID>',
    'active',
    false,
    12,
    now(),
    0,
    0,
    now(),
    now()
  ),
  (
    '<MECHANIC_2_ID>',
    'active',
    false,
    12,
    now(),
    0,
    0,
    now(),
    now()
  )
on conflict (user_id) do update
set profile_status = 'active',
    service_radius_km = excluded.service_radius_km,
    updated_at = now();
```

Không dùng SQL Editor để tạo assignment, quote hoặc đổi workflow state trong
happy path. Các bước đó phải đi qua API.

## 7. Patch 2 — Motorcycle và mechanic dispatch profile

### 7.1. Tạo motorcycle

```http
POST {{BASE_URL}}/api/v1/motorcycles
Authorization: Bearer {{RIDER_1_TOKEN}}
Content-Type: application/json
```

```json
{
  "brand_text": "Honda",
  "model_text": "Wave Alpha",
  "license_plate": "59A1-MANUAL",
  "year": 2022,
  "notes": "Xe dùng cho manual test"
}
```

Kết quả mong đợi:

- HTTP `201`.
- Có `id`, `rider_id`, `brand_text`, `model_text`.
- Lưu `id` vào `MOTORCYCLE_ID`.

### 7.2. List/read/update motorcycle

List:

```http
GET {{BASE_URL}}/api/v1/motorcycles
Authorization: Bearer {{RIDER_1_TOKEN}}
```

Read:

```http
GET {{BASE_URL}}/api/v1/motorcycles/{{MOTORCYCLE_ID}}
Authorization: Bearer {{RIDER_1_TOKEN}}
```

Update:

```http
PATCH {{BASE_URL}}/api/v1/motorcycles/{{MOTORCYCLE_ID}}
Authorization: Bearer {{RIDER_1_TOKEN}}
Content-Type: application/json
```

```json
{
  "brand_text": "Honda",
  "model_text": "Wave Alpha Updated",
  "year": 2023
}
```

Kết quả mong đợi: HTTP `200`.

### 7.3. Test ownership

Dùng token Rider 2:

```http
GET {{BASE_URL}}/api/v1/motorcycles/{{MOTORCYCLE_ID}}
Authorization: Bearer {{RIDER_2_TOKEN}}
```

Kết quả mong đợi:

- HTTP `403`.
- `error_code = FORBIDDEN`.

### 7.4. Cấu hình hai mechanic

Thực hiện cho cả hai mechanic.

Đọc profile:

```http
GET {{BASE_URL}}/api/v1/mechanics/me/profile
Authorization: Bearer {{MECHANIC_1_TOKEN}}
```

Update radius và skill:

```http
PATCH {{BASE_URL}}/api/v1/mechanics/me/profile
Authorization: Bearer {{MECHANIC_1_TOKEN}}
Content-Type: application/json
```

```json
{
  "service_radius_km": 12,
  "service_types": ["mobile_repair", "emergency_rescue"]
}
```

Bật availability:

```http
PUT {{BASE_URL}}/api/v1/mechanics/me/availability
Authorization: Bearer {{MECHANIC_1_TOKEN}}
Content-Type: application/json
```

```json
{
  "is_available": true
}
```

Cập nhật vị trí Mechanic 1:

```http
PUT {{BASE_URL}}/api/v1/mechanics/me/location
Authorization: Bearer {{MECHANIC_1_TOKEN}}
Content-Type: application/json
```

```json
{
  "latitude": 10.762622,
  "longitude": 106.660172
}
```

Kết quả mong đợi của location: HTTP `204`.

Cập nhật Mechanic 2 bằng tọa độ gần đó:

```json
{
  "latitude": 10.762900,
  "longitude": 106.660172
}
```

> Phải dispatch trong vòng 300 giây sau bước location. Quá 300 giây, mechanic
> bị xem là stale và không được chọn.

## 8. Patch 3 — Service request, request code, idempotency và media

### 8.1. Ma trận input cần nhớ

| `service_type` | Input bắt buộc chính | Không được gửi |
|---|---|---|
| `emergency_rescue` | `location`, mô tả | `scheduled_start_at` |
| `mobile_repair` | `location` hoặc `address_text`, mô tả | `scheduled_start_at` |
| `at_home_service` | `address_text`, lịch tương lai | `fulfillment_mode` |
| `periodic_maintenance` | lịch tương lai, hoặc reminder hợp lệ ở Patch 7 | `fulfillment_mode` |
| `other` | `fulfillment_mode` và dữ liệu phù hợp mode | Không được thiếu mode |

### 8.2. Tạo mobile-repair request

```http
POST {{BASE_URL}}/api/v1/service-requests
Authorization: Bearer {{RIDER_1_TOKEN}}
X-Idempotency-Key: manual-mobile-request-001
Content-Type: application/json
```

```json
{
  "motorcycle_id": "{{MOTORCYCLE_ID}}",
  "service_type": "mobile_repair",
  "problem_description": "Xe khó đề và đèn yếu",
  "location": {
    "latitude": 10.762622,
    "longitude": 106.660172
  },
  "address_text": "Quận 10, TP.HCM"
}
```

Kết quả mong đợi:

- HTTP `201`.
- `status = submitted`.
- `request_code` theo dạng `COR-MOB-YYYYMMDD-SEQUENCE`.
- Lưu `id` vào `REQUEST_ID`.

### 8.3. Test idempotency replay

Gửi lại đúng body và đúng `X-Idempotency-Key`.

Kết quả mong đợi:

- HTTP `201`.
- Trả lại cùng `id`.
- Database chỉ có một logical service request.

Sau đó giữ nguyên key nhưng đổi `problem_description`.

Kết quả mong đợi:

- HTTP `409`.
- Có stable `error_code`.
- Không tạo request thứ hai.

### 8.4. List/read request

```http
GET {{BASE_URL}}/api/v1/service-requests
Authorization: Bearer {{RIDER_1_TOKEN}}
```

```http
GET {{BASE_URL}}/api/v1/service-requests/{{REQUEST_ID}}
Authorization: Bearer {{RIDER_1_TOKEN}}
```

Rider 2 đọc cùng `REQUEST_ID` phải nhận `403`.

### 8.5. Thêm media metadata

Endpoint này chỉ lưu metadata, không upload raw file:

```http
POST {{BASE_URL}}/api/v1/service-requests/{{REQUEST_ID}}/media
Authorization: Bearer {{RIDER_1_TOKEN}}
Content-Type: application/json
```

```json
{
  "media_type": "image",
  "object_reference": "manual-test/requests/image-001.jpg",
  "content_type": "image/jpeg",
  "size_bytes": 123456,
  "checksum": "manual-fixture-checksum"
}
```

Kết quả mong đợi: HTTP `201`.

Kiểm tra database:

```sql
select request_id, media_type, object_reference, content_type, size_bytes
from request_media_metadata
where request_id = '<REQUEST_ID>';
```

Audit/outbox không được chứa raw image hoặc full problem text.

### 8.6. Test cancel bằng một request riêng

Tạo một request mới với idempotency key khác, chưa dispatch, rồi gọi:

```http
POST {{BASE_URL}}/api/v1/service-requests/<REQUEST_ID_DÙNG_ĐỂ_CANCEL>/cancel
Authorization: Bearer {{RIDER_1_TOKEN}}
Content-Type: application/json
```

```json
{
  "reason": "Hủy manual test trước dispatch"
}
```

Kết quả mong đợi:

- HTTP `200`.
- `status = canceled`.
- Gọi cancel lại phải nhận conflict phù hợp.

Không cancel `REQUEST_ID` chính vì request đó được dùng tiếp cho dispatch.

## 9. Patch 4 — Dispatch, offer và atomic assignment

Trước khi tiếp tục:

- Hai mechanic có role `mechanic`.
- `profile_status = active`.
- `is_available = true`.
- Có skill `mobile_repair`.
- Location vừa cập nhật trong 300 giây.
- Request chính có `status = submitted`.

### 9.1. Bắt đầu dispatch

```http
POST {{BASE_URL}}/api/v1/service-requests/{{REQUEST_ID}}/dispatch
Authorization: Bearer {{RIDER_1_TOKEN}}
```

Kết quả mong đợi:

- HTTP `202`.
- Có `round_number = 1`.
- `radius_m = 2000`.
- Có danh sách `candidates`.
- Request chuyển sang `offered` nếu tìm được candidate.

### 9.2. Hai mechanic xem offer

Mechanic 1:

```http
GET {{BASE_URL}}/api/v1/dispatch/offers
Authorization: Bearer {{MECHANIC_1_TOKEN}}
```

Mechanic 2:

```http
GET {{BASE_URL}}/api/v1/dispatch/offers
Authorization: Bearer {{MECHANIC_2_TOKEN}}
```

Lưu offer tương ứng thành `OFFER_1_ID` và `OFFER_2_ID`.

### 9.3. Test decline trên một request phụ

Nếu muốn test decline, nên tạo request phụ và dispatch riêng:

```http
POST {{BASE_URL}}/api/v1/dispatch/offers/<OFFER_PHỤ_ID>/decline
Authorization: Bearer <TOKEN_MECHANIC_TƯƠNG_ỨNG>
```

Kết quả mong đợi: HTTP `204`.

### 9.4. Accept offer

Mechanic 1:

```http
POST {{BASE_URL}}/api/v1/dispatch/offers/{{OFFER_1_ID}}/accept
Authorization: Bearer {{MECHANIC_1_TOKEN}}
```

Kết quả mong đợi:

- HTTP `201`.
- Assignment có `status = accepted`.
- Lưu `id` vào `ASSIGNMENT_ID`.
- Request chuyển sang `assigned`.
- Candidate Mechanic 1 là `accepted`.
- Candidate cạnh tranh là `cancelled`.

Ngay sau đó, Mechanic 2 accept offer còn lại:

```http
POST {{BASE_URL}}/api/v1/dispatch/offers/{{OFFER_2_ID}}/accept
Authorization: Bearer {{MECHANIC_2_TOKEN}}
```

Kết quả mong đợi:

- HTTP `409`.
- Không tạo assignment thứ hai.

Kiểm tra invariant:

```sql
select request_id, count(*) as assignment_count
from assignments
where request_id = '<REQUEST_ID>'
group by request_id;

select id, mechanic_id, status
from dispatch_candidates
where request_id = '<REQUEST_ID>'
order by rank;
```

Phải có đúng một assignment cho request.

### 9.5. Test true concurrency tùy chọn

Để test gần với race thật:

1. Tạo request mới và dispatch cho hai mechanic.
2. Mở hai cửa sổ Postman.
3. Chuẩn bị hai request accept với hai token khác nhau.
4. Bấm Send gần như đồng thời.

Kết quả vẫn phải là một success và một `409`.

## 10. Patch 5 — Assignment progress, diagnosis và quote version

### 10.1. List assignment

```http
GET {{BASE_URL}}/api/v1/assignments
Authorization: Bearer {{MECHANIC_1_TOKEN}}
```

Xác nhận `ASSIGNMENT_ID` xuất hiện.

### 10.2. Chuyển assignment state đúng thứ tự

Lần lượt gửi ba request:

```http
POST {{BASE_URL}}/api/v1/assignments/{{ASSIGNMENT_ID}}/status
Authorization: Bearer {{MECHANIC_1_TOKEN}}
Content-Type: application/json
```

Body 1:

```json
{
  "status": "en_route",
  "reason": "Mechanic bắt đầu di chuyển"
}
```

Body 2:

```json
{
  "status": "on_site",
  "reason": "Mechanic đã tới nơi"
}
```

Body 3:

```json
{
  "status": "diagnosis",
  "reason": "Bắt đầu kiểm tra xe"
}
```

Kết quả mong đợi:

- Mỗi bước HTTP `200`.
- Không được bỏ qua thứ tự.
- Request đồng bộ sang `mechanic_en_route`, sau đó `in_service`.

Thử gửi trực tiếp `completed` khi đang `diagnosis`.

Kết quả mong đợi: HTTP `409`.

### 10.3. Tạo diagnosis

```http
POST {{BASE_URL}}/api/v1/assignments/{{ASSIGNMENT_ID}}/diagnoses
Authorization: Bearer {{MECHANIC_1_TOKEN}}
Content-Type: application/json
```

```json
{
  "diagnosis_text": "Ắc quy yếu và đầu cực có dấu hiệu oxy hóa.",
  "recommended_work_text": "Vệ sinh đầu cực và kiểm tra điện áp ắc quy.",
  "safety_notes": "Tắt máy trước khi thao tác."
}
```

Kết quả mong đợi:

- HTTP `201`.
- Có diagnosis `id`; lưu vào `DIAGNOSIS_ID`.
- Full diagnosis text tồn tại trong domain table nhưng không xuất hiện trong
  audit/outbox metadata.

Gọi lại endpoint trước khi quote để test revision. Sau khi quote đã tham chiếu
diagnosis, revision phải bị từ chối.

### 10.4. Tạo quote version 1

```http
POST {{BASE_URL}}/api/v1/service-requests/{{REQUEST_ID}}/quotes
Authorization: Bearer {{MECHANIC_1_TOKEN}}
Content-Type: application/json
```

```json
{
  "assignment_id": "{{ASSIGNMENT_ID}}",
  "diagnosis_id": "{{DIAGNOSIS_ID}}",
  "discount_amount": 50000,
  "notes": "Báo giá manual test, chỉ có giá trị tham khảo cho rider.",
  "lines": [
    {
      "line_type": "labor",
      "description": "Công kiểm tra hệ thống điện",
      "quantity": 1,
      "unit_amount": 150000
    },
    {
      "line_type": "part",
      "description": "Ắc quy thay thế",
      "quantity": 1,
      "unit_amount": 450000
    }
  ]
}
```

Kết quả mong đợi:

- HTTP `201`.
- `version = 1`.
- `status = pending`.
- `subtotal_amount = 600000`.
- `total_amount = 550000`.
- Assignment chuyển `quoted`.
- Request chuyển `awaiting_quote_approval`.
- Lưu quote id vào `QUOTE_1_ID`.

### 10.5. Tạo quote version 2

Gửi lại endpoint tạo quote với line/amount khác.

Kết quả mong đợi:

- HTTP `201`.
- `version = 2`.
- Quote 1 chuyển `superseded`.
- Quote 2 là `pending`.
- Lưu id vào `QUOTE_2_ID`.

### 10.6. Rider xem quote

```http
GET {{BASE_URL}}/api/v1/service-requests/{{REQUEST_ID}}/quotes
Authorization: Bearer {{RIDER_1_TOKEN}}
```

Kết quả mong đợi: thấy cả hai version.

### 10.7. Reject stale approval

```http
POST {{BASE_URL}}/api/v1/quotes/{{QUOTE_1_ID}}/approve
Authorization: Bearer {{RIDER_1_TOKEN}}
```

Kết quả mong đợi: HTTP `409`.

### 10.8. Approve quote mới nhất

```http
POST {{BASE_URL}}/api/v1/quotes/{{QUOTE_2_ID}}/approve
Authorization: Bearer {{RIDER_1_TOKEN}}
```

Kết quả mong đợi:

- HTTP `200`.
- Quote 2 là `approved`.
- Assignment và request chuyển `awaiting_payment`.
- Không tự động tạo payment order trong quote approval.
- Không tự động chuyển assignment sang `in_progress`.

Kiểm tra payment table tồn tại:

```sql
select to_regclass('public.payment_orders') as payment_orders,
       to_regclass('public.payment_events') as payment_events;
```

Hai giá trị phải là `payment_orders` và `payment_events`.

### 10.9. Flow reject thay thế

Để test reject, tạo một service request/assignment/diagnosis/quote mới rồi gọi:

```http
POST {{BASE_URL}}/api/v1/quotes/<LATEST_PENDING_QUOTE_ID>/reject
Authorization: Bearer {{RIDER_1_TOKEN}}
```

Kết quả mong đợi:

- Quote thành `rejected`.
- Assignment vẫn `quoted`.
- Request vẫn `awaiting_quote_approval`.
- Mechanic có thể tạo version mới.

## 11. Feature 005 — Payment

Payment backend-only dùng payOS/VietQR. Không có frontend payment UI, refund,
settlement, payout, invoice hoặc card storage.

Kết quả kiểm tra đúng ở thời điểm hiện tại:

- Có route `POST /api/v1/payments/orders`.
- Có route `GET /api/v1/payments/orders/[paymentOrderId]`.
- Có route `POST /api/v1/payments/orders/[paymentOrderId]/cancel`.
- Có route `POST /api/v1/payments/webhooks/payos`.
- Có route worker `POST /api/v1/internal/workers/payments/reconcile`.
- Có payment provider adapter payOS, payment repository và migration `020`.
- Quote approval chỉ đưa request/assignment đến `awaiting_payment`.
- Payment order creation yêu cầu `X-Idempotency-Key`.
- Webhook payOS hợp lệ mark order `succeeded`.
- Assignment chỉ được `awaiting_payment -> in_progress` sau payment success.

Không tạo payment table thủ công để giả lập trạng thái khác schema.

## 12. Patch 7A — Reminder và reminder-originated request

### 12.1. Tạo reminder due ngay

Lấy timestamp UTC hiện tại hoặc sớm hơn vài phút. Ví dụ phải thay bằng thời
gian phù hợp lúc test:

```http
POST {{BASE_URL}}/api/v1/reminders
Authorization: Bearer {{RIDER_1_TOKEN}}
Content-Type: application/json
```

```json
{
  "motorcycle_id": "{{MOTORCYCLE_ID}}",
  "title": "Bảo dưỡng định kỳ manual test",
  "interval_days": 30,
  "next_due_at": "2026-06-30T00:00:00.000Z",
  "enabled": true
}
```

Kết quả mong đợi:

- HTTP `201`.
- Lưu `id` vào `REMINDER_ID`.

Nếu ngày ví dụ đang nằm trong tương lai, đổi thành timestamp quá khứ gần nhất.

### 12.2. List/update reminder

List:

```http
GET {{BASE_URL}}/api/v1/reminders
Authorization: Bearer {{RIDER_1_TOKEN}}
```

Update:

```http
PATCH {{BASE_URL}}/api/v1/reminders/{{REMINDER_ID}}
Authorization: Bearer {{RIDER_1_TOKEN}}
Content-Type: application/json
```

```json
{
  "motorcycle_id": "{{MOTORCYCLE_ID}}",
  "title": "Bảo dưỡng định kỳ đã cập nhật",
  "interval_days": 30,
  "next_due_at": "2026-06-30T00:00:00.000Z",
  "enabled": true
}
```

### 12.3. Test snooze bằng reminder phụ

Tạo reminder phụ rồi gọi:

```http
POST {{BASE_URL}}/api/v1/reminders/<REMINDER_PHỤ_ID>/snooze
Authorization: Bearer {{RIDER_1_TOKEN}}
Content-Type: application/json
```

```json
{
  "until": "<TIMESTAMP_TƯƠNG_LAI_THEO_ISO_8601>"
}
```

Kết quả mong đợi:

- HTTP `200`.
- Có `snoozed_until`.
- Worker không claim reminder trước thời điểm snooze.

### 12.4. Test worker secret lỗi

Không gửi secret:

```http
POST {{BASE_URL}}/api/v1/internal/workers/reminders/run
```

Kết quả mong đợi:

- HTTP `401`.
- `error_code = UNAUTHORIZED`.

Gửi bearer token rider nhưng không có worker secret vẫn phải nhận `401`.

### 12.5. Chạy reminder worker

```http
POST {{BASE_URL}}/api/v1/internal/workers/reminders/run
X-Worker-Secret: {{WORKER_SECRET}}
X-Worker-Id: manual-reminder-worker-1
```

Kết quả mong đợi:

- HTTP `202`.
- Response có `claimed`, `generated`, `sent`, `failed`.
- Với một reminder due mới: `claimed >= 1`, `generated >= 1`.

Gọi worker lần hai ngay sau đó.

Kết quả mong đợi:

- Không tạo occurrence trùng cho cùng `(rule_id, due_at)`.

Kiểm tra database:

```sql
select id, rule_id, rider_id, motorcycle_id, due_at, status, processed_at
from reminder_occurrences
where rule_id = '<REMINDER_ID>'
order by due_at desc;
```

Lưu occurrence id vào `REMINDER_OCCURRENCE_ID`.

### 12.6. Tạo periodic-maintenance request từ occurrence

```http
POST {{BASE_URL}}/api/v1/service-requests
Authorization: Bearer {{RIDER_1_TOKEN}}
X-Idempotency-Key: manual-reminder-request-001
Content-Type: application/json
```

```json
{
  "motorcycle_id": "{{MOTORCYCLE_ID}}",
  "service_type": "periodic_maintenance",
  "problem_description": "Bảo dưỡng định kỳ từ reminder",
  "reminder_id": "{{REMINDER_ID}}",
  "reminder_context_id": "{{REMINDER_OCCURRENCE_ID}}",
  "maintenance_notes": "Manual test reminder-originated request"
}
```

Kết quả mong đợi:

- HTTP `201`.
- `status = submitted`.
- Không cần `scheduled_start_at`.
- Response/database lưu đúng `reminder_id` và `reminder_context_id`.
- Replay cùng key/body trả cùng logical request.
- Dùng occurrence này lần nữa với key khác phải conflict do occurrence unique.

### 12.7. Disable reminder

```http
DELETE {{BASE_URL}}/api/v1/reminders/{{REMINDER_ID}}
Authorization: Bearer {{RIDER_1_TOKEN}}
```

Kết quả mong đợi:

- HTTP `200`.
- `enabled = false`.

## 13. Patch 7B — Notification, outbox và audit hardening

### 13.1. Giới hạn manual hiện tại

Không có public route để client tạo notification. Đây là chủ ý thiết kế:
notification được tạo từ business event/service nội bộ.

Để test route worker mà không viết code, tạo một fixture transaction trực tiếp
trong Supabase SQL Editor.

### 13.2. Tạo notification/outbox/audit fixture atomically

Thay `<RIDER_1_ID>` và chạy:

```sql
begin;

with created_notification as (
  insert into notifications (
    user_id,
    type,
    title,
    body,
    data,
    dedupe_key,
    status
  )
  values (
    '<RIDER_1_ID>',
    'manual_test',
    'Thông báo manual test',
    'Mở ứng dụng để xem chi tiết.',
    '{"resource_id":"manual-test"}'::jsonb,
    'manual-notification-001',
    'pending'
  )
  returning id
),
created_outbox as (
  insert into outbox_events (
    topic,
    aggregate_type,
    aggregate_id,
    dedupe_key,
    payload,
    status,
    next_attempt_at
  )
  select
    'notification.created',
    'notification',
    id,
    'notification.created:manual-notification-001',
    jsonb_build_object(
      'resource_id', id,
      'actor_id', '<RIDER_1_ID>',
      'event_type', 'manual_test',
      'status', 'pending'
    ),
    'pending',
    now()
  from created_notification
  returning aggregate_id
)
insert into audit_logs (
  actor_id,
  actor_role,
  action,
  entity_type,
  entity_id,
  metadata
)
select
  '<RIDER_1_ID>',
  'rider',
  'notification.created',
  'notification',
  aggregate_id,
  jsonb_build_object(
    'resource_id', aggregate_id,
    'event_type', 'manual_test',
    'status', 'pending'
  )
from created_outbox;

commit;
```

Nếu đã dùng dedupe key này, đổi hậu tố `001`.

### 13.3. Test outbox worker secret

Không secret hoặc secret sai:

```http
POST {{BASE_URL}}/api/v1/internal/workers/outbox/run
X-Worker-Secret: wrong-secret
```

Kết quả mong đợi:

- HTTP `401`.
- `error_code = UNAUTHORIZED`.

Bearer token rider/mechanic không thay thế được worker secret.

### 13.4. Chạy outbox worker success

```http
POST {{BASE_URL}}/api/v1/internal/workers/outbox/run
X-Worker-Secret: {{WORKER_SECRET}}
X-Worker-Id: manual-outbox-worker-1
```

Kết quả mong đợi:

- HTTP `202`.
- `claimed >= 1`.
- `processed >= 1`.

Kiểm tra:

```sql
select id, status, sent_at, last_error_code
from notifications
where dedupe_key = 'manual-notification-001';

select id, status, attempt_count, lease_owner, lease_expires_at, processed_at
from outbox_events
where dedupe_key = 'notification.created:manual-notification-001';

select action, entity_id, metadata
from audit_logs
where entity_id = (
  select id from notifications
  where dedupe_key = 'manual-notification-001'
)
order by created_at;
```

Kết quả mong đợi:

- Notification là `sent`.
- Outbox là `processed`.
- Lease đã được clear.
- Có audit `notification.created` và `notification.sent`.
- Không có outbox event mới cho `notification.sent`; tránh recursive outbox.

### 13.5. Test crash/lease recovery

Tạo fixture mới với dedupe key `manual-notification-recovery-001`, sau đó mô
phỏng worker chết sau khi claim:

```sql
update outbox_events
set status = 'processing',
    attempt_count = 1,
    lease_owner = 'crashed-manual-worker',
    lease_expires_at = now() - interval '1 minute',
    processed_at = null
where dedupe_key = 'notification.created:manual-notification-recovery-001';
```

Gọi outbox worker bằng secret hợp lệ.

Kết quả mong đợi:

- Event được claim lại.
- `attempt_count` tăng.
- Event chuyển `processed`.
- Lease được clear.

### 13.6. Retry/dead-letter

Route production hiện không cấu hình external notification adapter gây lỗi,
nên không thể chủ động tạo delivery failure/dead-letter chỉ bằng Postman mà
không sửa code.

Manual test có thể xác nhận schema/state/index; retry/backoff/dead-letter đầy đủ
được bảo vệ bởi test suite. Không sửa runtime chỉ để ép lỗi.

### 13.7. Test audit append-only

Lấy một audit id rồi thử:

```sql
update audit_logs
set action = 'tampered'
where id = '<AUDIT_ID>';
```

Sau đó thử:

```sql
delete from audit_logs
where id = '<AUDIT_ID>';
```

Kết quả mong đợi:

- Cả update và delete đều bị PostgreSQL từ chối.

Không chạy `truncate audit_logs` trên database dùng chung. Nếu dùng database
test hoàn toàn cô lập, truncate cũng phải bị từ chối.

### 13.8. Test prohibited metadata

Chỉ chạy trong database test:

```sql
insert into audit_logs (
  action,
  entity_type,
  metadata
)
values (
  'manual.prohibited',
  'manual_test',
  '{"authorization":"Bearer fake-manual-token"}'::jsonb
);
```

Kết quả mong đợi:

- Insert bị constraint từ chối.

Thử tương tự với `raw_audio`, `api_key`, `chatbot_text` hoặc
`diagnosis_text` cũng phải bị từ chối.

## 14. Patch 8 — Chatbot persistence tương thích

Đảm bảo:

```env
CHATBOT_PERSISTENCE_MODE=postgres
```

Sau khi đổi env phải restart `npm.cmd run dev`.

### 14.1. Tạo chatbot session

```http
POST {{BASE_URL}}/api/chatbot/sessions
```

Kết quả mong đợi:

- HTTP `200`.
- Response `{ "session_id": "..." }`.
- Lưu vào `CHATBOT_SESSION_ID`.

### 14.2. Gửi text bình thường

```http
POST {{BASE_URL}}/api/chatbot/sessions/{{CHATBOT_SESSION_ID}}/messages
Content-Type: application/json
```

```json
{
  "input_mode": "text",
  "content_text": "Xe khó đề và đèn yếu"
}
```

Kết quả mong đợi:

- HTTP `200`.
- Response là diagnosis object trực tiếp.
- Nội dung rider-facing là tiếng Việt.
- Có `estimated_total.currency = VND`.
- Giá chỉ là ước tính.
- Không tự động tạo assignment, quote approval hoặc payment.

### 14.3. Test dangerous symptom

Tạo session mới rồi gửi:

```json
{
  "input_mode": "text",
  "content_text": "Xe bị mất phanh khi đang chạy"
}
```

Kết quả mong đợi:

- Risk ở mức cao/critical.
- `can_continue_riding = false`.
- Khuyến nghị dừng xe/an toàn/roadside assistance.
- Safety override không bị model output hạ mức.

Test thêm các câu:

- `Xe bị rò xăng`.
- `Xe bốc khói và có mùi khét`.
- `Tay lái rung lắc mất kiểm soát`.
- `Động cơ tắt máy khi đang chạy`.

### 14.4. Khôi phục diagnosis

```http
GET {{BASE_URL}}/api/chatbot/sessions/{{CHATBOT_SESSION_ID}}/diagnosis
```

Kết quả mong đợi:

```json
{
  "session_id": "...",
  "diagnosis": {}
}
```

### 14.5. Test persistence qua restart

1. Giữ lại `CHATBOT_SESSION_ID`.
2. Dừng dev server.
3. Chạy lại `npm.cmd run dev`.
4. Gọi lại endpoint GET diagnosis.

Kết quả mong đợi:

- Diagnosis vẫn được trả về.
- Public response shape không đổi.

Kiểm tra database:

```sql
select id, owner_user_id, created_at, updated_at
from chatbot_sessions
where id = '<CHATBOT_SESSION_ID>';

select id, session_id, input_mode, created_at
from chatbot_messages
where session_id = '<CHATBOT_SESSION_ID>'
order by created_at;

select id, session_id, risk_level, fallback_used, provider_name, created_at
from diagnosis_results
where session_id = '<CHATBOT_SESSION_ID>'
order by created_at desc;
```

### 14.6. Test audit/outbox chatbot không chứa full text

```sql
select topic, payload
from outbox_events
where aggregate_type in (
  'chatbot_session',
  'chatbot_message',
  'diagnosis_result'
)
order by created_at desc
limit 20;

select action, metadata
from audit_logs
where entity_type in (
  'chatbot_session',
  'chatbot_message',
  'diagnosis_result'
)
order by created_at desc
limit 20;
```

Kết quả mong đợi:

- Chỉ có metadata như resource id, type, status.
- Không chứa `Xe khó đề và đèn yếu`.
- Không chứa full diagnosis body, API key hoặc provider raw response.

### 14.7. Test local fallback

1. Tạm bỏ `GEMINI_API_KEY` và `OPENROUTER_API_KEY` khỏi `.env.local`.
2. Restart server.
3. Tạo session mới và gửi text.

Kết quả mong đợi:

- Vẫn nhận HTTP `200`.
- `fallback_used = true`.
- Nội dung vẫn bằng tiếng Việt.
- Disclaimer và safety behavior còn nguyên.

Khôi phục env sau khi test.

### 14.8. Test local ASR

Trong Postman:

```http
POST {{BASE_URL}}/api/chatbot/sessions/{{CHATBOT_SESSION_ID}}/transcriptions
Content-Type: multipart/form-data
```

Form-data:

```text
audio_file: <chọn file WAV cục bộ>
```

Kết quả mong đợi:

- HTTP `200`.
- Có `session_id` và `transcribed_text`.
- Không tự động gọi remote diagnosis từ transcription route.
- Raw WAV không xuất hiện trong chatbot tables, audit hoặc outbox.

Sau đó gửi `transcribed_text` qua messages endpoint như text bình thường.

## 14A. Admin và mechanic operations bổ sung

Các API này là backend-only. Dùng bearer token của tài khoản có role phù hợp và
không ghi token thật vào tài liệu hoặc log.

### 14A.1. Mechanic read models

```http
GET {{BASE_URL}}/api/v1/mechanics/me/dashboard
Authorization: Bearer {{MECHANIC_TOKEN}}
```

```http
GET {{BASE_URL}}/api/v1/mechanics/me/jobs?active_only=true&limit=20
Authorization: Bearer {{MECHANIC_TOKEN}}
```

```http
GET {{BASE_URL}}/api/v1/mechanics/me/performance
Authorization: Bearer {{MECHANIC_TOKEN}}
```

Kết quả mong đợi:

- HTTP `200` với dữ liệu chỉ thuộc mechanic hiện tại.
- Performance không có earnings, payout, settlement hoặc payment fields.

### 14A.2. Mechanic assignment metadata

Các request dưới đây cần assignment active thuộc mechanic hiện tại.

```http
POST {{BASE_URL}}/api/v1/assignments/{{ASSIGNMENT_ID}}/eta
Authorization: Bearer {{MECHANIC_TOKEN}}
Content-Type: application/json
X-Idempotency-Key: {{UNIQUE_KEY}}

{
  "eta_at": "{{FUTURE_ETA_ISO_OFFSET_DATETIME}}",
  "delay_reason": "Kẹt xe nhẹ, đang di chuyển đến vị trí của khách."
}
```

```http
POST {{BASE_URL}}/api/v1/assignments/{{ASSIGNMENT_ID}}/media
Authorization: Bearer {{MECHANIC_TOKEN}}
Content-Type: application/json
X-Idempotency-Key: {{UNIQUE_KEY}}

{
  "media_reference": "assignments/{{ASSIGNMENT_ID}}/proof/photo-1.jpg",
  "purpose": "work_proof",
  "content_type": "image/jpeg",
  "size_bytes": 524288
}
```

```http
POST {{BASE_URL}}/api/v1/assignments/{{ASSIGNMENT_ID}}/completion-checklist
Authorization: Bearer {{MECHANIC_TOKEN}}
Content-Type: application/json
X-Idempotency-Key: {{UNIQUE_KEY}}

{
  "work_summary": "Đã kiểm tra, xử lý lỗi cơ bản và bàn giao xe cho khách.",
  "safety_checklist": {
    "test_ride_completed": true,
    "tools_removed": true,
    "area_safe": true,
    "rider_briefed": true,
    "no_fluid_leak": true
  }
}
```

Kết quả mong đợi:

- HTTP `201`.
- Replay cùng key và cùng body trả lại kết quả cũ, không tạo bản ghi/audit/outbox
  trùng.
- Replay cùng key nhưng body khác trả `409`.
- Media endpoint từ chối raw file, base64 hoặc provider payload.
- Checklist không tự chuyển assignment sang `completed`.

### 14A.3. Admin operations smoke

```http
GET {{BASE_URL}}/api/v1/admin/users?limit=20
Authorization: Bearer {{ADMIN_TOKEN}}
```

```http
GET {{BASE_URL}}/api/v1/admin/mechanics?limit=20
Authorization: Bearer {{ADMIN_TOKEN}}
```

```http
GET {{BASE_URL}}/api/v1/admin/service-requests?limit=20
Authorization: Bearer {{ADMIN_TOKEN}}
```

Kết quả mong đợi:

- Admin token hợp lệ nhận HTTP `200`.
- Rider/mechanic token thường nhận `403`.
- Response đã redact, không có service-role key, bearer token, raw audio, raw
  media, provider payload, full private text hoặc payment-sensitive fields.

## 15. Patch 9 — Hardening và operational validation

### 15.1. Kiểm tra migration sequence

```sql
select *
from supabase_migrations.schema_migrations
order by version;
```

Tên cột có thể khác theo phiên bản Supabase CLI. Cần xác nhận record cuối có
version `202606250020` và tương ứng migration `payments`.

### 15.2. Kiểm tra index Patch 9

```sql
select indexname, tablename
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'idempotency_records_cleanup_idx',
    'outbox_events_processed_retention_idx',
    'audit_logs_created_retention_idx',
    'service_requests_rider_pagination_idx',
    'chatbot_messages_created_retention_idx',
    'diagnosis_results_created_retention_idx',
    'assignments_one_active_request_idx',
    'assignments_one_active_mechanic_idx'
  )
order by indexname;
```

Kết quả mong đợi: tất cả index trên xuất hiện.

### 15.3. Kiểm tra foreign-key consistency

```sql
select constraint_name, table_name
from information_schema.table_constraints
where constraint_schema = 'public'
  and constraint_name in (
    'service_requests_motorcycle_owner_fk',
    'dispatch_candidates_round_request_fk',
    'assignments_candidate_identity_fk',
    'mechanic_diagnoses_assignment_identity_fk',
    'quotes_assignment_request_fk',
    'quotes_diagnosis_identity_fk',
    'reminder_occurrences_rule_identity_fk',
    'diagnosis_results_message_session_fk'
  )
order by constraint_name;
```

Kết quả mong đợi: tất cả constraint xuất hiện.

### 15.4. Kiểm tra RLS policy

```sql
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Xác nhận có các policy:

- `app_users_self_select`
- `user_roles_self_select`
- `user_devices_owner_select`
- `motorcycles_owner_select`
- `service_requests_actor_select`
- `dispatch_candidates_rider_select`
- `dispatch_rounds_rider_select`
- `notifications_owner_select`
- `chatbot_sessions_owner_select`

### 15.5. Test RLS trực tiếp qua Supabase REST

Dùng Rider 1 token:

```http
GET {{SUPABASE_URL}}/rest/v1/motorcycles?select=id,rider_id,brand_text,model_text
apikey: {{SUPABASE_PUBLISHABLE_KEY}}
Authorization: Bearer {{RIDER_1_TOKEN}}
```

Kết quả mong đợi:

- Rider 1 chỉ thấy motorcycle của mình.

Dùng Rider 2 token gọi cùng URL:

- Không thấy motorcycle Rider 1.

Không dùng service-role key vì service role bypass RLS.

### 15.6. Test JWT algorithm policy ở mức manual

Manual smoke khả thi:

1. Token hợp lệ từ Supabase phải gọi `/api/v1/auth/me` thành công.
2. Chuỗi không phải JWT phải nhận `401 INVALID_TOKEN`.
3. JWT hết hạn phải nhận `401`.
4. Không cấu hình legacy shared-secret fallback thay cho `SUPABASE_JWKS_URL`.

Các trường hợp `none`, `HS256`, key/algorithm mismatch và algorithm confusion
không nên tự chế token trên môi trường dùng chung. Chúng được bảo vệ bởi test
hardening và không cần sửa code để manual test.

### 15.7. Kiểm tra client bundle không lộ server secret

Chạy production build:

```powershell
npm.cmd run build
```

Sau đó tìm trong `.next/static` các tên:

```text
DATABASE_URL
TEST_DATABASE_URL
SUPABASE_SERVICE_ROLE_KEY
INTERNAL_WORKER_SECRET
GEMINI_API_KEY
OPENROUTER_API_KEY
PAYMENT_WEBHOOK_SECRET
```

Kết quả mong đợi: không có tên/value server-only nào trong JavaScript client.

Không chụp hoặc chia sẻ output có chứa giá trị env thật.

## 16. Kiểm tra audit/outbox chung cho mỗi mutation

Sau mỗi mutation quan trọng, dùng `entity_id`, `request_id` hoặc `aggregate_id`
để kiểm tra:

```sql
select id, actor_id, actor_role, action, entity_type, entity_id, metadata, created_at
from audit_logs
where entity_id = '<RESOURCE_ID>'
order by created_at;

select id, topic, aggregate_type, aggregate_id, dedupe_key, payload,
       status, attempt_count, next_attempt_at, processed_at
from outbox_events
where aggregate_id = '<RESOURCE_ID>'
order by created_at;
```

Checklist:

- Domain row, audit và outbox cùng tồn tại sau success.
- Không có audit/outbox residue khi mutation rollback.
- Payload chỉ chứa ID, status, count hoặc metadata an toàn.
- Không chứa access token, worker secret, API key, raw audio, full chatbot text,
  full diagnosis text, phone/email hoặc payment credential.
- Read-only GET không tạo audit/outbox mới.

## 17. Ma trận negative test tối thiểu

Áp dụng cho từng nhóm endpoint phù hợp:

| Ca test | Kết quả mong đợi |
|---|---|
| Không bearer token | `401` |
| Bearer token sai | `401 INVALID_TOKEN` |
| Sai role | `403` |
| Resource thuộc user khác | `403` |
| UUID không tồn tại | `404` |
| JSON sai schema | `400 INVALID_INPUT` |
| Vi phạm database constraint sau validation | `422` |
| State transition/replay conflict | `409` |
| Worker thiếu/sai secret | `401 UNAUTHORIZED` |
| Worker có bearer token nhưng không có secret | `401 UNAUTHORIZED` |

Mỗi error response phải:

- Là JSON có `error_code`.
- Không có stack trace.
- Không chứa secret hoặc full private text.

## 18. Dọn dữ liệu manual test

Ưu tiên dùng một project/database test riêng.

Không xóa audit log bằng API hoặc SQL vì audit là append-only. Nếu cần reset
toàn bộ fixture, reset database test hoặc drop/recreate schema theo quy trình
test của team.

Nếu chỉ dọn dữ liệu domain:

1. Dừng dev server và worker.
2. Xác nhận đang ở database test.
3. Xóa theo thứ tự phụ thuộc hoặc reset toàn bộ test database.
4. Không chạy cleanup trên production.

Các tài khoản test trong Supabase Auth có thể xóa từ Dashboard sau khi domain
fixture đã được reset.

## 19. Checklist sign-off cuối

- [ ] Migration 001-020 đã apply đúng thứ tự.
- [ ] Rider profile/device hoạt động và không lộ raw device token.
- [ ] Motorcycle CRUD và ownership denial đúng.
- [ ] Mechanic profile, skill, availability và fresh location đúng.
- [ ] Service request tạo được, có request code và idempotency đúng.
- [ ] Media chỉ lưu metadata.
- [ ] Cancel trước assignment hoạt động.
- [ ] Dispatch tạo offer đúng và chỉ một mechanic accept thành công.
- [ ] Assignment state đi đúng thứ tự.
- [ ] Diagnosis không bị đưa full text vào audit/outbox.
- [ ] Quote versioning, stale approval và latest approval đúng.
- [ ] Approval dừng ở `awaiting_payment`; payment order chỉ được tạo qua
  `POST /api/v1/payments/orders`.
- [ ] Payment payOS/VietQR tạo checkout URL/QR, webhook hợp lệ mark `succeeded`,
  và assignment chỉ start sau payment success.
- [ ] Reminder worker secret và occurrence dedupe đúng.
- [ ] Reminder-originated periodic-maintenance request đúng.
- [ ] Outbox worker secret, success và lease recovery đúng.
- [ ] Notification sent audit không tạo recursive outbox.
- [ ] Audit update/delete và prohibited metadata bị từ chối.
- [ ] Chatbot session/diagnosis sống qua restart.
- [ ] Chatbot safety, Vietnamese fallback và local ASR còn nguyên.
- [ ] RLS ownership hoạt động qua Supabase REST.
- [ ] Patch 9 indexes/constraints/policies tồn tại.
- [ ] Client bundle không chứa server-only secret.
- [ ] Không có frontend payment UI, refund, settlement, payout, inventory,
  odometer hoặc live-tracking scope mới.

Khi tất cả mục trên đạt, manual flow của toàn bộ patch đã triển khai được xem
là hoàn tất. Payment backend-only được ghi chi tiết hơn trong
`specs/005-careonroad-payment/quickstart.md`.
