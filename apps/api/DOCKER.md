# Chạy backend/API bằng Docker

Backend nghiệp vụ, API `/api/v1/**` và chatbot `/api/chatbot/**` cùng chạy
trong `apps/api`, nên chỉ cần một image `careonroad-api:local`.
Image dùng Node.js 24 trên Debian, Next.js standalone, chạy bằng user `node`
và có sẵn model tiếng Việt cùng thư viện native sherpa-onnx cho ASR.
Dockerfile bật `NEXT_OUTPUT=standalone` khi build; build thông thường trên Windows
giữ cách chạy `next start` hiện tại.

## Build và chạy

Chạy tại thư mục gốc repository, với Docker Desktop ở chế độ Linux containers.
Nếu chưa có file cấu hình riêng cho API, tạo từ mẫu:

```powershell
Copy-Item apps/api/.env.example apps/api/.env.local
```

Điền `DATABASE_URL` và các biến `SUPABASE_*` trong `apps/api/.env.local` cho
project test/development. Nếu đang dùng `.env.local` ở thư mục gốc, có thể chọn
file đó bằng `$env:API_ENV_FILE = "./.env.local"`. Compose truyền biến vào lúc
chạy; file `.env*` không được gửi vào Docker build hay lưu trong image.

Giữ `SHERPA_ONNX_MODEL_DIR=./models/sherpa-onnx-zipformer-vi-30M-int8-2026-02-09`;
đường dẫn tuyệt đối trên Windows không dùng được trong container Linux.
PostgreSQL/Supabase tiếp tục chạy bên ngoài container. Nếu database chạy trên
máy host, dùng `host.docker.internal` thay cho `localhost` trong địa chỉ kết nối.

Trước khi dùng backend với database, xác minh migrations đến
`202606250046_dispatch_radius_policy_bounds.sql` theo
[schema release checklist](SCHEMA-RELEASE-CHECKLIST.md) và chạy
`pnpm.cmd run preflight:schema`. Docker không tự chạy migrations hoặc seed.

```powershell
docker compose build api
docker compose up -d api
docker compose ps
docker compose logs -f api
```

API mặc định tại `http://localhost:3000`. Đổi cổng host bằng
`$env:API_PORT = "3001"` trước khi chạy Compose. Với điện thoại thật, dùng IP LAN
của máy host và cổng đã chọn cho API base URL.
Khi triển khai, đặt HTTPS phía trước API: cookie sở hữu phiên chatbot có cờ
`Secure` trong production và cần HTTPS khi truy cập ngoài localhost.

## Kiểm tra

```powershell
curl.exe --fail http://localhost:3000/api/v1/internal/health/live
curl.exe --fail http://localhost:3000/api/v1/internal/health/ready
docker compose exec api node scripts/asr-smoke.mjs
```

Docker healthcheck dùng liveness; readiness còn kiểm tra database, schema và
cấu hình backend. Readiness trả 503 nếu thiếu cấu hình/schema hoặc database
không kết nối được. Chatbot mặc định lưu session trong memory; dùng
`CHATBOT_PERSISTENCE_MODE=postgres` để giữ session qua lần khởi động lại.

Worker chạy riêng theo lịch của hệ thống triển khai. Có thể chạy một lượt bằng
script hiện có trong container (cần `INTERNAL_WORKER_SECRET`):

```powershell
docker compose exec -e WORKER_API_BASE_URL=http://localhost:3000 api node scripts/run-payment-workers.mjs
```

## Dùng image trực tiếp hoặc chuyển sang máy khác

```powershell
docker build -t careonroad-api:local .
docker run -d --name careonroad-api --init --env-file apps/api/.env.local -p 3000:3000 careonroad-api:local
docker save -o careonroad-api.tar careonroad-api:local
```

Trên máy đích cùng kiến trúc CPU, nạp image bằng
`docker load -i careonroad-api.tar`, chuẩn bị file môi trường riêng và chạy lại
lệnh `docker run`. File tar chứa image, không chứa dữ liệu Supabase hoặc file
môi trường. Dùng các giá trị `KEY=value` một dòng với `docker run --env-file`;
Compose hỗ trợ cú pháp file dotenv và dấu nháy của cấu hình hiện có.

Dừng các container do Compose tạo:

```powershell
docker compose down
```

Tham khảo: [Next.js standalone](https://nextjs.org/docs/15/app/api-reference/config/next-config-js/output),
[Node.js Docker images](https://github.com/nodejs/docker-node/blob/main/README.md).
