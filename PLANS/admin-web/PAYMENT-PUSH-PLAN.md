# Kế hoạch push backend thanh toán — chờ xác nhận

Ngày lập: 01/10/2026. Đây là bản đề xuất; chưa tạo nhánh, stage, commit hoặc push.

## Nhánh, commit và remote

- Nhánh mới đề xuất: `danh/payment-rescue-payos`.
- Tạo từ HEAD hiện tại của `Danh/google-auth`: `2f8a3a2415a53a75e26c8c068f475fc1bbcd9f7b`.
- Đã kiểm tra remote: `Danh/google-auth` trên GitHub đang ở đúng commit này. Nhánh mới kế thừa lịch sử Google auth và mobile workspace recovery đã có trên remote.
- Remote: [CareOnRoad/CareOnRoad-Application](https://github.com/CareOnRoad/CareOnRoad-Application).
- Một commit mới: `feat(api): complete rescue quote and payOS payment workflow`.
- Phạm vi commit mới: báo giá cứu hộ, lựa chọn trả công trước/trả sau sửa, thu phần còn lại, mời lại thợ, notification, payment recovery/admin review, worker, schema, tests và hướng dẫn setup.

## Các bước sau khi bạn xác nhận

1. Kiểm tra lại HEAD và nội dung các file đã duyệt để nhận biết thay đổi mới.
2. Tạo nhánh `danh/payment-rescue-payos` từ HEAD đã nêu.
3. Stage đúng 45 file trong danh sách bên dưới; kiểm tra diff staged và quét secret lần cuối.
4. Tạo một commit với thông điệp đã nêu.
5. Push nhánh mới lên `origin`, thiết lập upstream, rồi báo commit SHA và link nhánh.

```powershell
git switch -c danh/payment-rescue-payos
# git add chỉ dùng danh sách 45 file đã được duyệt bên dưới.
git diff --cached --stat
git commit -m "feat(api): complete rescue quote and payOS payment workflow"
git push -u origin danh/payment-rescue-payos
```

Push này đưa code lên nhánh GitHub; không tự triển khai server hoặc áp dụng migration cho môi trường khác.

## Kiểm tra đã hoàn thành

- API unit/static/route: 166 test files, 540 tests đạt trong lượt chuẩn bị này.
- API typecheck và lint: đạt.
- `git diff --check` cho phạm vi dự kiến: đạt.
- Đã quét 45 file, không phát hiện giá trị secret hiện có của các biến payment/DB/auth/worker/AI trong env.
- `.env.local`, state giao dịch thử và worker logs nằm trong phạm vi Git ignore.
- Nhánh trả sau: giao dịch thật 12.000đ đã được đối chiếu; payOS PAID, backend succeeded, remaining 0, assignment/request completed.
- Nhánh trả công trước chưa có giao dịch tiền thật; DB integration tests chưa chạy vì chưa có database test riêng.

## Danh sách file sẽ nằm trong commit mới

Tổng: **45 file** — **36 file sửa**, **9 file mới**. Các đường dẫn là link tới nội dung hiện tại trong workspace.

### Tài liệu (4 file)

- Sửa: [AGENTS.md](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/AGENTS.md)
- Mới: [apps/api/PAYMENT-SETUP.md](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/PAYMENT-SETUP.md)
- Sửa: [apps/api/README.md](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/README.md)
- Mới: [apps/api/RESCUE-WORKFLOW.md](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/RESCUE-WORKFLOW.md)

### Cấu hình và lệnh chạy (4 file)

- Sửa: [apps/api/.env.example](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/.env.example)
- Sửa: [apps/api/next.config.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/next.config.ts)
- Sửa: [apps/api/vitest.config.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/vitest.config.ts)
- Sửa: [package.json](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/package.json)

### API routes mới (3 file)

- Mới: [apps/api/app/api/v1/admin/payments/orders/[paymentOrderId]/resolve/route.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/app/api/v1/admin/payments/orders/[paymentOrderId]/resolve/route.ts)
- Mới: [apps/api/app/api/v1/service-requests/[requestId]/payment-summary/route.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/app/api/v1/service-requests/[requestId]/payment-summary/route.ts)
- Mới: [apps/api/app/api/v1/service-requests/[requestId]/rescue-mechanics/[mechanicId]/recall/route.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/app/api/v1/service-requests/[requestId]/rescue-mechanics/[mechanicId]/recall/route.ts)

### Workflow và services (14 file)

- Sửa: [apps/api/src/features/assignments/assignment-state.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/assignments/assignment-state.ts)
- Sửa: [apps/api/src/features/assignments/assignment.service.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/assignments/assignment.service.ts)
- Sửa: [apps/api/src/features/dispatch/dispatch.route-handlers.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/dispatch/dispatch.route-handlers.ts)
- Sửa: [apps/api/src/features/dispatch/dispatch.service.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/dispatch/dispatch.service.ts)
- Sửa: [apps/api/src/features/notifications/notification.service.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/notifications/notification.service.ts)
- Sửa: [apps/api/src/features/payments/payment-provider.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/payments/payment-provider.ts)
- Sửa: [apps/api/src/features/payments/payment.route-handlers.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/payments/payment.route-handlers.ts)
- Sửa: [apps/api/src/features/payments/payment.schemas.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/payments/payment.schemas.ts)
- Sửa: [apps/api/src/features/payments/payment.service.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/payments/payment.service.ts)
- Sửa: [apps/api/src/features/payments/payos.client.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/payments/payos.client.ts)
- Sửa: [apps/api/src/features/quotes/diagnosis-quote.route-handlers.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/quotes/diagnosis-quote.route-handlers.ts)
- Sửa: [apps/api/src/features/quotes/quote.schemas.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/quotes/quote.schemas.ts)
- Sửa: [apps/api/src/features/quotes/quote.service.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/quotes/quote.service.ts)
- Sửa: [apps/api/src/features/service-requests/service-request-state.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/service-requests/service-request-state.ts)

### Repository contracts và adapters (9 file)

- Sửa: [apps/api/src/server/repositories/contracts/assignment.repository.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/server/repositories/contracts/assignment.repository.ts)
- Sửa: [apps/api/src/server/repositories/contracts/payment.repository.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/server/repositories/contracts/payment.repository.ts)
- Sửa: [apps/api/src/server/repositories/contracts/quote.repository.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/server/repositories/contracts/quote.repository.ts)
- Sửa: [apps/api/src/server/repositories/postgres/assignment.repository.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/server/repositories/postgres/assignment.repository.ts)
- Sửa: [apps/api/src/server/repositories/postgres/payment.repository.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/server/repositories/postgres/payment.repository.ts)
- Sửa: [apps/api/src/server/repositories/postgres/quote.repository.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/server/repositories/postgres/quote.repository.ts)
- Sửa: [apps/api/src/server/repositories/testing/in-memory-assignment.repository.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/server/repositories/testing/in-memory-assignment.repository.ts)
- Sửa: [apps/api/src/server/repositories/testing/in-memory-dispatch.repository.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/server/repositories/testing/in-memory-dispatch.repository.ts)
- Sửa: [apps/api/src/server/repositories/testing/in-memory-payment.repository.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/server/repositories/testing/in-memory-payment.repository.ts)

### Tests (8 file)

- Sửa: [apps/api/src/features/payments/__tests__/payment.routes.test.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/payments/__tests__/payment.routes.test.ts)
- Sửa: [apps/api/src/features/payments/__tests__/payment.service.test.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/payments/__tests__/payment.service.test.ts)
- Mới: [apps/api/src/features/payments/__tests__/payos.client.test.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/payments/__tests__/payos.client.test.ts)
- Mới: [apps/api/src/features/quotes/__tests__/rescue-workflow.test.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/quotes/__tests__/rescue-workflow.test.ts)
- Sửa: [apps/api/src/server/db/__tests__/all-migrations.static.test.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/server/db/__tests__/all-migrations.static.test.ts)
- Sửa: [apps/api/src/server/db/__tests__/migration-lifecycle.integration.test.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/server/db/__tests__/migration-lifecycle.integration.test.ts)
- Sửa: [apps/api/src/server/repositories/postgres/__tests__/diagnosis-quote.repositories.integration.test.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/server/repositories/postgres/__tests__/diagnosis-quote.repositories.integration.test.ts)
- Sửa: [apps/api/src/server/testing/__tests__/postgres-test-context.test.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/server/testing/__tests__/postgres-test-context.test.ts)

### Guard database test (1 file)

- Sửa: [apps/api/src/server/testing/postgres-test-context.ts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/server/testing/postgres-test-context.ts)

### Worker (1 file)

- Mới: [apps/api/scripts/run-payment-workers.mjs](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/scripts/run-payment-workers.mjs)

### Migration (1 file)

- Mới: [supabase/migrations/202606250033_rescue_quote_payment_workflow.sql](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/supabase/migrations/202606250033_rescue_quote_payment_workflow.sql)

## Các thay đổi giữ ngoài commit này

- Toàn bộ `.env.local` và credential thật. `.env.example` được đưa lên chỉ chứa cấu hình mẫu.
- Các thay đổi Android/mobile đang có trong workspace và `apps/web`.
- `tests/http/**` cùng dữ liệu/kết quả HTTP regression thuộc phạm vi khác.
- Các tài liệu phân tích frontend/admin, database, recovery và regression khác ở root.
- `node_modules`, Cloudflare executable, URL/state payment trong file local, worker logs và dữ liệu phát sinh.
- Chính file `PAYMENT-PUSH-PLAN.md` này là bản duyệt local, không nằm trong 45 file.

Các thay đổi ngoài danh sách vẫn được giữ trong workspace.
