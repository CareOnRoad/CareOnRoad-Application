# Backend qua Cloudflare Tunnel

Tên miền: `https://careonroad.dpdns.org`. Tunnel: `careonroad-api`.
Cloudflare nhận request HTTPS và chuyển qua Tunnel tới `http://127.0.0.1:3000`.
Backend chạy trên máy này; tắt máy hoặc dừng backend/Tunnel sẽ làm API mất kết nối.

DigitalPlat giữ đăng ký tên miền. DNS dùng `nadia.ns.cloudflare.com` và
`venkat.ns.cloudflare.com`, gói Cloudflare Free. Không cần mở cổng router.

## Chạy lại trên Windows

Build backend sau khi sửa code. Chạy từ thư mục gốc repo:

```powershell
Push-Location apps/api
node node_modules/next/dist/bin/next build
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3000
```

Mở terminal thứ hai tại thư mục gốc, giữ cả hai terminal chạy:

```powershell
./.cloudflare/cloudflared.exe tunnel run --token-file ./.cloudflare/tunnel-token
```

`Ctrl+C` dừng tiến trình trong từng terminal. Không chạy thêm bản backend nếu
cổng 3000 đang được sử dụng. Binary, token và log trong `.cloudflare/` được Git
bỏ qua; không chia sẻ hoặc commit token. Tải binary từ
[nguồn Cloudflare chính thức](https://developers.cloudflare.com/tunnel/downloads/).
Đổi token trong dashboard Tunnel nếu token bị lộ.

## Môi trường và kiểm tra

Backend hiện đọc `.env.local` tại thư mục gốc qua `next.config.ts`.
Các biến `OPENROUTER_SITE_URL`, `PAYOS_RETURN_URL`, `PAYOS_CANCEL_URL` dùng tên
miền mới. URL quay lại/hủy thanh toán hiện dùng endpoint health như cấu hình demo
cũ; endpoint này chỉ trả trạng thái server, không xác nhận thanh toán.
`WORKER_API_BASE_URL` vẫn dùng localhost khi worker chạy cùng máy.

```powershell
curl.exe --fail https://careonroad.dpdns.org/api/v1/internal/health/live
curl.exe --fail https://careonroad.dpdns.org/api/v1/internal/health/ready
curl.exe -i https://careonroad.dpdns.org/api/v1/auth/me
```

Liveness phải trả 200; auth phải trả 401 khi thiếu JWT. Readiness trả 503 nếu
cấu hình thiếu hoặc dependency/schema chưa sẵn sàng. Hiện các biến FCM chưa được
điền, nên readiness báo `notifications: invalid`; khóa mã hóa push hiện có được
giữ nguyên để bảo toàn dữ liệu thiết bị. Cần bổ sung `FCM_PROJECT_ID`,
`FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` từ Firebase trước khi dùng push notification.

Webhook payOS để cấu hình ở phía payOS khi cần:
`https://careonroad.dpdns.org/api/v1/payments/webhooks/payos`.
Tunnel không tự đổi cấu hình merchant hoặc chạy worker. Worker dùng script có
sẵn trong repo. API gốc `/` có thể trả 404 vì workspace API không có trang chủ.

Khi chuyển sang server khác, chạy backend và connector trên server đó, đổi
service URL của Tunnel nếu cổng thay đổi. Giữ token và `.env.local` ngoài Git.

## CORS — khi nào cần

Hiện tại BE **không có CORS middleware** (`apps/api/src/middleware.ts` chưa tồn tại,
không có `Access-Control-Allow-*` trong route handlers, không có env
`ALLOWED_ORIGINS`/`CORS_ORIGIN`). Điều này **chấp nhận được** vì toàn bộ client hiện
tại gọi BE từ server runtime (Next.js server components / server actions) hoặc từ
mobile (Expo Go / native), không phải từ browser cross-origin.

CORS chỉ thật sự cần khi **một trong các trigger** sau xuất hiện:

1. Web wire UI rider/mechanic thật (không phải mock) và cần gọi `/api/v1/**`
   trực tiếp từ browser (client component dùng `fetch`/`apiClient.*`).
2. Có client component nào trong `apps/web/src` bắt đầu gọi `fetch(...)` hoặc
   `apiClient.*` thay vì đi qua server runtime.
3. Có FE khác (mobile webview, Chrome extension, trang tĩnh ở domain khác)
   gọi thẳng từ browser vào BE.

Khi đó cần thực hiện:

- Tạo `apps/api/src/middleware.ts` (matcher `/api/:path*`).
- Đọc `ALLOWED_ORIGINS` (comma-separated origins) từ env, mirror header
  `Access-Control-Allow-Origin` cho origin khớp.
- Cho preflight `OPTIONS`: trả 204 với `Access-Control-Allow-Methods`,
  `Access-Control-Allow-Headers` (Authorization, Content-Type,
  X-Idempotency-Key, X-Worker-Secret), `Access-Control-Allow-Credentials: true`,
  `Access-Control-Max-Age: 600`.
- Thêm `ALLOWED_ORIGINS` vào `apps/api/.env.example` (placeholder) + `.env.local`
  (giá trị thật, gitignored).
- Verify preflight:
  ```powershell
  curl.exe -i -X OPTIONS -H "Origin: https://<domain-web-prod>" -H "Access-Control-Request-Method: GET" https://careonroad.dpdns.org/api/v1/internal/health/live
  ```
  Phải trả 204 với `Access-Control-Allow-*` headers.

Đến lúc đó mở task mới trong plan và làm theo spec trên.
## Docker trên server của người triển khai

`compose.yaml` chạy API; thêm `compose.tunnel.yaml` để chạy connector trong
cùng mạng Compose mặc định. Connector gọi API bằng `http://api:3000` qua tên
service `api`. `localhost` trong container connector là chính container đó.
API lắng nghe `0.0.0.0:3000` trong container; cổng trên host chỉ bind
`127.0.0.1` để kiểm tra tại server, tránh công khai API trực tiếp qua cổng 3000.

Người triển khai cần repo, cấu hình backend `.env.local` tại thư mục gốc,
và file riêng `.cloudflare/tunnel.env` chứa biến `TUNNEL_TOKEN`. File token
đã được chuẩn bị trên máy hiện tại từ `.cloudflare/tunnel-token`; chuyển riêng
cho người quản lý server bằng kênh bảo mật, không commit hay gửi trong log.
Không cần mật khẩu Cloudflare để chạy connector; người có quyền dashboard
vẫn cần chỉnh route. Compose chỉ nạp file token vào service `cloudflared`.

1. Đặt các file trên server, cấp quyền đọc file bí mật chỉ cho người triển khai
   (`chmod 600 .env.local .cloudflare/tunnel.env` trên Linux). Kiểm tra cấu hình
   bằng `docker compose -f compose.yaml -f compose.tunnel.yaml config --quiet`.
   Không dùng `config` không có `--quiet` vì nó có thể in các biến bí mật.
2. Build và chạy API trước:

   ```sh
   docker compose -f compose.yaml up -d --build api
   curl --fail http://127.0.0.1:3000/api/v1/internal/health/live
   ```

3. Khi API server đã sẵn sàng, phối hợp dừng connector Windows cũ trên máy
   hiện tại. Không giữ hai connector dùng cùng Tunnel nhưng trỏ tới các đích
   khác nhau: mọi replica nhận cùng cấu hình route từ Cloudflare.
4. Trong dashboard, chọn Tunnel `careonroad-api`, chỉnh published application
   cho hostname `careonroad.dpdns.org`: Type `HTTP`, URL `api:3000`.
5. Chạy connector và kiểm tra kết nối:

   ```sh
   docker compose -f compose.yaml -f compose.tunnel.yaml up -d
   docker compose -f compose.yaml -f compose.tunnel.yaml ps
   curl --fail https://careonroad.dpdns.org/api/v1/internal/health/live
   ```

   Dashboard cần báo Tunnel `Healthy`; liveness công khai phải trả 200.
   Kiểm tra readiness và schema theo checklist trước khi phát hành. Compose
   này không khởi chạy worker; worker thanh toán/reminder/outbox dùng quy trình
   hiện có, với cùng `INTERNAL_WORKER_SECRET` của API trên server.

Chưa chuyển route sang `api:3000` khi server chưa chạy: connector Windows
hiện tại dùng `127.0.0.1:3000`. Sau khi chuyển hoàn tất, API không còn phụ
thuộc máy cá nhân nhưng vẫn phụ thuộc server và Docker trên server đó.
