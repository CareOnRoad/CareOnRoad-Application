# Hướng dẫn cấu hình và kiểm thử thanh toán CareOnRoad

Cập nhật và đối chiếu tài liệu chính thức ngày **01/10/2026**. Hướng dẫn dành
cho Windows/PowerShell, backend `apps/api` và Supabase dev/test. Các API,
trạng thái và tên biến bên dưới đã đối chiếu với code hiện tại của repo.

Backend hỗ trợ payOS/VietQR, tiền công trả trước hoặc toàn bộ trả sau sửa,
thu khoản còn lại, webhook có chữ ký, worker đối soát và admin xử lý review.
Mobile/web chưa tích hợp workflow mới. Hoàn thành hướng dẫn này giúp kiểm
thử thanh toán qua API; để khách/thợ sử dụng trong app vẫn cần nối client
khi phạm vi đó được mở lại.

## Kết quả thiết lập thực tế ngày 01/10/2026

| Hạng mục | Kết quả đã kiểm tra |
| --- | --- |
| API local | Đang chạy tại `http://127.0.0.1:3000`; liveness/readiness HTTP 200 |
| HTTPS public | Cloudflare Quick Tunnel đã chạy và liveness public HTTP 200 |
| Cấu hình payment | Đã cập nhật return/cancel URL về health route tạm, giữ nguyên ba key bạn điền |
| Webhook payOS | Đăng ký thành công: HTTP 200, `code: "00"`, URL trả về khớp URL gửi |
| Database app | Kết nối được; đủ bốn cột cứu hộ và unique index chống payment succeeded trùng quote |
| Worker một lượt | Outbox, dispatch, payment reconciliation đều thành công, không có failed/retried/deadLettered trong lượt kiểm tra |
| Worker liên tục | Task Scheduler `CareOnRoad Payment Workers` đang Running, chạy ẩn khi đăng nhập, không mở bản chạy trùng |
| Kiểm thử tự động | 26/26 tests payment/provider/routes/rescue workflow đạt; dùng provider giả |
| Kiểm thử API với payOS thật | 9 kiểm tra đạt: nhánh trả trước tạo/retry/hủy đơn 10.000đ; nhánh trả sau tạo/retry đơn 12.000đ; kiểm tra chặn di chuyển, thu trước sửa xong và hoàn tất khi chưa trả đủ |
| DB integration suite | Chưa chạy: bạn xác nhận chưa có project test riêng; giữ nguyên guard ngăn dùng DB app |
| Firebase push | Chưa cấu hình ba biến FCM; notification inbox vẫn dùng được |
| Giao dịch tiền thật | Đã xác nhận nhận đủ 12.000đ: payOS `PAID`, backend `succeeded`, còn lại 0đ; assignment/request thử đã `completed` |

Các tiến trình API/tunnel hiện được chạy cho phiên thử local. Worker đã có
Task Scheduler nhưng không tự khởi động API/tunnel khi reboot. Với lần
khởi động mới, chạy lại API và tunnel, lấy hostname mới, cập nhật URL rồi
xác nhận lại webhook theo bước 3–4. Không dùng URL Quick Tunnel cũ khi
tiến trình tunnel đã dừng.

Executable tunnel được tải từ release Cloudflare chính thức, đã kiểm tra
SHA-256 và lưu trong thư mục local được Git bỏ qua. Lệnh chạy lại trên máy:

```powershell
Set-Location 'D:\fpt\subject\EXE101\CareOnRoad-mobile-break'
& '.\apps\api\node_modules\.careonroad-payment-local\cloudflared.exe' tunnel --url http://127.0.0.1:3000 --no-autoupdate
```

Task worker dùng script `apps/api/scripts/run-payment-workers.mjs --watch`.
Log kiểm tra local nằm ở
`apps/api/node_modules/.careonroad-payment-local/worker-watch.log`; nội dung
script chỉ ghi trạng thái/số đếm, không ghi credential. Không chạy thêm
`--watch` trong terminal khi Task Scheduler này đang Running.

### Kết quả bước cuối: giao dịch thử đã thanh toán

Đã chuẩn bị yêu cầu **TEST** bằng `rider2@gmail.com` và `mechanic2@gmail.com`.
Các bước di chuyển/sửa chữa được mô phỏng qua API trên dữ liệu demo, không
phải việc sửa xe thật. Tổng tiền: **10.000đ tiền công + 2.000đ phụ tùng =
12.000đ**. Đã kiểm tra sau khi bạn chuyển khoản, lúc **15:13 ngày
01/10/2026, giờ Việt Nam**:

- payOS trả HTTP 200, `code: "00"`, `status: "PAID"`, `amount: 12000`,
  `amountPaid: 12000`; mã đơn `100001` và payment link khớp đơn thử.
- Backend trả order `succeeded`, `succeeded_at: 2026-10-01T08:07:49.050Z`
  (15:07:49 giờ Việt Nam); summary `paid_amount: 12000`, `remaining_amount: 0`.
- Sau khi xác nhận trả đủ, đã gọi API status bằng tài khoản thợ thử và nhận
  HTTP 200; đọc lại xác nhận cả assignment và service request `completed`.

Đơn thử này đã thanh toán xong, **không chuyển thêm vào QR/link cũ**. Các
endpoint để kiểm tra lại bằng JWT của khách/thợ:

```text
GET /api/v1/payments/orders/06b89000-91d8-4da8-b1dc-db369608d9f6
GET /api/v1/service-requests/b672a890-4096-4d2e-a2fa-1df77f8cf4f4/payment-summary
```

Nhánh **trả sau sửa (`after_repair`)** đã được kiểm chứng qua API và giao
dịch tiền thật đến khi hoàn tất. Nhánh **trả tiền công trước** đã kiểm tra
tạo/retry/hủy link và guard workflow; chưa có giao dịch tiền thật cho nhánh
đó. DB integration suite và Firebase push vẫn còn như ghi nhận ở bảng trên.

## Thứ tự thực hiện

| Bước | Việc cần làm | Kết quả |
| --- | --- | --- |
| 0 | Chuẩn bị môi trường và xác định file env | Biết đúng repo, Node và DB dev/test |
| 1 | Tạo/xác thực payOS, liên kết ngân hàng, tạo kênh | Có ba key của cùng kênh thu |
| 2 | Chạy API và tạo HTTPS public | payOS truy cập được backend |
| 3 | Điền env và bật payment | API nhận đủ cấu hình |
| 4 | Đăng ký, xác nhận webhook | payOS chấp nhận URL webhook |
| 5 | Chạy worker và cấu hình tự chạy nếu cần | Outbox, dispatch, reconciliation hoạt động |
| 6 | Tạo DB integration test riêng | Chạy DB tests mà không dùng DB app |
| 7 | Kiểm thử hai nhánh cứu hộ bằng API | Đúng số tiền, đúng thời điểm thu, không thu lặp |
| 8 | Cấu hình Firebase nếu cần push | Có thêm push ngoài notification inbox |
| 9 | Thực hành đối soát admin khi có review | Không bỏ qua khoản thiếu/thừa/trùng |

