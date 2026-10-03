# Batch 00 — kết quả implementation

Ngày: **02/10/2026, giờ Việt Nam**. Baseline implementation ban đầu: `a9d0b60b4b88f8f3963af255706b33b00ff7b219` cùng các thay đổi workspace có sẵn. Lượt hoàn tất Docker/DB bắt đầu ở commit `30ca0edaccff1a4a51cd3914a3d02a420596ed0b`, working tree sạch.

**Batch 00 đã hoàn thành trên môi trường test local riêng qua Docker.** PostgreSQL/Supabase Auth local có đủ 35 migrations; schema preflight và DB suite pass. Cách này không cần thêm hosted Supabase project. Database ứng dụng vẫn là **production**: không áp dụng migration, seed, data repair hoặc thay đổi Supabase Auth trên production. Production rollout và các lỗi logic của batch sau vẫn cần xử lý riêng.

## Đã implement

Cập nhật đối chiếu đến Batch 15: số liệu 35 migrations và audit 4 PASS/10 FAIL
trong file này là **baseline lịch sử Batch 00**. Source/local hiện tới migration 046;
Batch 01–13 và 15 đã triển khai, Batch 14 có HTTP/JWT/SQL acceptance local.
Provider/device thật và production rollout còn chờ. Kết quả mới nhất nằm trong
[report hiện tại](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/BACKEND-FIX-BATCHES-REPORT.md).
Production rollout và HTTP/provider/device acceptance vẫn còn chờ.

1. **Schema probe dùng chung:** kiểm tra cột và kiểu dữ liệu, validated constraints, current-work/scheduled indexes, enabled triggers và extension `btree_gist` cần cho migration 035. Query chỉ đọc catalog PostgreSQL, hoạt động được khi cột/table còn thiếu.
2. **Readiness:** probe thay `SELECT 1` bằng kiểm tra schema trên public. Schema không tương thích trả HTTP 503 với `database: down`; response không chứa tên cột thiếu, SQL, URL hoặc lỗi DB thô. Liveness giữ nguyên.
3. **Release preflight:** command chỉ đọc, timeout SQL 5 giây, exit 1 khi schema/history không khớp source. Có inventory tùy chọn: sáu nhóm cần review, tối đa 100 hash ID/nhóm, không tự repair và không xuất PII/raw ID.
4. **Isolation guard chung cho CLI và integration:** giữ điều kiện môi trường test/explicit enable/test confirmation; production database vẫn bị chặn. Bổ sung normalization localhost aliases, default port và database name URL-encoded; không đánh đồng hai local instances ở hai port khác nhau.
5. **Verification:** regression cho readiness/schema/isolation và PostgreSQL smoke riêng đã pass. Smoke apply source migrations trong isolated schema của DB test, kiểm tra object thật, chạy repository reservation/notification lease query và chứng minh missing column bị từ chối. Bổ sung kiểm tra append-only guards được giữ lại sau cleanup thành công và rollback khi cleanup lỗi.
6. **Runtime/baseline:** frozen offline install xác nhận dependency đã khai báo khớp; không đổi version/lockfile. Thêm `test:audit` qua Node runner hiện có để chạy audit mà không phụ thuộc bare `vitest` command resolution.
7. **Documentation:** checklist release/test setup và mốc schema source trong API README/AGENTS được cập nhật. Không tạo/deploy CI hoặc thay đổi hosting configuration.
8. **DB local:** dùng Supabase CLI 2.117.0 đã cài, PostgreSQL 17 và Supabase Auth; project ID `careonroad-batch00-test`, port DB 54322. Workdir và migration copies nằm trong thư mục audit ignored, không link cloud. `.env.test.local` ignored chứa cấu hình DB test riêng và confirmation; `.env.local` của ứng dụng giữ nguyên.
9. **Sửa baseline DB:** các suite cũ chạy đủ source migrations thay vì chỉ schema trước 014; cleanup hỗ trợ cả audit và admin internal notes trong schema test, chạy disable/truncate/restore nguyên tử. Cập nhật fixture tọa độ maintenance, handler giả cho outbox topic test và assertion reminder queued/notification pending. Suite dispatch track toàn bộ Auth fixture để dispose đúng ID. Không sửa business logic của các batch tiếp theo hoặc 14 audit assertions.

File chính:

- [Schema probe](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/server/db/backend-schema.mjs), [database isolation guard](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/server/db/database-environment.mjs).
- [Readiness adapter](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/health/health.route-handlers.ts), [preflight CLI](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/scripts/check-backend-schema.mjs).
- [PostgreSQL smoke](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/server/db/__tests__/backend-schema.integration.test.ts), [release checklist](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/SCHEMA-RELEASE-CHECKLIST.md).

## Verification

Các hàng baseline/production dưới đây giữ bằng chứng lượt implementation ban đầu. Các hàng Docker là kết quả chạy mới sau khi user báo Docker đã chạy.

