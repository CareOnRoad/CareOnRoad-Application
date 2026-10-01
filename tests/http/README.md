# Kiểm thử HTTP black-box CareOnRoad

Bộ test gọi API thật bằng `fetch`, tương tự gửi request trong Postman. Không import
service, repository, route handler hoặc unit test của ứng dụng. Oracle lấy từ
`AGENTS.md`, README, hợp đồng API và feature specifications; danh sách route được
kiểm kê từ **tên thư mục**, không đọc implementation.

## File sử dụng

- `cases.mjs`: payload, kết quả mong đợi và các luồng kiểm tra. Các case workflow
  gồm nhiều request và kiểm tra trạng thái sau mutation.
- `run.mjs`: khởi động API local, lấy JWT thật, chạy case và lưu kết quả đã redact.
- `test-cases.json`: catalogue đầy đủ có ID, role, request, expected status và
  tiền điều kiện cho các case cần hạ tầng.
- `careonroad.postman_collection.json`: từng request có thể import vào Postman;
  điền JWT/fixture variables từ **project test**. Race và các assertion workflow
  tổng hợp nằm ở runner Node, không thể thay bằng Run All tuần tự trong Postman.
- `LATEST.md` và `reports/<run-id>/results.json`: báo cáo và trace HTTP thực tế.
  Không lưu response body, email/password hoặc JWT.

## Chạy

Node 24 đang có sẵn; không cần cài dependency.

```powershell
# Chỉ xuất catalogue/collection, không network hoặc dữ liệu test
node tests/http/run.mjs --list

# Kiểm tra chính runner: placeholder, status assertion, redact, route coverage
node tests/http/run.mjs --self-check

# Health, OAuth probes và GET thiếu/sai JWT; không tạo fixture
node tests/http/run.mjs --read-only
```

Sau khi xác nhận Supabase trong `.env.local` là test/dev và cho phép mutation:

```powershell
$env:API_TEST_ALLOW_MUTATIONS = 'true'
node tests/http/run.mjs

# Recheck có chọn lọc bằng đúng 8 fixture của run gốc; không tạo thêm user
node tests/http/run.mjs --recheck <run-id-trong-reports>

# Chạy riêng workflow trên mechanic fixture idle và Review với fixture completed
node tests/http/run.mjs --recheck <run-id-trong-reports> --workflows-only
node tests/http/run.mjs --recheck <run-id-trong-reports> --reviews-only

# Read-only: xác minh metadata/ban/unavailable và audit/outbox sanitized
node tests/http/verify-fixtures.mjs <run-id-trong-reports>
```

Mặc định runner chạy API ở `http://127.0.0.1:3100`. Đặt `API_TEST_BASE_URL` nếu muốn
dùng API test đã chạy; API đó phải kết nối cùng Supabase test với runner. Timeout
mỗi HTTP request là 45 giây, đổi bằng `API_TEST_TIMEOUT_MS`.
API local do runner khởi động đặt Gemini/OpenRouter key rỗng trong child process
để test fallback mà không gọi provider thật; không sửa file env. Với API ngoài,
người chạy cần đảm bảo provider test đã tắt/cô lập.

Runner nạp `.env`, `.env.local`, `apps/api/.env`, `apps/api/.env.local` bằng Node.
Không sửa `.env`, không log giá trị env, không tự apply migration. Required:
`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`; worker/device/provider tests cần cấu hình tương ứng.

Không chạy chế độ mutation vào production. Lần chạy chuẩn tạo **8 tài khoản test
riêng**: hai rider, hai mechanic, một mechanic pending, một admin, một user chưa
chọn account type, và một mechanic cho recovery/cancel/recall. Admin role chỉ được
chuẩn bị trên **tài khoản mới** qua Supabase REST bằng service-role. Request kiểm
tra quyền luôn dùng access token user thật lấy từ Supabase Auth; không giả JWT
và không dùng service-role để vượt kiểm tra authorization.

Sau chạy, runner chuyển mechanic fixture unavailable và yêu cầu ban Auth accounts
đã tạo. Kết quả từng bước cleanup có trong JSON. Domain/history/audit giữ nguyên
để điều tra; không reset schema, không seed lại bốn tài khoản mock, không hard
delete audit. Ban Auth không thu hồi ngay mọi access token đã cấp; token chỉ giữ
trong memory của runner. Fixture/history tích lũy qua các lần chạy nên ưu tiên
project disposable.

Recheck xác minh ID và metadata `http_test_run` của từng tài khoản trước khi
mở ban Auth tạm và đổi mật khẩu ngẫu nhiên trong memory để lấy JWT mới. Không
bootstrap lại, không cấp lại admin, không đảo ngược mechanic ban nghiệp vụ.
Sau recheck lại unavailable + ban đúng tám Auth fixture. Các bước chuẩn bị
assignment mới cũng gọi HTTP; báo cáo ghi rõ fixture và biến thể tiền điều kiện.
Các recheck cần trạng thái baseline phù hợp, không phải lệnh reset/re-run suite
trên fixture đã bị thay đổi nhiều lần. `--workflows-only` dùng mechanic profile
idle được grant trên rider2 fixture; vẫn dùng đúng tám Auth accounts ban đầu.

## Phạm vi và oracle