Bước 0–5 và 7 là phần cần thiết để kiểm chứng thanh toán backend. Bước 6
kiểm tra persistence; bước 8 chỉ cần để thử push. Bước 9 dùng khi có đơn cần
đối soát. Bảng lỗi và checklist cuối tài liệu giúp kiểm tra từng bước.

## Trạng thái đã xử lý trong repo

- API bổ sung biến còn thiếu từ `.env.local` ở root. Biến của tiến trình và
  file env trong `apps/api` có ưu tiên cao hơn; sửa file root có thể không
  tác dụng nếu biến đó đã được đặt ở nơi có ưu tiên cao hơn.
- Migration `202606250033_rescue_quote_payment_workflow.sql` đã áp dụng và
  kiểm tra trên Supabase dev/test của phiên làm việc ngày 30/09/2026.
- Backend lưu đơn/mã payOS trước khi gọi provider. Retry/worker khôi phục
  cùng mã; webhook đến trong lúc tạo link không bị ghi đè thành pending.
- Đã có API admin xử lý review và script worker chạy một lần/liên tục.
- DB tests từ chối dùng cùng database với app trước khi kết nối.
- Readiness timeout có thể đặt 5 giây cho Supabase hosted.

Ở lần kiểm tra cấu hình trước đó, key payOS/FCM chưa được điền, payments
đang tắt và test DB dùng chung DB app. Đây là ghi nhận của lần kiểm tra đó;
sau khi bạn thay env, cần chạy lại các kiểm tra bên dưới. Chưa có xác nhận
giao dịch tiền thật chỉ từ unit tests hoặc readiness.

## 0. Chuẩn bị môi trường

### 0.1. Mở đúng thư mục

Mở PowerShell và chạy:

```powershell
Set-Location 'D:\fpt\subject\EXE101\CareOnRoad-mobile-break'
node --version
pnpm.cmd --version
```

Dùng Node 20.12+ để có `process.loadEnvFile`; workspace hiện dùng Node 24.
Dùng `pnpm.cmd` thay vì `pnpm.ps1` trên Windows. Các lệnh trong tài liệu chạy
ở root repo, trừ khi có `Set-Location` chỉ rõ thư mục khác.

### 0.2. Chuẩn bị tài khoản và cấu hình có sẵn

Bạn cần quyền quản lý project Supabase **dev/test**, một tài khoản payOS,
tài khoản ngân hàng nhận tiền do bạn quản lý, và tài khoản khách/thợ để thử.
Nếu kiểm tra review thì cần thêm tài khoản có role `admin` trong CareOnRoad.

Mở `.env.local` bằng editor, không in toàn bộ file ra terminal. Giữ nguyên
các cấu hình Supabase/Auth đang hoạt động và `INTERNAL_WORKER_SECRET` hiện
có. Hướng dẫn chỉ yêu cầu chỉnh các biến được liệt kê ở từng bước, không
thay toàn bộ file bằng các block mẫu.

Nếu chạy trên một project Supabase dev/test **mới**, cần áp dụng migrations
001–033 theo [hướng dẫn migration trong repo](../../AGENTS.md). Không cần
chạy lại migration 033 chỉ vì sửa key payOS. DB test riêng ở bước 6 không
phải DB mà API phục vụ khách/thợ sử dụng.

## 1. Tạo kênh thu payOS và lấy key

### 1.1. Đăng ký và xác thực

