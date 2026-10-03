# CareOnRoad backend/API handbook

Workspace gồm mobile, web và API độc lập. Role-flow repair chỉ thay đổi `apps/api` và schema nguồn; mobile/web UI không thuộc các batch này. Backend dùng thin Next route → feature service → repository/UnitOfWork → PostgreSQL. Client JWT xác thực bởi Supabase JWKS; role/status luôn lấy từ app database. Internal worker routes dùng `X-Worker-Secret`.

## Trạng thái và tài liệu

- Evidence Batch 00–12 được giữ nguyên trong [batch report](BACKEND-FIX-BATCHES-REPORT.md). Batch 13 thêm reminder recovery và SQL dashboard; Batch 15 thêm optional dispatch configuration. Batch 14 có suite HTTP local, provider mô phỏng và các gate riêng; kết quả mới nhất và blockers nằm trong report.
- Source migrations liên tục **001–046**; local Docker test đã apply đến **046**. Production là Supabase project đã được xác nhận; task local không migrate/seed production. Rollout bắt buộc dùng [schema checklist](apps/api/SCHEMA-RELEASE-CHECKLIST.md).
- Auth/dispatch/schedule/job detail và admin recovery: [workflow docs](apps/api/PROFILE-LISTS-ADMIN-DISPATCH.md), [scheduled fulfillment](apps/api/SCHEDULED-FULFILLMENT.md), [mechanic job detail](apps/api/MECHANIC-JOB-DETAIL.md), [admin recovery](apps/api/ADMIN-RECOVERY-OPERATIONS.md).
- Batch 13/15 API, bounds, locks, thresholds và opt-in: [reminder/dashboard/configuration](apps/api/ADMIN-REMINDER-DASHBOARD-CONFIGURATION.md).
- Thanh toán verified trước start/close phụ thuộc workflow: [rescue](apps/api/RESCUE-WORKFLOW.md), [maintenance](apps/api/MAINTENANCE-WORKFLOW.md), [payment setup](apps/api/PAYMENT-SETUP.md). Không có refund/payout/settlement/invoice scope.

## Kiểm chứng

Windows dùng `pnpm.cmd test`, `pnpm.cmd run test:db`, `pnpm.cmd run typecheck`, `pnpm.cmd run lint`, `pnpm.cmd run build`. Build rồi chạy `pnpm.cmd run test:http`. DB/HTTP tests yêu cầu `TEST_DATABASE_URL` trỏ instance test riêng và confirmation; production URL không được tái sử dụng. Test tạo isolated schema và Auth fixtures rồi cleanup.

HTTP suite dùng Supabase Auth ES256 JWT và Next runtime thật, payOS HTTP/signature local mô phỏng, FCM adapter disabled. Nó không chứng minh thanh toán payOS thật, push tới Android/iOS hoặc rollout hosted. Không gọi source SQL paid/completed để vượt các bước money trong HTTP acceptance. Các disabled Maps/live tracking checks không tương đương nghiệm thu feature enabled.

Không ghi secret, database URL, raw env/token hoặc provider payload vào docs/logs/DTO. Mutation admin có reason/idempotency, audit/outbox sanitized và state/money/lease guards. Dashboard derived SQL không thêm cache/table; configuration chỉ có bốn keys dispatch allowlisted, history append-only và policy snapshot theo đợt tìm thợ.
