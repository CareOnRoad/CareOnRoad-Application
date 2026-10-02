# Batch 00 — kết quả implementation

Ngày: **02/10/2026, giờ Việt Nam**. Baseline commit: `a9d0b60b4b88f8f3963af255706b33b00ff7b219` cùng các thay đổi workspace có sẵn.

**Đã hoàn thành phần local của Batch 00. Phần migration/kiểm chứng PostgreSQL test còn chờ database test riêng.** User xác nhận database hiện tại là **production** và yêu cầu hoàn thiện local, ghi rõ phần DB còn chờ. Không áp dụng migration, seed, data repair hoặc thay đổi Supabase Auth trên production.

## Đã implement

1. **Schema probe dùng chung:** kiểm tra cột và kiểu dữ liệu, validated constraints, current-work/scheduled indexes, enabled triggers và extension `btree_gist` cần cho migration 035. Query chỉ đọc catalog PostgreSQL, hoạt động được khi cột/table còn thiếu.
2. **Readiness:** probe thay `SELECT 1` bằng kiểm tra schema trên public. Schema không tương thích trả HTTP 503 với `database: down`; response không chứa tên cột thiếu, SQL, URL hoặc lỗi DB thô. Liveness giữ nguyên.
3. **Release preflight:** command chỉ đọc, timeout SQL 5 giây, exit 1 khi schema/history không khớp source. Có inventory tùy chọn: sáu nhóm cần review, tối đa 100 hash ID/nhóm, không tự repair và không xuất PII/raw ID.
4. **Isolation guard chung cho CLI và integration:** giữ điều kiện môi trường test/explicit enable/test confirmation; production database vẫn bị chặn. Bổ sung normalization localhost aliases, default port và database name URL-encoded; không đánh đồng hai local instances ở hai port khác nhau.
5. **Verification:** regression cho readiness/schema/isolation và PostgreSQL smoke riêng. Smoke apply source migrations trong isolated schema của DB test, kiểm tra object thật, chạy repository reservation/notification lease query và chứng minh missing column bị từ chối. Smoke chưa chạy do chưa có DB test.
6. **Runtime/baseline:** frozen offline install xác nhận dependency đã khai báo khớp; không đổi version/lockfile. Thêm `test:audit` qua Node runner hiện có để chạy audit mà không phụ thuộc bare `vitest` command resolution.
7. **Documentation:** checklist release/test setup và mốc schema source trong API README/AGENTS được cập nhật. Không tạo/deploy CI hoặc thay đổi hosting configuration.

File chính:

- [Schema probe](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/server/db/backend-schema.mjs), [database isolation guard](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/server/db/database-environment.mjs).
- [Readiness adapter](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/health/health.route-handlers.ts), [preflight CLI](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/scripts/check-backend-schema.mjs).
- [PostgreSQL smoke](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/server/db/__tests__/backend-schema.integration.test.ts), [release checklist](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/SCHEMA-RELEASE-CHECKLIST.md).

## Verification mới trong lượt này

| Check | Kết quả | Evidence |
|---|---|---|
| Dependency/lockfile | Frozen offline install PASS; lockfile hash không đổi | [Baseline snapshot](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/baseline-before.json) |
| Unit trước sửa | 168 files / 568 tests PASS | [Baseline log](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/unit-baseline-approved.log) |
| Unit sau sửa | **169 files / 578 tests PASS** | [Regression log](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/unit-final.log) |
| Audit riêng | 4 PASS / 10 FAIL, đúng các phát hiện chưa sửa | [Audit log](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/audit-final.log) |
| Typecheck | PASS | [Typecheck](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/typecheck-final.log) |
| Lint | PASS | [Lint](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/lint-final.log) |
| Build toàn root workspace | API/web PASS | [Build](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/build.log) |
| Production schema/inventory | Chỉ đọc; release bị chặn đúng vì thiếu 035 | [Schema evidence](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/production-schema-evidence.json) |
| Test DB guard với cấu hình hiện tại | Exit 1, `TEST_DATABASE_ISOLATION_REQUIRED`, trước khi kết nối DB | [Guard evidence](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/test-db-guard-evidence.json) |
| PostgreSQL integration / real accept/lease smoke | **BLOCKED — chưa có DB test riêng** | Không coi unit/mock là SQL PASS |

Sandbox chặn esbuild spawn ở lần chạy unit đầu; lượt được chạy với quyền phù hợp đã pass. Không có hành động deploy/push hoặc migration production trong các lệnh build/test.

## Kết quả database chỉ đọc

Production vẫn ghi nhận **34 migrations**, mới nhất `202606250034`; 035 chưa có. Probe mới trả:

| Nhóm object của 035 | Có đủ |
|---|---|
| Columns/types | Không |
| Validated constraints | Không |
| Required indexes/predicates | Không |
| Enabled triggers | Không |
| btree_gist extension | Có |

Inventory hiện tại:

| Nhóm review | Số candidate |
|---|---:|
| Latest terminal assignment / request mismatch | 0 |
| Pending/approved standard quote tổng 0 | 0 |
| Request chưa terminal, thiếu tọa độ | **4** |
| Mechanic profile không còn role | 0 |
| Future accepted schedule cần review | 0; kiểm tra reservation chưa đầy đủ vì thiếu schema |
| Inactive assignment còn payment created/pending/succeeded/needs_review | 0 |

Đây là inventory bounded của dữ liệu hiện có, không chứng minh các lỗi B02–B12 không tồn tại. Chúng vẫn tái hiện trong audit. Bốn request thiếu tọa độ được ghi nhận để xử lý ở Batch 05; không thay tọa độ hoặc trạng thái trong lượt này.

## Phần còn chờ để đóng đủ Batch 00/B01

- [ ] Có database/Supabase project test riêng, cấu hình cục bộ và isolation preflight pass.
- [ ] Migration list + dry-run trên đúng test project; kiểm tra extension permissions/legacy schedules/constraints.
- [ ] Apply/verify 035 trên test, chạy schema smoke và maintenance reservation acceptance/concurrency integration.
- [ ] Production rollout của 035 có kế hoạch và authorization riêng; sau rollout chạy lại read-only preflight. User chưa yêu cầu apply production trong lượt này.

Commands hiện có:

```powershell
pnpm.cmd run preflight:schema
pnpm.cmd run preflight:schema --inventory
pnpm.cmd run preflight:test-db
pnpm.cmd run test:audit
```

Release preflight hiện **phải exit 1** với production 034. B01 chưa được đóng; các batch logic tiếp theo có thể chạy local, nhưng DB/E2E acceptance vẫn cần môi trường test riêng.
