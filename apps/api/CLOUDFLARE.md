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
