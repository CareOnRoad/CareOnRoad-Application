# PLANS — Kế hoạch, Audit, Plan & Docs

Thư mục chứa các tài liệu kế hoạch, audit, review, plan triển khai và đánh giá
toàn diện cho dự án CareOnRoad. Được tổ chức theo chủ đề để dễ navigation.

## Cấu trúc

```
PLANS/
├── README.md                      ← file này
├── admin-web/                     ← Plan cho Admin Web dashboard
├── audits/                        ← Báo cáo audit & review codebase
├── database/                      ← Plan tối ưu database
├── recovery/                      ← Kế hoạch & báo cáo recovery workspace
├── reviews/                       ← Review flow nghiệp vụ
├── testing/                       ← Báo cáo test & regression
├── plan.md                        ← Plan polish UI/UX mobile (riêng)
├── 2026-09-27-*.md                ← Plan BE contract refactor + admin web
├── 2026-09-29-admin-web-plan-*.md ← Plan admin web + mobile integration
├── mechanic-view.md               ← Plan mechanic view
├── FE-BE-CONTRACT-...             ← (deprecated — xem admin-web/)
├── PRICING-TRANSPARENCY-AND-CANCELLATION-PLAN.md  ← Plan minh bạch giá & hủy dịch vụ
```

## Sub-folders

| Sub-folder | Mô tả |
|---|---|
| `admin-web/` | Kế hoạch, hướng dẫn tích hợp AI và review FE-BE contract cho Admin Web |
| `audits/` | Báo cáo audit role flows, phản biện tài liệu, đánh giá tổng quan codebase |
| `database/` | Phân tích trạng thái database và đề xuất tối ưu |
| `recovery/` | Kế hoạch recovery workspace sau khi nhánh `mono/mobile/break` bị tách |
| `reviews/` | Review flow nghiệp vụ (notification, maintenance...) |
| `testing/` | Báo cáo regression test và kết quả automation |

## Quy ước

- File `.md` ở **root PLANS** là plan cross-cutting hoặc historical (giữ nguyên tên).
- File `.md` ở **sub-folder** được phân loại theo chủ đề cụ thể.
- Mỗi sub-folder có `README.md` giải thích nội dung và liên kết đến code/spec liên quan.

## Liên quan

- Specs đang chạy: `specs/001..021-*/`
- Backend code: `apps/api/`
- Mobile code: `apps/mobile/`
- Web code: `apps/web/`
