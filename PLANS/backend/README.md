# Backend Plans & Reports

Tài liệu kế hoạch sửa backend/API theo batch và báo cáo kết quả triển khai
tương ứng (role flow, recovery, evidence Batch 00–15).

## Nội dung

- `BACKEND-ROLE-FLOW-FIX-PLAN.md` — Kế hoạch sửa backend theo batch (rider, mechanic, admin)
- `BACKEND-FIX-BATCHES-REPORT.md` — Báo cáo kết quả Batch 01–15 (lịch sử evidence + gate cuối)
- `BACKEND-BATCH-00-REPORT.md` — Baseline Batch 00 (bằng chứng implementation ban đầu)

## Quy ước

- Ba file này di chuyển cùng nhau từ root repo nên link tương đối giữa chúng vẫn hợp lệ.
- Nhiều link bên trong vẫn trỏ tới absolute path máy cũ (`D:/fpt/...`) — đã hỏng sẵn từ trước,
  giữ nguyên để không làm lệch nội dung lịch sử.

## Liên quan

- Backend code: `apps/api/`
- Schema/DB: `supabase/migrations/`
- Audit role flow: `PLANS/audits/BACKEND-ROLE-FLOW-AUDIT.md`
- Handbook backend: `CAREONROAD_CODEBASE_HANDBOOK.md` (ở root)
- Spec Kit feature 003: `specs/003-careonroad-admin-operations/`