| Check | Kết quả | Evidence |
|---|---|---|
| Dependency/lockfile | Frozen offline install PASS; lockfile hash không đổi | [Baseline snapshot](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/baseline-before.json) |
| Unit trước sửa | 168 files / 568 tests PASS | [Baseline log](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/unit-baseline-approved.log) |
| Unit sau hoàn tất Docker | **169 files / 579 tests PASS** | [Regression log](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/unit-docker-final.log) |
| Audit riêng, chạy mới | **4 PASS / 10 FAIL**, đúng các phát hiện chưa sửa | [Audit log](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/audit-docker-final.log) |
| Typecheck | PASS | [Typecheck](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/typecheck-docker-final.log) |
| Lint | PASS | [Lint](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/lint-docker-final.log) |
| Build toàn root workspace | API/web PASS | [Build](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/build-docker-final.log) |
| Production schema/inventory, lượt trước | Chỉ đọc; release bị chặn đúng vì thiếu 035 | [Schema evidence](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/production-schema-evidence.json) |
| Test DB guard khi dùng chung DB, lượt trước | Exit 1, `TEST_DATABASE_ISOLATION_REQUIRED`, trước khi kết nối DB | [Guard evidence](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/test-db-guard-evidence.json) |
| Docker test schema/isolation preflight | **PASS**, khác application DB; 35 migrations/history và mọi nhóm object hợp lệ | [Schema evidence](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/local-schema-final.json) |
| Migration list / local dry-run | PASS; không còn migration pending | [History](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/local-migration-history.log), [dry-run](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/local-migration-dry-run.log) |
| PostgreSQL integration baseline trước sửa harness | 34 files; 63 PASS / 21 FAIL | [Baseline DB](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/local-db-baseline.log) |
| PostgreSQL integration cuối | **34 files / 85 tests PASS**, gồm schema, accept/reservation concurrency và notification leases | [Final DB](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/local-db-final.log) |
| Cleanup sau DB suite | 0 schema test / 0 Auth fixture / 0 public app user; public append-only guards vẫn enabled | [Cleanup evidence](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/local-cleanup-evidence.json) |

Sandbox chặn esbuild spawn ở lần chạy unit đầu; lượt được chạy với quyền phù hợp đã pass. Không có hành động deploy/push hoặc migration production trong các lệnh build/test.

35 migration copies khớp hash source. Supabase **tự apply trên lần start đầu của instance local mới**; migration list/dry-run được chạy sau đó để xác nhận không còn pending. Không coi dry-run này là preview trước lần apply đầu. DB mới không có dữ liệu legacy; SQL fixtures kiểm tra constraints/concurrency, còn dữ liệu lịch và quyền extension trên production vẫn phải được review khi rollout.

Các lỗi DB baseline đến từ schema/fixture/cleanup không còn khớp contract hiện tại. Assertion reminder nay chứng minh chỉ có một occurrence queued, một notification pending và đúng hai sự kiện `reminder.rule.created`/`notification.created`; chưa coi đó là push đã gửi. Kiểm tra hậu suite còn phát hiện fixture Auth mechanic bị bỏ sót; đã sửa track/dispose và dọn 30 fixture tạm của các run trước trong container local mới. Bằng chứng cuối xác nhận không còn fixture sót.

## Kết quả database chỉ đọc

Ở lần kiểm tra production chỉ đọc trước đó, DB ghi nhận **34 migrations**, mới nhất `202606250034`; 035 chưa có. Chưa có evidence rollout production mới trong lượt Docker này. Probe lúc đó trả:

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

## Acceptance Batch 00 và phần còn chờ

- [x] Có PostgreSQL/Supabase Auth test local riêng, cấu hình cục bộ và isolation preflight pass.
- [x] Migration list + dry-run local; `btree_gist` tạo được, constraints/indexes/triggers đúng; instance mới không có lịch legacy cần chuyển đổi.
- [x] Apply/verify 035 trên test, chạy schema smoke, maintenance reservation acceptance/concurrency và notification lease SQL integration.
- [x] Unit/typecheck/lint/build pass; baseline audit đỏ của các batch sau được giữ riêng; fixture được cleanup.
- [ ] Production rollout của 035 có kế hoạch và authorization riêng; sau rollout chạy lại read-only preflight. User chưa yêu cầu apply production trong lượt này.

**Batch 00 không còn hạng mục local/test DB bị chặn.** B01 chưa đóng trên production; 10 lỗi logic audit vẫn cần các batch 01–08 theo fix plan. Chưa kiểm chứng HTTP clients/JWT đăng nhập thật, payOS/FCM/Storage/Maps thật hoặc lịch/dữ liệu legacy production; kết quả này là baseline cho các batch sửa tiếp, không phải toàn bộ rider/mechanic/admin đã E2E hoàn chỉnh.

Commands hiện có:

```powershell
pnpm.cmd run preflight:schema
pnpm.cmd run preflight:schema --inventory
pnpm.cmd run preflight:test-db
pnpm.cmd run test:db
pnpm.cmd run test:audit
```

Release preflight **phải exit 1 nếu target còn ở 034**. Test preflight local đã pass 035. Docker local được giữ chạy; hướng dẫn khởi động lại/dừng và tái lập trên checkout khác nằm trong [checklist DB local](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/SCHEMA-RELEASE-CHECKLIST.md). Evidence và cấu hình private chỉ tồn tại local, không commit.
