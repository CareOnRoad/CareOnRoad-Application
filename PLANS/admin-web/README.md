# Admin Web Plans

Tài liệu kế hoạch, review và implementation guide cho **Admin Web** dashboard
(quản trị viên backend) — phân tích contract FE-BE, giải pháp tích hợp AI,
và hướng dẫn wiring backend admin operations vào giao diện quản trị.

## Nội dung

- `ADMIN-WEB-AI-IMPLEMENTATION-SOLUTION.md` — Giải pháp tích hợp AI cho admin web (1,435 dòng)
- `FE-BE-CONTRACT-ADMIN-WEB-REVIEW-AND-AI-IMPLEMENTATION-GUIDE.md` — Hướng dẫn review FE-BE + AI implementation (1,252 dòng)
- `FE-BE-CONTRACT-ADMIN-WEB-REVIEW-AND-AI-IMPLEMENTATION-GUIDE-v1.md` — Bản v1 (viết trên `main`, sai baseline; gần như trùng bản trên, chỉ khác trailing whitespace). Giữ lại để tham chiếu lịch sử.
- `PAYMENT-PUSH-PLAN.md` — Kế hoạch push nhánh payment-rescue-payos lên GitHub

## Liên quan

- Backend admin operations: `apps/api/src/features/admin/`
- Migrations admin: `supabase/migrations/2026062500*_admin*.sql`
- Spec Kit feature 003: `specs/003-careonroad-admin-operations/`