1. Mở [my.payos.vn](https://my.payos.vn), tạo tài khoản hoặc đăng nhập.
2. Chọn đúng loại tổ chức: **Cá nhân/Hộ kinh doanh** hoặc **Doanh nghiệp**.
3. Điền thông tin theo màn hình: cá nhân dùng CCCD/tên; doanh nghiệp dùng
   MST/GPKD. Chọn kiểm tra thông tin rồi tiếp tục.
4. Nếu màn hình yêu cầu xác thực bằng QR, chuyển đúng số tiền/nội dung được
   hiển thị từ tài khoản ngân hàng trùng tên tổ chức. Không tự lấy số tiền
   hoặc nội dung từ ví dụ trong tài liệu.
5. Đợi tổ chức được xác thực. Nếu tra cứu CCCD/MST không thành công, làm theo
   mục xác thực thủ công trên trang chính thức.

**Kết quả cần thấy:** tổ chức đã xác thực, tên đúng với chủ tài khoản ngân
hàng sẽ liên kết. Nguồn: [payOS — Xác thực tổ chức](https://payos.vn/docs/huong-dan-su-dung/xac-thuc-to-chuc/).

### 1.2. Liên kết ngân hàng và tạo kênh

1. Trong payOS, thêm tài khoản ngân hàng nhận tiền. Chọn hướng dẫn đúng ngân
   hàng ở mục **Kênh thu → Kết nối tài khoản**; hoàn tất xác nhận/OTP theo
   hướng dẫn của ngân hàng đó.
2. Mở mục **Kênh thanh toán**, chọn **Tạo kênh thanh toán**. Mục này được
   nhóm dưới **Kênh thu** trong tài liệu hiện tại.
3. Nhập tên kênh, logo theo yêu cầu của màn hình, rồi tiếp tục.
4. Chọn ngân hàng chính nhận tiền, chọn tạo kênh và tích hợp.
5. Lưu **Client ID**, **API Key**, **Checksum Key** của chính kênh vừa tạo
   vào file local ở bước 3. Không trộn key giữa hai kênh.

**Kết quả cần thấy:** một kênh thu gắn đúng ngân hàng và đủ ba key. Nguồn:
[payOS — Tạo kênh thanh toán](https://payos.vn/docs/huong-dan-su-dung/kenh-thu/tao-kenh-thanh-toan/).
Hướng dẫn liên kết theo từng ngân hàng nằm trong sidebar cùng trang; ví dụ
[ACB](https://payos.vn/docs/huong-dan-su-dung/kenh-thu/ket-noi-tai-khoan/ngan-hang-acb/).

Repo đã có adapter gọi payOS; bạn không cần cài thêm payOS SDK để làm các
bước này. Tất cả order hiện dùng một kênh: tiền về ngân hàng của kênh đó,
chưa tự chuyển tiền cho từng thợ.

## 2. Chạy API và tạo địa chỉ HTTPS

### 2.1. Chạy API local

Mở **terminal A**, ở root repo:

```powershell
pnpm.cmd run dev:api
```

Dùng địa chỉ/port được terminal thông báo. Các ví dụ dưới đây giả định API
ở `http://localhost:3000`. Nếu pnpm vướng lỗi bootstrap/install nhưng
`apps/api/node_modules` đã có Next, có thể chạy trực tiếp:

```powershell
Set-Location 'D:\fpt\subject\EXE101\CareOnRoad-mobile-break\apps\api'
node node_modules/next/dist/bin/next dev --port 3000
```

Không chạy cả hai cách cùng lúc. Giữ terminal A mở.

Mở **terminal B**, kiểm tra API:

```powershell
Invoke-RestMethod -Uri 'http://localhost:3000/api/v1/internal/health/live'
Invoke-RestMethod -Uri 'http://localhost:3000/api/v1/internal/health/ready' | ConvertTo-Json -Depth 5
```

**Kết quả cần thấy:** liveness có `status: ok`. Readiness có
`status: ready`, `database: up`; `payments: disabled` được chấp nhận ở giai
đoạn chưa cấu hình payment. Readiness `configured` chỉ kiểm tra sự hiện
diện của cấu hình, không xác nhận key đúng hay tiền đã vào ngân hàng.
Nếu readiness trả 503, xem nhóm `down`/`invalid` trong response và bảng lỗi.

### 2.2. Mở HTTPS bằng Cloudflare Quick Tunnel để thử local

Nếu đã có domain HTTPS của API đang hoạt động thì dùng domain đó và bỏ
phần tunnel. Với local:

1. Mở [Cloudflare — Downloads](https://developers.cloudflare.com/tunnel/downloads/).
2. Ở **Windows**, tải **Executable 64-bit** nếu máy dùng Windows x64.
3. Lưu file, ví dụ `C:\Tools\cloudflared\cloudflared.exe`; đổi tên file tải
   về thành `cloudflared.exe` nếu cần. Đây là chương trình tunnel riêng,
   không phải dependency của workspace.
4. Trong terminal B chạy:

```powershell
& 'C:\Tools\cloudflared\cloudflared.exe' tunnel --url http://localhost:3000
```

5. Lấy URL HTTPS `https://...trycloudflare.com` mà terminal in ra.
6. Mở một terminal khác hoặc trình duyệt, truy cập URL đó kèm
   `/api/v1/internal/health/live`. Phải nhận JSON `status: ok`.
7. Giữ terminal tunnel mở trong suốt lần kiểm thử.

Quick Tunnel không cần tài khoản/domain riêng, có URL tạm và dành cho
phát triển/kiểm thử. URL có thể đổi khi chạy lại; khi đó phải cập nhật các
URL ở bước 3 và đăng ký lại webhook ở bước 4. Nguồn:
[Cloudflare — Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

Không đặt trang đăng nhập tương tác trước webhook: payOS phải POST tới
route này trực tiếp. Route tự xác minh chữ ký payOS.

## 3. Điền env, bật payments và khởi động lại API

Trong `.env.local` root, cập nhật từng biến sau. Thay `YOUR-PUBLIC-HOST`
bằng hostname HTTPS từ bước 2 và thay ba key bằng giá trị của kênh thu:

```dotenv
PAYMENTS_ENABLED=true
PAYMENT_PROVIDER=payos
PAYOS_CLIENT_ID=<client-id-cua-cung-kenh>
PAYOS_API_KEY=<api-key-cua-cung-kenh>
PAYOS_CHECKSUM_KEY=<checksum-key-cua-cung-kenh>
PAYOS_BASE_URL=https://api-merchant.payos.vn
PAYOS_RETURN_URL=https://YOUR-PUBLIC-HOST/api/v1/internal/health/live
PAYOS_CANCEL_URL=https://YOUR-PUBLIC-HOST/api/v1/internal/health/live
WORKER_API_BASE_URL=http://localhost:3000
HEALTH_READINESS_TIMEOUT_MS=5000
```

Hai URL quay về dùng health route ở trên là lựa chọn **tạm để thử API**:
trình duyệt sẽ thấy JSON, không phải màn hình thanh toán. Repo chưa có trang
`/payment/return` hoặc `/payment/cancel`. Khi tích hợp client, thay bằng
trang/đường dẫn xử lý quay về thực sự có trong ứng dụng; đổi domain mẫu
không tự tạo trang.

| Địa chỉ | Dùng cho | Phải public? |
| --- | --- | --- |
| `https://YOUR-PUBLIC-HOST/api/v1/payments/webhooks/payos` | payOS gọi backend để báo giao dịch | Có |
| `PAYOS_RETURN_URL`, `PAYOS_CANCEL_URL` | Trình duyệt quay về sau checkout | Truy cập được từ thiết bị đang thanh toán |
| `WORKER_API_BASE_URL` | Script gọi các worker route của API | Có thể là localhost nếu worker chạy cùng máy |
| `PAYOS_BASE_URL` | Backend gọi merchant API của payOS | Giữ endpoint payOS chính thức |

1. Lưu file. Không để hai dòng cùng tên biến với giá trị mâu thuẫn.
2. Kiểm tra xem biến đó có bị đặt khác trong `apps/api/.env.local` hoặc
   môi trường tiến trình không; nơi có ưu tiên cao hơn sẽ được sử dụng.
3. Dừng API bằng `Ctrl+C` trong terminal A rồi chạy lại lệnh ở bước 2.1.
4. Chạy lại readiness. Nhóm `payments` phải là `configured`; tổng thể phải
   là `ready` sau khi các nhóm khác cũng hợp lệ.

Đặt chính xác `PAYMENTS_ENABLED=true` dạng chữ thường để API và script
worker cùng hiểu cấu hình. Chỉ xác nhận webhook ở bước tiếp theo khi đã
điền đủ key/URL, bật payments và restart API.

Khi triển khai lên host, điền các biến trong cấu hình của host rồi restart
ứng dụng; `.env.local` trên máy không tự được gửi lên host. API và worker
phải dùng cùng `INTERNAL_WORKER_SECRET`, không điền secret đó vào client.

## 4. Đăng ký và kiểm tra webhook payOS

URL cần đăng ký là:

```text
https://YOUR-PUBLIC-HOST/api/v1/payments/webhooks/payos
```

Đây là route **POST**, không phải return URL. Mở URL webhook bằng trình
duyệt gửi GET có thể thấy 405; điều đó không kiểm chứng webhook hỏng.

### 4.1. Cách dùng dashboard

1. Mở chi tiết đúng kênh thanh toán trên payOS.
2. Tìm trường `webhookURL`, nhập URL đầy đủ ở trên.
3. Thực hiện thao tác lưu/xác nhận theo dashboard.
4. Nếu không thấy trường hoặc cần kiểm tra rõ response, dùng cách API sau.

### 4.2. Cách dùng Postman hoặc HTTP client tương đương

Thao tác này đăng ký hoặc **thay URL webhook của kênh đang dùng**. Chọn kênh
thu dành cho lần thử trước khi gửi, tránh thay URL của kênh đang phục vụ
một hệ thống khác.

1. Tạo request `POST https://api-merchant.payos.vn/confirm-webhook`.
2. Chọn **Authorization: No Auth** cho request này; nó không dùng JWT của
   khách/thợ CareOnRoad.
3. Thêm headers:

```text
x-client-id: <PAYOS_CLIENT_ID-cua-kenh>
x-api-key: <PAYOS_API_KEY-cua-kenh>
Content-Type: application/json
```

4. Chọn **Body → raw → JSON**, nhập:

```json
{
  "webhookUrl": "https://YOUR-PUBLIC-HOST/api/v1/payments/webhooks/payos"
}
```

5. Chọn **Send**. Không gửi key/response chứa thông tin ngân hàng vào chat
   hoặc đưa vào file tài liệu/collection được commit.

**Kết quả cần thấy:** HTTP 200 và `code: "00"`. payOS gửi dữ liệu mẫu có
chữ ký tới URL để xác nhận trước khi thêm/cập nhật webhook. Nguồn:
[payOS API — Kiểm tra và thêm/cập nhật webhook](https://payos.vn/docs/api/).

Mẫu kiểm tra có thể không khớp order thật trong CareOnRoad; backend trả
`matched: false`/`ignored` nhưng vẫn chấp nhận request hợp lệ. Không tạo
order giả chỉ để mẫu này khớp. Backend kiểm tra chữ ký bằng checksum key;
request tự dựng thiếu chữ ký bị từ chối là hành vi đúng.

Nếu lỗi: 400 kiểm tra URL/tunnel, 401 kiểm tra key của cùng kênh và chữ ký,
5xx kiểm tra API đang chạy và cấu hình/database. Xem thêm bảng lỗi cuối
file. Webhook cần nhận phản hồi 2xx để payOS ghi nhận đã gửi thành công.
Nguồn: [payOS — Webhook thông tin thanh toán](https://payos.vn/docs/du-lieu-tra-ve/webhook/).

Return/cancel URL có query trạng thái do payOS gắn vào, nhưng hệ thống này
chỉ xác nhận tiền qua webhook có chữ ký hoặc đối soát provider. Khi thử
bằng health route, đọc trạng thái thật bằng API order/payment-summary ở
bước 7. Nguồn về redirect:
[payOS — Return URL](https://payos.vn/docs/du-lieu-tra-ve/return-url/).

## 5. Chạy worker và thiết lập tự chạy trên Windows

### 5.1. Kiểm tra rồi chạy một lượt

Mở **terminal C** tại root repo. API và tunnel tiếp tục chạy:

```powershell
Set-Location 'D:\fpt\subject\EXE101\CareOnRoad-mobile-break'
node apps/api/scripts/run-payment-workers.mjs --check
```

**Kết quả cần thấy:** các trường sau đều là `true`:

```json
{
  "worker_secret_configured": true,
  "payments_enabled": true,
  "payment_configuration_complete": true
}
```

`--check` chỉ kiểm tra cấu hình local, chưa gọi API hay kiểm chứng key payOS.
Tiếp tục:

```powershell
node apps/api/scripts/run-payment-workers.mjs
```

**Kết quả cần thấy:** có dòng kết quả cho `outbox/run`, `dispatch/run`,
`payments/reconcile`, HTTP thành công và `ok: true`. Khi chưa có việc cần
xử lý, các số đếm bằng 0 là bình thường.

Nếu HTTP 401, API và script có thể đang dùng worker secret khác nhau. Nếu
kết nối thất bại, kiểm tra API/port và `WORKER_API_BASE_URL`. Base URL chỉ
là origin, ví dụ `http://localhost:3000`, không thêm `/api/v1` hoặc query.

### 5.2. Chạy liên tục trong lúc thử

```powershell
node apps/api/scripts/run-payment-workers.mjs --watch
```

Script chạy lần lượt outbox, dispatch, payment reconciliation, rồi đợi
30 giây **sau khi vòng đó kết thúc**. Vì request có thể chậm, đây không phải
cam kết mỗi 30 giây có một lần xử lý. Reconciliation chỉ lấy đơn stale ít
nhất hai phút; không thấy cập nhật ngay sau chuyển tiền chưa chứng minh lỗi.
Payments tắt thì script bỏ qua reconciliation; outbox và dispatch vẫn chạy.

Dùng `Ctrl+C` để dừng. Đóng terminal hoặc tắt máy cũng dừng worker. Các lệnh
pnpm tương đương là `pnpm.cmd run workers:payments` và
`pnpm.cmd run workers:payments:watch`.

### 5.3. Tự chạy khi đăng nhập Windows bằng Task Scheduler

Chỉ làm sau khi chạy một lượt thành công:

1. Trong PowerShell, chạy lệnh sau và ghi lại đường dẫn `node.exe`:

```powershell
(Get-Command node).Source
```

2. Mở Start, tìm **Task Scheduler**, chọn **Create Task**.
3. **General:** đặt tên `CareOnRoad Payment Workers`. Để thử trên máy cá
   nhân, chọn **Run only when user is logged on**.
4. **Triggers → New:** chọn **At log on**, chọn tài khoản Windows của bạn.
5. **Actions → New → Start a program:**

| Trường | Giá trị |
| --- | --- |
| Program/script | Đường dẫn thật tới `node.exe` từ bước 1 |
| Add arguments | `"D:\fpt\subject\EXE101\CareOnRoad-mobile-break\apps\api\scripts\run-payment-workers.mjs" --watch` |
| Start in | `D:\fpt\subject\EXE101\CareOnRoad-mobile-break` |

6. **Settings:** đặt **If the task is already running → Do not start a new
   instance**; bật restart khi task thất bại nếu cần. Bỏ giới hạn **Stop the
   task if it runs longer than...** nếu muốn worker chạy liên tục.
7. **Conditions:** kiểm tra điều kiện nguồn điện/sleep để phù hợp cách dùng
   laptop. Máy sleep thì không phục vụ API/worker liên tục.
8. Lưu, chọn task rồi **Run**. Kiểm tra trạng thái task và worker-run
   monitoring bằng tài khoản admin.
9. Dừng bản `--watch` trong terminal C nếu task đã chạy, tránh hai runner
   không cần thiết trên cùng máy.

**At log on** chỉ chạy sau khi đăng nhập; không tương đương chạy ngay lúc
máy khởi động. Task này chỉ chạy worker, không tự khởi động API hoặc tunnel.
Máy/host phục vụ thật cần tiến trình API, HTTPS ổn định và worker được quản
lý như service. Tài liệu này không tự đăng ký task hay triển khai server.
Nguồn: [Microsoft — Task Scheduler / schtasks create](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/schtasks-create),
[Microsoft — Scheduled task settings](https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/new-scheduledtasksettingsset?view=windowsserver2025-ps).

## 6. Tạo database riêng cho integration tests

Unit tests dùng provider giả và không kiểm chứng chuyển tiền thật. DB tests
kiểm tra repository, transaction và migrations, cần database riêng.

1. Mở [Supabase Dashboard](https://supabase.com/dashboard), tạo project mới
   chỉ dùng cho integration tests; ghi rõ tên như `careonroad-integration-test`.
2. Chọn database password và đợi project sẵn sàng.
3. Ở project **test mới**, chọn **Connect → Session pooler**, lấy PostgreSQL
   connection string được dashboard cung cấp. Không tự ghép host từ region.
4. Thay phần password bằng password database của project test. Nếu password
   có ký tự dành riêng trong URL, percent-encode phần password đó.
5. Chỉ cập nhật các biến sau trong `.env.local`; giữ `DATABASE_URL`,
   `SUPABASE_URL` và các key của app trỏ về project dev/test app hiện tại:

```dotenv
TEST_DATABASE_URL=<connection-string-cua-project-test-rieng>
TEST_DATABASE_CONFIRMED=true
```

6. So sánh project reference của hai project trong dashboard: phải khác
   nhau. Cờ `TEST_DATABASE_CONFIRMED` dùng cho DB có tên mặc định `postgres`;
   không cho phép dùng chung DB app. Đổi password/port/pooler của cùng
   project không tạo thành database test riêng.
7. Chạy từ root:

```powershell
pnpm.cmd run test:db
```

Nếu pnpm bootstrap gặp lỗi nhưng dependencies đã có, chạy:

```powershell
Set-Location 'D:\fpt\subject\EXE101\CareOnRoad-mobile-break\apps\api'
node scripts/run-tests.mjs db
```

**Kết quả cần thấy:** suite PostgreSQL chạy và báo kết quả passed/failed;
không chỉ skipped vì thiếu URL. Hosted DB có thể mất nhiều phút. Helpers
của repo tạo schema test riêng và cleanup; một số test cần `auth.users`
và `auth.uid()`, nên project Supabase riêng là lựa chọn phù hợp.

Session pooler hỗ trợ IPv4. Direct connection phù hợp nếu mạng hỗ trợ
IPv6 hoặc project có IPv4 add-on. Không chọn Transaction pooler cho suite
này vì helpers sử dụng trạng thái session/search path. Nguồn:
[Supabase — Connect to your database](https://supabase.com/docs/guides/database/connecting-to-postgres).

Không cần bật payment thật để chạy unit tests:

```powershell
pnpm.cmd test
```

## 7. Kiểm thử luồng cứu hộ qua API, không cần sửa mobile/web

payOS **không có sandbox**: chuyển khoản để thử là chuyển tiền thật. Dùng
số tiền nhỏ và các tài khoản bạn quản lý; kiểm tra ngân hàng nhận đúng trước
khi xác nhận luồng thành công. Nguồn:
[payOS — Môi trường test](https://payos.vn/docs/moi-truong-test/).

Các bước sau dùng Postman hoặc HTTP client đang có. Ví dụ dùng tiền công
10.000 đồng, phụ tùng 2.000 đồng. Các ID trong `<...>` phải thay bằng UUID
API trả về; không gửi placeholder nguyên văn. Hợp đồng workflow đầy đủ ở
[RESCUE-WORKFLOW.md](./RESCUE-WORKFLOW.md).

### 7.1. Lấy token và chuẩn bị dữ liệu

Nếu đã có access token từ luồng đăng nhập hiện tại, dùng token đó. Nếu
thử tài khoản email/password bằng Postman:

1. Tạo `POST https://YOUR-APP-SUPABASE-PROJECT.supabase.co/auth/v1/token?grant_type=password`.
2. Chọn No Auth, thêm header `apikey` bằng **publishable key/anon key của
   project app**, và `Content-Type: application/json`.
3. Body raw JSON:

```json
{
  "email": "<email-tai-khoan-test>",
  "password": "<mat-khau-tai-khoan-test>"
}
```

4. Dùng `access_token` của response làm Bearer token. Làm riêng cho khách,
   thợ và admin nếu cần. Không dùng service-role key làm token người dùng.
   Nếu project bật CAPTCHA/MFA, đăng nhập theo luồng hiện có để lấy session
   hợp lệ thay vì bỏ qua yêu cầu xác thực.
5. Với từng token, gọi `GET http://localhost:3000/api/v1/auth/me`, kiểm tra
   account active và role đúng. Nếu chưa có app profile, dùng
   `PATCH /api/v1/auth/profile` với `{"account_type":"rider"}` hoặc
   `{"account_type":"mechanic"}` theo tài khoản. Role admin cần được cấp
   theo luồng quản trị hiện có, không có lựa chọn tự đăng ký admin.

Nguồn xác thực: [Supabase — Password-based Auth](https://supabase.com/docs/guides/auth/passwords)
và [Supabase Auth — API token](https://github.com/supabase/auth#post-token).
Không lưu password/JWT vào collection được chia sẻ hoặc commit.

Với các API CareOnRoad bên dưới, ghép đường dẫn `/api/v1/...` vào base URL
`http://localhost:3000` (hoặc đúng host/port của API bạn đang chạy), rồi thêm:

```text
Authorization: Bearer <access-token-dung-actor>
Content-Type: application/json
```

Tạo service request và payment order cần thêm
`X-Idempotency-Key: <key-duy-nhat-8-den-200-ky-tu>`. Retry cùng thao tác
phải dùng lại **cùng key và payload**; thao tác mới dùng key mới. Tạo UUID
làm key bằng PowerShell nếu cần:

```powershell
[guid]::NewGuid().ToString()
```

Chuẩn bị một xe thuộc khách bằng `GET /api/v1/motorcycles`; nếu chưa có,
tạo `POST /api/v1/motorcycles` với:

```json
{"brand_text":"Honda","model_text":"Wave"}
```

Thợ phải có profile đã được duyệt, không có việc active, và đủ điều kiện
cứu hộ. Nếu profile còn `pending`, admin lấy `user_id` của thợ từ
`GET /api/v1/admin/mechanics`, gọi
`POST /api/v1/admin/mechanics/<mechanicId>/approve` với key idempotency mới
và body `{"reason":"Duyet tai khoan tho de kiem thu cuu ho"}`. Trong API
này `mechanicId` là `user_id` của thợ, không phải ID profile. Profile đã
active không cần duyệt lại.

Dùng token thợ thực hiện:

| API | Body |
| --- | --- |
| `PATCH /api/v1/mechanics/me/profile` | `{"service_radius_km":12,"service_types":["emergency_rescue"]}` |
| `PUT /api/v1/mechanics/me/availability` | `{"is_available":true}` |
| `PUT /api/v1/mechanics/me/location` | `{"latitude":10.7769,"longitude":106.7009}` |

Tọa độ trên chỉ là fixture kiểm thử. Địa điểm yêu cầu bên dưới đặt gần đó
để tìm được thợ. Vị trí thợ cần được cập nhật trong 5 phút trước dispatch;
nếu thao tác chuẩn bị lâu, cập nhật lại location. Cập nhật profile không
thay thế bước duyệt thợ của admin.

### 7.2. Tạo yêu cầu, nhận việc và báo tiền công

1. **Khách:** `POST /api/v1/service-requests`, thêm idempotency key mới:

```json
{
  "motorcycle_id": "<motorcycleId-cua-khach>",
  "service_type": "emergency_rescue",
  "problem_description": "Xe khong no may, can cuu ho thu nghiem",
  "location": {"latitude":10.7770,"longitude":106.7010}
}
```

2. Lưu `requestId` từ response; khách gọi
   `POST /api/v1/service-requests/<requestId>/dispatch`.
3. **Thợ:** `GET /api/v1/dispatch/offers`, chọn offer thuộc request này,
   gọi `POST /api/v1/dispatch/offers/<offerId>/accept` khi offer còn hạn.
4. Lưu `assignmentId`; thợ gửi
   `POST /api/v1/service-requests/<requestId>/quotes`:

```json
{
  "assignment_id": "<assignmentId>",
  "purpose": "rescue_labor",
  "labor_pricing": {
    "base_amount": 10000,
    "distance_amount": 0,
    "weather_amount": 0,
    "time_amount": 0,
    "weather": "sunny"
  }
}
```

5. Lưu `laborQuoteId`. Tổng tiền công phải là 10.000. Thợ nhập từng khoản;
   backend cộng tổng và khóa tiền công sau khi khách đồng ý. Các khoản 0
   trong ví dụ nhằm làm phép tính dễ kiểm tra, không phải bảng giá cố định.

Báo giá tiền công mặc định hết hạn sau 10 phút nếu chưa duyệt. Nếu thao tác
thử mất quá lâu, thợ gửi bản báo giá mới và khách duyệt đúng bản mới nhất.

Nếu không có offer, kiểm tra profile active, kỹ năng cứu hộ, availability,
vị trí mới, bán kính và active assignment của thợ. Không bỏ qua dispatch
bằng cách tự chèn assignment vào DB.

### 7.3. Nhánh A — Trả tiền công trước

1. **Khách:** `POST /api/v1/quotes/<laborQuoteId>/approve`:

```json
{"payment_timing":"labor_upfront"}
```

2. **Thợ:** thử gọi `POST /api/v1/assignments/<assignmentId>/status` với
   `{"status":"en_route"}` khi chưa trả tiền. Phải bị chặn 409.
3. **Khách:** `POST /api/v1/payments/orders`, thêm idempotency key mới:

```json
{"quote_id":"<laborQuoteId>"}
```

4. Lưu `paymentOrderId` và `provider_order_code`; `amount` phải là 10.000.
   Mở `checkout_url`, quét QR và thanh toán đúng số tiền/nội dung hiển thị.
   Nếu response khôi phục không có `qr_code`, vẫn mở `checkout_url` để xem QR.
5. Khách gọi `GET /api/v1/payments/orders/<paymentOrderId>` cho tới khi
   `status: succeeded`. Webhook xử lý trước; worker là đường đối soát dự phòng.
6. **Thợ:** lần lượt gọi status với `en_route`, `on_site`, `diagnosis`.
7. Tiếp tục bước 7.5. Sau sửa chỉ còn phải thu 2.000 tiền phụ tùng.

### 7.4. Nhánh B — Trả sau khi sửa xong

Tạo **request/assignment mới** theo bước 7.2; không đổi lựa chọn của nhánh A
đã được khách duyệt.

1. **Khách:** `POST /api/v1/quotes/<laborQuoteId>/approve`:

```json
{"payment_timing":"after_repair"}
```

2. Thử tạo payment order cho `laborQuoteId`: phải bị chặn 409 vì nhánh này
   không thu tiền công trước.
3. **Thợ:** chuyển lần lượt `en_route`, `on_site`, `diagnosis`.
4. Tiếp tục bước 7.5. Sau sửa thu một khoản 12.000 gồm công và phụ tùng.

### 7.5. Duyệt phụ tùng, sửa xong rồi thu phần còn lại

1. **Thợ:** tại trạng thái `diagnosis`, tạo báo giá cuối:

```text
POST /api/v1/service-requests/<requestId>/quotes
```

```json
{
  "assignment_id": "<assignmentId>",
  "purpose": "rescue_final",
  "lines": [
    {"line_type":"part","description":"Phu tung test","quantity":1,"unit_amount":2000}
  ]
}
```

2. Lưu `finalQuoteId`; tổng báo giá phải là 12.000 vì backend tự thêm tiền
   công 10.000 đã chốt. Không gửi lại dòng công trong `lines`.
3. **Khách:** `POST /api/v1/quotes/<finalQuoteId>/approve` với body `{}`.
4. **Thợ:** gọi status `{"status":"in_progress"}`. Khách thử tạo payment
   order cho báo giá cuối lúc này: phải bị chặn, vì chưa sửa xong.
5. Khi sửa xong, thợ gọi status `{"status":"awaiting_payment"}`.
6. Khách/thợ đọc
   `GET /api/v1/service-requests/<requestId>/payment-summary`:

| Nhánh | `total_amount` | `paid_amount` | `remaining_amount` |
| --- | ---: | ---: | ---: |
| Công đã trả trước | 12000 | 10000 | 2000 |
| Trả sau | 12000 | 0 | 12000 |

7. **Khách:** tạo payment order với key mới và body
   `{"quote_id":"<finalQuoteId>"}`. `amount` phải bằng `remaining_amount`,
   mở checkout và thanh toán.
8. GET order tới `succeeded`; payment-summary phải có `paid_amount: 12000`,
   `remaining_amount: 0`.
9. **Thợ:** gọi status `{"status":"completed"}`. Nếu còn tiền chưa được
   xác nhận, bước này phải bị chặn.
10. Kiểm tra `GET /api/v1/notifications` của khách/thợ và đối chiếu ngân hàng.
    Không chỉ dựa vào query `status=PAID` trên URL quay về.

### 7.6. Những trường hợp cần kiểm tra thêm

| Trường hợp | Thao tác | Kết quả cần thấy |
| --- | --- | --- |
| Trả công trước, không phụ tùng | Báo `rescue_final` với `lines: []`, duyệt, sửa xong | Tổng 10000, đã trả 10000, còn 0; không tạo order 0 đồng, có thể completed |
| Retry tạo order | Gửi lại cùng key/payload trong cửa sổ idempotency | Cùng order và mã payOS, không tạo khoản thu mới |
| Báo giá đã trả | Gửi tạo order với key mới cho quote đã succeeded | Bị chặn thu lại |
| Đóng trình duyệt sau chuyển tiền | Không chờ trang quay về; kiểm tra GET order | Webhook/worker vẫn xác nhận khi đủ dữ liệu hợp lệ |
| Hủy chưa chuyển tiền | Khách gọi `POST /api/v1/payments/orders/<paymentOrderId>/cancel` | Không coi là succeeded; đối chiếu trạng thái provider |
| Từ chối tiền công | Khách gọi `/quotes/<laborQuoteId>/reject` trước khi duyệt | Assignment cũ được kết thúc, outbox/dispatch tìm thợ khác |
| Mời lại thợ đã từ chối | Khi chưa có assignment active, gọi `/service-requests/<requestId>/rescue-mechanics/<mechanicId>/recall` | Offer mới nếu thợ đủ điều kiện; không phục hồi báo giá cũ |
| Khoản thiếu/thừa/trả muộn | Nếu phát sinh thực tế, xem review queue | Không tự ghi đã trả đủ; xử lý theo bước 9 |

Không cần cố ý tạo chuyển khoản thiếu/thừa để kiểm thử đầu tiên. Các nhánh
lỗi có unit tests; với khoản thật đã phát sinh, giữ review và đối chiếu.

## 8. Firebase push — làm khi cần kiểm chứng thông báo trên thiết bị

Notification inbox backend hoạt động độc lập với push. Chưa có FCM không
ngăn webhook xác nhận thanh toán; để thử push cần service account và token
thiết bị thật của đúng Firebase project.

1. Mở [Firebase Console](https://console.firebase.google.com), chọn project
   đang dùng cho app nhận push.
2. Vào **Project settings → Service accounts**, chọn **Generate new private
   key**, xác nhận và lưu JSON ở nơi riêng ngoài repo.
3. Mở JSON bằng editor. Ánh xạ các trường sau vào `.env.local`:

| Trường JSON | Biến backend |
| --- | --- |
| `project_id` | `FCM_PROJECT_ID` |
| `client_email` | `FCM_CLIENT_EMAIL` |
| `private_key` | `FCM_PRIVATE_KEY` |

4. Điền cả ba biến trong cùng lần cấu hình. Với `FCM_PRIVATE_KEY`, giữ PEM
   đầy đủ trong dấu nháy và dùng `\n` giữa các dòng; adapter hiện tại chuyển
   chuỗi `\n` thành xuống dòng. Không thay bằng dấu cách hoặc chỉ copy một
   phần key. Block dưới chỉ minh họa định dạng:

```dotenv
FCM_PROJECT_ID=<project-id>
FCM_CLIENT_EMAIL=<client-email>
FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n<noi-dung-key>\n-----END PRIVATE KEY-----\n"
```

5. Giữ `PUSH_TOKEN_ENCRYPTION_KEY` hiện có. Backend dùng key này mã hóa token
   đã lưu; thay key tùy ý sẽ làm credential cũ không giải mã được. Nếu chưa
   có, cần cấu hình key 32 byte mã hóa base64 trước khi đăng ký push token.
6. Restart API, kiểm tra readiness `notifications: configured`.
7. Lấy FCM registration token của thiết bị từ client đã cấu hình Firebase.
   Token phải thuộc cùng project với service account; nó khác Supabase JWT
   và Firebase private key. Nếu client chưa tạo được token thì phần push
   vẫn cần tích hợp client, ngoài phạm vi thay đổi hiện tại.
8. Dùng Bearer token của người nhận, gọi `POST /api/v1/auth/devices`:

```json
{
  "device_key": "<id-on-dinh-cua-thiet-bi-it-nhat-8-ky-tu>",
  "platform": "android",
  "push_provider": "fcm",
  "push_token": "<FCM-registration-token-thuc>"
}
```

9. Tạo sự kiện như báo giá/thanh toán ở bước 7, để outbox worker chạy, rồi
   kiểm tra inbox và thông báo trên thiết bị. Inbox có thông báo chưa chứng
   minh push đã được giao; nếu không nhận, kiểm tra token/project, quyền
   thông báo của thiết bị và lỗi provider trong monitoring.

Nguồn: [Firebase — Authorize HTTP v1 requests / service account](https://firebase.google.com/docs/cloud-messaging/send/v1-api).
Repo đang đọc ba biến FCM kể trên bằng adapter riêng; chỉ đặt
`GOOGLE_APPLICATION_CREDENTIALS` theo ví dụ SDK trong docs không tự cấu hình
adapter này. Không cần cài Firebase Admin SDK để làm các bước backend này.

## 9. Admin xử lý đơn `needs_review`

Khi gặp `needs_review`, không yêu cầu khách chuyển lại ngay. Admin thực hiện:

1. Đăng nhập bằng user có role admin, gọi
   `GET /api/v1/admin/operations/payments-needs-review`.
2. Xác định `paymentOrderId`, mã provider, số tiền, quote/assignment liên
   quan; đối chiếu payOS và ngân hàng trong công cụ quản trị của chủ tài khoản.
3. Nếu cần ghi nhận khoản đến muộn, gọi:

```text
POST /api/v1/admin/payments/orders/<paymentOrderId>/resolve
Authorization: Bearer <admin-access-token>
X-Idempotency-Key: <key-moi-8-den-200-ky-tu>
Content-Type: application/json
```

```json
{
  "action": "confirm_received",
  "reason": "Da doi chieu khoan thanh toan den muon voi payOS va ngan hang"
}
```

4. Backend đọc lại payOS. Chỉ xác nhận đúng mã/link, đúng và đủ tiền, quote
   còn hiệu lực, chưa thu thành công lần khác và không có link thay thế active.
5. Với đơn provider đã kết thúc và `amountPaid=0`, có thể dùng
   `{"action":"close_unpaid","reason":"Da xac minh don da ket thuc va chua nhan tien"}`.
6. Đọc lại order, summary và review queue để kiểm tra kết quả.

Lý do dài 10–500 ký tự; audit lưu hash lý do. Nếu resolve trả conflict,
đọc lý do và điều kiện chưa đủ, không sửa DB để ép succeeded.

Nếu có link thay thế active, kiểm tra/hủy link đó qua API của khách trước
khi xử lý khoản cũ; nếu link đó cũng nhận tiền, tiếp tục giữ review. Khoản
thiếu/thừa/trùng cần đối chiếu ngân hàng và quyết định vận hành. Repo chưa
có refund, payout hoặc API xác nhận hoàn tiền thủ công.

Admin cũng có thể xem:

```text
GET /api/v1/admin/operations/worker-runs
GET /api/v1/admin/operations/outbox-dead-letters
GET /api/v1/admin/operations/dispatch-stuck
```

Đây là read models; không có giao diện admin thanh toán được bổ sung trong
phạm vi hiện tại.

## 10. Tra lỗi theo kết quả đang thấy

| Triệu chứng | Kiểm tra và cách xử lý |
| --- | --- |
| API không chạy / port bị chiếm | Dùng port terminal thực tế; đổi cả tunnel, worker base URL và địa chỉ test; không chạy hai API cùng port |
| Readiness `database: down` | Kiểm tra đúng connection string/password, project không pause, mạng/IPv4; đặt timeout 5000 nếu kết nối hosted chậm |
| Readiness `payments: invalid` | Điền đủ nhóm payment, bật `true`, restart; key được điền khi payments tắt cũng bị đánh invalid |
| Readiness `notifications: invalid` | Điền đủ cả ba biến FCM hoặc để cả nhóm chưa cấu hình nếu chưa dùng push |
| Env sửa nhưng không tác dụng | Kiểm tra env tiến trình/file API có ưu tiên cao hơn; restart API và worker |
| Confirm webhook 400 | Kiểm tra HTTPS public, route đúng, tunnel còn sống, không có trang đăng nhập/challenge chặn payOS |
| Confirm webhook 401 | Kiểm tra client/API key đúng kênh; nếu backend từ chối mẫu có chữ ký thì kiểm tra checksum key cùng kênh |
| Confirm webhook 5xx | Kiểm tra API/DB, payments đã bật và restart; gọi liveness public trước |
| GET webhook trả 405 | Webhook chỉ nhận POST; dùng confirm-webhook để kiểm chứng |
| Tạo order 401/403 | JWT còn hạn, đúng project, đúng actor; chỉ chủ yêu cầu tạo khoản thanh toán |
| Tạo order 409 | Quote phải là bản mới nhất đã duyệt, đúng giai đoạn thu, có số dư; kiểm tra review/đơn active và idempotency |
| Đã chuyển tiền nhưng order pending | Đối chiếu mã/số tiền ở payOS; kiểm tra webhook, giữ API/worker chạy, chờ đủ ngưỡng stale rồi reconciliation |
| Worker HTTP 401 | API/worker phải đọc cùng INTERNAL_WORKER_SECRET; kiểm tra env ưu tiên và restart |
| Worker `worker_request_failed` | API/port/base URL có thể sai hoặc request timeout; chạy liveness local rồi thử một lượt lại |
| Worker có `retried`/`deadLettered`/`failed` | Xem các queue admin; không coi chỉ HTTP 200 là xử lý xong |
| DB test báo separate database | Tạo project test thật sự khác; flag confirmed không bỏ qua guard này |
| DB test lỗi authentication/URL | Lấy đúng Connect string của project test, đúng DB password, percent-encode password; không dùng publishable key làm password |
| DB test chỉ skipped | Kiểm tra TEST_DATABASE_URL được loader đọc và dùng lệnh test:db thay vì pnpm test |
| Không có offer thợ | Profile đã duyệt, available, skill/radius/location mới và không có assignment active |
| Không nhận push | Kiểm tra service account/token cùng project, quyền thông báo thiết bị, outbox và provider; inbox không chứng minh giao push |
| Trang quay về 404 | Repo chưa có trang payment return/cancel; thử API bằng URL health tạm ở bước 3, sau này tích hợp route client thực |
| Task Scheduler chạy nhưng không xử lý | Worker cần API đang chạy; task không tự mở API/tunnel; kiểm tra secret/config mà tài khoản chạy task đọc |

Khi nhờ kiểm tra lỗi, chỉ cung cấp HTTP status, mã lỗi và tên biến thiếu.
Không gửi key, DB URL, password, JWT, token thiết bị hoặc JSON service account.

## 11. Checklist hoàn tất và phần cần làm tiếp

### Backend thanh toán đã được kiểm chứng khi

- [ ] API readiness hợp lệ, payments configured sau restart.
- [ ] payOS chấp nhận URL webhook của đúng kênh.
- [ ] Worker chạy được outbox, dispatch và payment reconciliation.
- [ ] Nhánh trả trước: 10.000 trước khi đi, 2.000 sau sửa; chưa trả công thì
  không được di chuyển.
- [ ] Nhánh trả sau: không thu trước; sau sửa thu 12.000.
- [ ] Không phụ tùng và đã trả công: còn 0, không tạo khoản thu thứ hai.
- [ ] Retry không tạo mã mới; quote đã trả không được thu lại.
- [ ] Chưa xác nhận đủ tiền thì không được completed.
- [ ] GET order/summary khớp payOS và tiền thực nhận ở ngân hàng.
- [ ] DB integration tests chạy trên project test riêng và có kết quả.

### Phần chưa tự hoàn tất bằng cấu hình

- **Mobile/web:** cần nối báo giá, chọn thời điểm trả, mở checkout, đọc
  order/summary và xử lý quay về. Hiện chưa sửa theo phạm vi đã chốt.
- **Push:** cần device token thật từ client; điền server key một mình chưa
  chứng minh thiết bị nhận thông báo.
- **Vận hành liên tục:** cần API/HTTPS/worker chạy ổn định trên host; Quick
  Tunnel và terminal local dùng để thử.
- **Tiền về thợ:** hiện thu về ngân hàng của một kênh payOS. Cần chốt mô hình
  thu trực tiếp hay qua nền tảng, phí và lịch trả thợ trước khi xây payout.
- **Hoàn tiền, settlement, hóa đơn:** chưa có implementation; cấu hình
  payOS không tự bổ sung những workflow này. Hủy order chưa thanh toán đã
  có API, nhưng không tương đương hoàn tiền một khoản đã nhận.
- **Tiền mặt/card:** backend hiện chưa có luồng xác nhận tiền mặt hoặc lưu
  thẻ; hai lựa chọn labor_upfront/after_repair là thời điểm thu, đều đang
  dùng payOS/VietQR.

Tài liệu này hướng dẫn thao tác của bạn; cập nhật tài liệu không đồng nghĩa
đã đăng ký webhook, tạo scheduler, chạy giao dịch thật hoặc triển khai host.