Catalogue bao phủ các HTTP method ngoài payment đã khai báo trên các route hiện
có: auth/account type/device; motorcycles; mechanic profile/dashboard/jobs/
performance; service requests; dispatch/decline/race accept; assignment state;
ETA/media/checklist; diagnosis/quote versions/approve/reject; rescue labor/parts
và recall; recovery; reminders; notifications; signed uploads; reviews; RLS;
admin users/mechanics/requests; health/operations/workers; chatbot ownership,
safety/fallback/rate limits; ASR; Google OAuth.

Với mỗi nhóm, case kiểm tra các điều kiện phù hợp: không JWT, JWT sai, sai role,
ownership, resource absent, schema/type/biên, state sai, replay/conflict,
concurrency, redaction và trạng thái sau hành động. Case chạy sau chỉ có PASS khi
đáp ứng cả HTTP expected và assertion nghiệp vụ; thiếu fixture là BLOCKED.

Không thể chứng minh "hết mọi trường hợp" bằng một bộ test hữu hạn. Mapped route
không đồng nghĩa mọi nhánh implementation hay mọi tổ hợp state đã được kiểm thử.
`INF-*` trong catalogue nêu các case cần fault injection, kiểm soát thời gian,
project/worker cô lập hoặc thao tác Google thật.

Các quy ước có nhiều nguồn:

- Input invalid: `400` hoặc `422` được phép bởi `backend-api.yaml`.
- API error envelope: tài liệu cũ dùng `{error_code,message}`, các contract mới
  có `{error:{code,message}}`; runner yêu cầu một mã lỗi trong hai dạng, không
  chấp nhận HTML/stack trace.
- Dispatch `202`, accept `201`, decline `204`: theo backend contract và manual
  testing guide. Không đổi expected theo response thực để làm app pass.
- Notes chỉ có `POST` trong admin contract; không đặt yêu cầu tự tạo `GET notes`.
- OAuth error có thể redirect bằng `302/303`; vẫn phải có error và không được
  cấp access token/refresh token/code từ state giả. Tham khảo
  [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls) và
  [Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google).
- Một số API mới như rescue recall chưa có success status trong tài liệu; case
  ghi rõ chấp nhận `200/201/202` **và phải thấy offer đúng mechanic/request**.
- Location `204`; cancel cần `reason`; Motorcycle/Reminder PATCH dùng input
  đầy đủ theo OpenAPI. Diagnosis trước quote sửa current record (FR-014A),
  quote versions mới bất biến. Account type test kiểm tra role bất biến; spec
  không bắt buộc mọi lần chọn lại phải trả `409`.
- Contract gaps được ghi `BLOCKED` và loại khỏi Postman collection runnable:
  AGENTS ghi PATCH auth/profile nhưng README/OpenAPI chỉ POST; request list
  chưa quy định limit/status/service_type và định dạng cursor invalid.
- Replay so sánh JSON theo cấu trúc, không theo thứ tự property. Idempotency key
  lưu độc lập với fixture IDs. Concurrent create có thể conflict tạm thời nhưng
  retry cùng key phải trỏ về duy nhất một logical resource.

Payment orders/webhook/reconcile/payment summary/admin payment queues bị loại
khỏi inventory. Standard repair dừng ở quote approval; rescue `after_repair`
kiểm tra travel/parts approval/repair và dừng ở `awaiting_payment`. Không gọi
payOS, không giả thanh toán bằng SQL. Với quyền thay đổi trạng thái fixture được
người dùng cấp, `--reviews-only` xác minh assignment/request riêng không có quote,
chuẩn bị trạng thái completed qua Supabase REST có owner filters, rồi gọi Review
API để test state mismatch, roles, boundaries, concurrency, immutable replay và
average/count. Đây là tiền điều kiện của Review; không chứng minh workflow
completion/payment. Không thay đổi fixture quote/payment của luồng chính.

## Google và dịch vụ ngoài

OAuth settings/authorize/callback-invalid được gọi trực tiếp tới Supabase. Google
disabled là FAIL cấu hình, không PASS. Google happy path cần token từ login
Google thật trong `API_TEST_GOOGLE_ACCESS_TOKEN`; tùy chọn refresh trong
`API_TEST_GOOGLE_REFRESH_TOKEN`. Không đưa token vào chat/report. Password login
của fixture không chứng minh Google login hoạt động.

ASR success cần `API_TEST_WAV_PATH`, models ONNX và tùy chọn
`API_TEST_WAV_EXPECTED_TEXT`. WAV invalid được kiểm tra riêng. FCM/provider
delivery, shared controls, retention execution, tracking enabled và fault
injection có tiền điều kiện riêng trong `INF-*`.

Global workers có thể xử lý cả dữ liệu ngoài fixture. Chỉ bật
`API_TEST_ALLOW_GLOBAL_WORKERS=true` trên project disposable được xác nhận.
Mặc định không chạy các worker này; retention chỉ dry-run.

## Kết quả

`PASS`: mọi assertion của case đạt. `FAIL`: đã gọi API nhưng sai status/schema/
invariant. `BLOCKED`: chưa có tiền điều kiện hoặc chưa được phép chạy mutation.
Exit code `1` nếu có FAIL hoặc BLOCKED; không coi test chưa chạy là thành công.

SHA-256 của `cases.mjs` được lưu theo run. Báo cáo cũ giữ nguyên để thấy lịch sử
chỉnh lỗi harness và rerun. Lần chạy không sửa application code.

Nguồn thao tác Auth fixture là [Supabase admin updateUserById](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid);
credential chỉ dùng server-side. Không lưu secret vào collection hoặc report.
