# Kết quả triển khai các batch sau Batch 00

Phạm vi theo [fix plan](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/BACKEND-ROLE-FLOW-FIX-PLAN.md). **Đã đối chiếu các tài liệu/evidence Batch 00–12 và triển khai tiếp đến Batch 15 theo yêu cầu.** Batch 13 và optional 15 đã implement; Batch 14 kiểm chứng HTTP/JWT/SQL local, còn provider/device thật và production rollout. Kết quả 00–12 bên dưới được giữ như lịch sử; gate mới ở cuối report. DB dùng Supabase Docker test riêng; không migrate/seed/deploy production. Ngày 03/10/2026, người dùng yêu cầu commit/push code trên branch mới `danh/backend-role-flow-batches-01-15`; yêu cầu này không bao gồm rollout Supabase hoặc deploy backend.

## Batch 01 — Hoàn thành

- Assignment status yêu cầu admin hoặc mechanic hiện tại sở hữu assignment; kiểm tra lại quyền sau khi chờ khóa. Activation kiểm tra role mechanic của người nhận việc, kể cả admin thực hiện.
- Revoke khóa profile và chặn mọi assignment chưa kết thúc, gồm lịch tương lai. Tắt availability trước khi revoke; profile active chuyển suspended. Re-grant giữ unavailable và cần reactivate; pending/rejected/banned giữ đúng trạng thái.
- Suspend/ban chặn cả future reservations. Các admin profile mutations từ chối profile lịch sử không còn role. Dispatch PostgreSQL và in-memory chỉ chọn app user active có role mechanic hiện tại.
- Migration **036** chỉ bắt buộc role khi insert hoặc update identity/operational columns. Review mới và rebuild rating sau revoke vẫn chạy. Schema gate yêu cầu trigger hẹp mới và migration history 036.
- Assignment visibility hợp nhất rider ownership và mechanic ownership; không nhân bản hàng khi actor có cả hai role.

| Kiểm tra | Kết quả | Evidence local |
|---|---|---|
| Unit/static/route | **169 files / 583 PASS** | [Unit](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/01/unit.log) |
| DB baseline | **34 files / 87 PASS** | [DB](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/01/db.log) |
| SQL tập trung sau chỉnh response availability | **4 files / 13 PASS** | [SQL](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/01/db-focused.log) |
| Typecheck / lint / build API+web | PASS | [Typecheck](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/01/typecheck.log), [lint](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/01/lint.log), [build](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/01/build.log) |
| Isolation/schema local | **36 migrations, PASS** | [Schema](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/01/schema.json) |
| Audit riêng | **6 PASS / 8 FAIL**; A02/A10 đã pass | [Audit](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/01/audit.log) |

SQL evidence bao gồm grant → approve → revoke → re-grant, reject operational update khi role đã mất, review/rebuild rating lịch sử, current/future job guards và race accept–revoke. DB baseline chạy sau migration mới; lượt SQL tập trung kiểm tra lại nhánh admin sau điều chỉnh availability response. Các fixture dispatch cũ thiếu app identity đã được sửa cho đúng eligibility hiện tại.

Migration 036 được preview rồi apply **chỉ local**. Các migration production và HTTP/provider/device E2E vẫn thuộc release/acceptance riêng trong plan.

## Batch 02 — Hoàn thành

Safety gate nhận các biến thể chết/tắt máy khi đang chạy, có/không dấu và dấu câu. Phủ định được giới hạn vào nhóm shutdown; câu nguy hiểm khác hoặc một occurrence khẳng định sau phủ định vẫn giữ override. Không thay ASR hoặc gọi provider thật trong tests.

- Unit/static/route: **169 files / 603 PASS** — [unit](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/02/unit.log).
- Typecheck, lint, build API+web PASS — [typecheck](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/02/typecheck.log), [lint](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/02/lint.log), [build](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/02/build.log).
- Audit: **7 PASS / 7 FAIL**; A07 đã pass — [audit](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/02/audit.log).
- Pipeline được kiểm tra với provider trả low risk/cho tiếp tục chạy và provider timeout: đều trả không được tiếp tục, high/critical và emergency rescue. Không có schema change nên không chạy lại DB suite cho batch này.

Typecheck được chạy tuần tự sau build để tránh build xóa/rebuild các file generated `.next/types` trong lúc TypeScript đang đọc. Đây là điều chỉnh thứ tự kiểm chứng, không thay đổi tsconfig.

## Batch 03 — Hoàn thành

- Guard dùng chung chặn cancel/recover khi đã có quote bất kỳ trên assignment hiện tại, labor agreement, tiền created/pending/succeeded/needs_review hoặc đã sửa chữa. Quote cũ trên assignment khác không chặn recovery mới; tiền chưa giải quyết của request cũ vẫn chặn hủy/redispatch.
- Rider hủy được accepted chưa travel, kể cả future reservation, và manual_escalation không active assignment. Admin/mechanic được hủy các giai đoạn pre-work theo ma trận. Cả request/assignment/history/dispatch được ghi trong một transaction; trạng thái canceled giải phóng reservation.
- Request synchronization không nuốt lỗi. Missing request, transition sai hoặc update thất bại trả conflict và rollback toàn bộ. `started_at` hiện ghi cả lúc en_route nên không dùng timestamp này để kết luận đã sửa chữa.
- Recovery giữ actor/reason restrictions, same-key replay và durable outbox. Khóa request trước assignment; webhook đọc snapshot rồi khóa request → assignment → quote → order, re-check dedupe sau khi chờ. Tiền đến sau hủy vẫn needs_review, không gán sang assignment khác. Event insert dùng native ON CONFLICT DO NOTHING để tránh lỗi khi receipt chưa có order bị gửi trùng.
- Command mới `POST /api/v1/admin/service-requests/{requestId}/repair-cancellation` yêu cầu admin, reason, assignment_id và X-Idempotency-Key; `dry_run` mặc định true. Preview không ghi DB. Chỉ `dry_run: false` mới sửa khi canceled history/timestamp và request state khớp, không agreement/quote/tiền chưa giải quyết và không replacement active. Không chạy repair trên production trong lượt này.
- Unit/static/route: **170 files / 629 PASS**; DB baseline **34 files / 92 PASS**, sau đó SQL tập trung bản cuối **3 files / 15 PASS**, gồm race accept/cancel thực sự; typecheck/lint/build API+web PASS. Evidence tại [thư mục Batch 03](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/03). Không có migration mới cho batch này.
- Audit **9 PASS / 5 FAIL**: A01/A03 đã pass; A04/A05/A06/A08/A09 thuộc các batch tiếp theo. [Audit](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/03/audit.log).

### Dùng command repair legacy

Chỉ preview các ID đã được inventory chỉ ra. Gọi endpoint với JWT admin, header `X-Idempotency-Key` tối thiểu 8 ký tự và JSON `{ "assignment_id": "UUID-cần-kiểm-tra", "reason": "Lý do quản trị tối thiểu 10 ký tự", "dry_run": true }`. Response chỉ có IDs, trạng thái, `repairable` và bounded `reason_code`, không có secret hoặc nội dung khách.

Nếu preview `repairable: true` và team đã review đúng IDs, gửi payload tương tự với `dry_run: false` và một key mới. Retry cùng key/payload trả lại kết quả cũ; payload khác cùng key bị conflict. `history_insufficient`, `replacement_active`, `quote_already_issued`, `agreement_exists` hoặc `payment_unresolved` cần điều tra, không sửa bằng SQL bulk. Production repair phải được review/ủy quyền riêng; code command không tự chạy khi deploy.

## Batch 04 — Hoàn thành

- `startDispatch` commit escalation trước khi trả CONFLICT/409; giữ response 202 của round mới. Escalation dùng một helper cho rider, recovered-request worker và expired-round worker, ghi history/audit/outbox một lần.
- Expired decline commit candidate expired và sanitized audit/outbox trước khi trả 409. Retry không tạo thêm event; lỗi authorization/input hoặc outbox failure vẫn rollback.
- Expiry dùng chung helper. Retry rider tự đóng active round đã hết hạn trước khi mở round tiếp theo, tránh unique-active-round conflict khi worker chưa chạy. Khóa request → rounds → candidates; concurrent retry chỉ tạo một next round. Early expiry bị từ chối; expiry lại round đã terminal không phát event lần nữa.
- Không reset lease worker còn hiệu lực. Giữ nguyên ranking/reservation/idempotency rules của maintenance. Rà soát callers `manualEscalate`, `expireRound`, `declineOffer`, `cancelDispatchForRequest` và các nhánh throw-after-write; không mở command admin mới của Batch 09.
- Registry outbox nhận hai domain-only topics mới `dispatch.candidate.expired` và `admin.service_request.cancellation_repaired`. Worker acknowledge chúng mà không gọi provider, phát event đệ quy hoặc đổi trạng thái notification; unknown topic thật vẫn retry như trước.

| Kiểm tra bản cuối Batch 01–04 | Kết quả | Evidence local |
|---|---|---|
| Unit/static/route | **170 files / 638 PASS** | [Unit](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/04/unit.log) |
| Toàn bộ PostgreSQL integration | **34 files / 97 PASS** | [DB](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/04/db.log) |
| SQL tập trung dispatch + maintenance reservation | **2 files / 9 PASS** | [SQL](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/04/db-focused.log) |
| Typecheck / lint / build API+web | PASS | [Typecheck](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/04/typecheck.log), [lint](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/04/lint.log), [build](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/04/build.log) |
| Audit riêng | **10 PASS / 4 FAIL**; A04 đã pass | [Audit](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/04/audit.log) |
| Local cleanup/guards | **36 migrations; test schemas/Auth fixtures/public app users đều 0; guards enabled** | [Counts/flags](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/04/local-db-cleanup.json) |

SQL tests dùng route handlers trả 409 với service/UoW/PostgreSQL thật rồi đọc lại DB để chứng minh commit. JWT boundary dùng test authenticator; đây chưa phải HTTP deployment/Supabase Auth/provider E2E của Batch 14. Các test tiền dùng provider giả; không gọi payOS/FCM/OpenRouter thật. Không thay lockfile hoặc thêm dependency. Batch 04 không có schema migration mới.

## Batch 05 — Hoàn thành

- Create yêu cầu tọa độ cho mọi dịch vụ. At-home/other scheduled giữ address và giờ tương lai; immediate không nhận lịch. PATCH owner mở cho submitted/manual_escalation trước mọi round/assignment/quote/tiền, giữ trạng thái escalation. Chỉ submitted maintenance emit matching event maintenance.
- Tất cả scheduled accept yêu cầu duration 15–480, reserve cùng buffer 30 phút và DB exclusion `[start,end)`. Ranking dùng khoảng lịch; future booking không chiếm current work slot. Travel chỉ trong cửa sổ `[scheduled - 30 phút, scheduled]`, có current role/profile hợp lệ và current slot trống. Quá giờ trả conflict và giữ reservation.
- Offer/confirm/prepare/cancel notifications của at-home/other dùng `appointment.*`; maintenance giữ compatibility/dedupe. Preparation worker và queries hỗ trợ hai nhóm mà không spam.
- Migration **037** guard insert/thay đổi location/service type cho mọi dịch vụ; status-only cancellation của legacy address-only vẫn được phép. Readiness/release gate yêu cầu trigger mới và source migration history.
- Inventory read-only nhận diện active legacy scheduled chưa có reservation và overdue unactivated. Admin `repair-reservation` mặc định dry-run, cần duration xác nhận/reason/key; chỉ commit future accepted at-home/other chưa travel/quote/agreement/tiền, mechanic eligible và không overlap. Request/profile/assignment locks, native exclusion, idempotency/audit/outbox; không viết lại history. Không chạy repair production.
- Unit/static/route: **170 files / 654 PASS**; PostgreSQL: **35 files / 102 PASS**; typecheck/lint/build API+web PASS; schema Docker **37 migrations, release_ready=true**. Audit **12 PASS / 2 FAIL**; A08 đổi oracle theo contract đã công bố, A09 accept có duration rồi early travel bị 409. A05/A06 còn chờ batch sau.
- Evidence: [Batch 05](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/05), [contract/repair guide](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/SCHEDULED-FULFILLMENT.md). Coverage SQL gồm concurrent overlapping accepts, adjacency/exclusion, PATCH–dispatch, activation/current slot, cancel release, legacy cancellation và reviewed backfill/overlap. Hai activation window của các lịch hợp lệ không thể overlap vì buffer/exclusion; duplicate concurrent activation vẫn chỉ ghi một history.

## Batch 06 — Hoàn thành

- Thêm `GET /api/v1/mechanics/me/jobs/{assignmentId}` cho active app actor có current mechanic role và sở hữu assignment. Admin/rider không được bypass bằng route này. Invalid UUID/missing/other owner/inactive/former mechanic có controlled 400/404/403; auth 401. Response `private, no-store`.
- DTO phục hồi assignment/status/lịch, request code/type/problem/location/address, xe, latest quote của đúng assignment, labor agreements, latest checklist summary và finalized media references. Reuse assignment/quote/checklist mappers; repository query latest quote theo assignment và capped media thay vì load history/N+1. Jobs summary giữ nhỏ.
- Chỉ trả tối đa 20 reference upload đã finalized (`has_more` nếu còn), không trả object path/bucket/checksum/provider response. Không gọi Storage/provider để tải ảnh hoặc tạo download URL. Không lộ internal admin note, checklist/vehicle private note, device/contact/token hoặc payment ledger.
- Completed/canceled/recovery-canceled job vẫn có summary của chính mechanic, nhưng bỏ tọa độ, address, plate và media ngay khi terminal. Current role vẫn bắt buộc; archived bike giữ historical brand/model summary. Read locks request → assignment để đồng bộ với cancel/recovery và re-check quyền sau wait.
- A06 dùng detail API qua service được dựng lại; SQL test dựng lại route/UoW đọc persisted data, giữ mechanic GET owner request 403. Coverage thêm latest quote thuộc assignment khác, pending/other-assignment media exclusion, media cap, private-field redaction và role revoke sau job terminal.
- Rà soát cuối Batch 05 bổ sung guard missing coordinates tại accept/scheduled activation/legacy backfill và không gửi preparation notification cho lịch đã quá giờ; kiểm chứng chung trong gate cuối bên dưới. Không tự suy ra tọa độ hoặc sửa approved money/history.

| Gate cuối Batch 01–06 | Kết quả | Evidence local |
|---|---|---|
| Unit/static/route | **170 files / 658 PASS** | [Unit](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/06/unit.log) |
| PostgreSQL suite | **35 files / 103 PASS** | [DB](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/06/db.log) |
| SQL tập trung bản cuối | **1 file / 6 PASS** | [SQL](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/06/db-focused.log) |
| Typecheck / lint / build API+web | PASS | [Typecheck](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/06/typecheck.log), [lint](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/06/lint.log), [build](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/06/build.log) |
| Audit riêng | **13 PASS / 1 FAIL**, A06/A08/A09 pass | [Audit](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/06/audit.log) |
| Schema/preflight/cleanup | **37 migrations, release_ready=true; test schemas/Auth/public app users đều 0; triggers enabled** | [Preflight](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/06/preflight.json), [cleanup](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/06/local-db-cleanup.json) |
| Diff / dependencies | PASS, lockfile không đổi; không thêm dependency | [Diff](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/06/diff-check.log) |

Contract: [Mechanic detail](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/MECHANIC-JOB-DETAIL.md). Batch 06 không có migration mới; API hiện yêu cầu 037. Bằng chứng restore là reconstruct service/UoW/route trên cùng PostgreSQL test, không tuyên bố đã restart một HTTP deployment. Auth route dùng test authenticator; không gọi payOS/FCM/AI/provider thật. HTTP/JWT/provider/device E2E vẫn thuộc Batch 14.

## Phần còn lại và điểm dừng

**Cập nhật sau các lượt tiếp tục:** Batch 07–12 đã hoàn thành bên dưới. A05 FAIL và các counts ở Batch 06 là evidence lịch sử được giữ nguyên. Batch 13–14 còn chờ; Batch 15 optional.

## Batch 07 — Hoàn thành

- Standard quote total phải > 0 và <= **999999999999**, dùng cùng constant với payment orders. Validation trước supersede/insert/transition; invalid replacement giữ nguyên pending cũ và mọi state/audit/outbox. Giữ calculator tổng quát, individual line 0, rescue parts rỗng và maintenance cumulative semantics.
- Legacy pending zero/over-limit approve trả 409, cần replacement hợp lệ; reject vẫn được. Approved legacy zero giữ immutable và nằm trong inventory read-only `standard_zero_quotes` để admin điều tra, không tự sửa total/fake payment.
- A05 đổi theo policy plan: zero create 400; positive approve rồi unpaid start 409. Không bỏ assertion để che lỗi. Full suite giữ rescue paid-in-full/remaining=0 và maintenance additions regressions.
- Evidence ban đầu: [unit 661 PASS](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/07/unit.log), [SQL quote 8 PASS](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/07/db-quotes.log), [audit 14/14 PASS](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/07/audit.log). Gate cuối kiểm chứng lại các regression này.

## Batch 08 — Hoàn thành

- PATCH `/api/v1/auth/profile` chỉ sửa display_name của authenticated active actor, strict schema và actor row lock. POST vẫn bootstrap, không update existing profile. Injection id/user_id/roles/status/account_type/rating/verified bị 400. Audit reuse `field=display_name`; không copy tên vào audit/outbox.
- Request/assignment lists strict status/date_from/date_to/limit/cursor; default 20/max 100, giữ `items`, thêm `page.next_cursor/has_more`. SQL áp dụng owner/visibility union trước filters/cursor/LIMIT. Cursor/order thống nhất creation time ở millisecond precision và UUID DESC; native microsecond/tie timestamp tests không trùng/mất item, filters thực sự có tác dụng.
- Rà callers phát hiện quote access từng dùng unrestricted assignment list; thay bằng scoped EXISTS theo request/actor để job ngoài trang đầu vẫn có quyền xem quote.
- Source mobile/web chưa có consumer của các list/profile routes này. Contract mới yêu cầu theo cursor để lấy hết lịch sử; xem [API notes](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/PROFILE-LISTS-ADMIN-DISPATCH.md). Unit/route và SQL profile/request/assignment tests pass trong gate cuối.

## Batch 09 — Hoàn thành trong phạm vi đã chọn

- Thêm 8 admin dispatch routes: status, rounds/detail, eligible, explanation, expire, retry, cancel. Read page default 50/max 100, strict query/cursor/UUID, private/no-store; round detail cap 100 candidates, status cap 64 history, có has_more. Không lộ tọa độ/contact/description/worker lease owner.
- PostgreSQL/in-memory eligibility dùng chung với pipeline tạo round rider/worker/admin, giữ deterministic ranking, freshness, radius, current-work/reservation. Explanation trả **mọi reason phù hợp từng mechanic**; counts ghi `reason_counts_scope=page`, không giả tổng toàn DB. Future invitation kiểm tra minimum visit/buffers; accept vẫn kiểm tra duration thật.
- Commands require reason/idempotency, khóa request → rounds/candidates → active assignment, recheck admin sau wait. Live worker lease, active assignment (kể cả future), pending/approved quote hoặc unresolved money chặn intervention. Expire chỉ overdue; cancel dispatch/expire chuyển manual_escalation, không hủy nhu cầu. Cancel request dùng Batch 03 riêng.
- Migration **038** lưu episode start/retry count, default giữ history/budget legacy. Admin retry manual escalation → submitted → dispatching/offered, tối đa **3 retries/request**, mỗi episode **4 rounds/360 seconds**, history max 64. Không reset vì GET, không xóa/reopen round cũ. Có thể reconsider mechanic ở episode mới; rescue reject/recall trong episode giữ nguyên và pass regression.
- Audit có sanitized admin reason; admin outbox topics được domain-only consumers acknowledge. Inbox nói đang tìm/cần hỗ trợ, không báo đã xác nhận. Shared create-round nay tạo mechanic offer notification cho cả sửa xe thường với nội dung đúng workflow; rescue/maintenance/appointment dùng loại riêng.
- Tests: role 403, same-key replay/body conflict, capped retry, overdue/lease, all exclusions, redaction/pages; reject thiếu coords/rider inactive/lịch qua/assignment/quote/money, rollback cả episode/round/inbox/idempotency khi final admin audit fail. Native retry/worker/accept/cancel races không sinh hai active rounds hoặc assignment thứ hai.
- SpecKit Patch E được đối chiếu theo scope: T073–T078/T080–T083 phần read/expire/retry/cancel có code/test; manual assignment/source/provenance và tests của nó giữ Batch 10. Không đánh dấu toàn Patch E xong. Reuse `DispatchService`, không thêm service/policy wrapper.

## Gate cuối Batch 00–09 và phần còn chờ

Baseline lượt này: HEAD `30ca0edaccff1a4a51cd3914a3d02a420596ed0b`, working tree chứa Batch 00–06, chưa commit. Không thêm dependency; lockfile SHA-256 vẫn `754C9C4CCC71EC722C4A7C756E620C922199F98852A4EE9F2223645C239D28C8`.

| Kiểm tra | Kết quả | Evidence |
|---|---|---|
| Unit/static/route | **172 files / 674 PASS** | [Unit](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/09/unit-complete.log) |
| Full PostgreSQL integration | **35 files / 108 PASS** | [DB](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/09/db-verified.log) |
| SQL sau PostGIS prefilter cuối | **1 file / 11 PASS** | [Dispatch SQL](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/09/db-complete-focused.log) |
| Audit riêng | **14/14 PASS** | [Audit](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/09/audit-final.log) |
| Typecheck / lint API / build API+web | PASS | [Typecheck](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/09/typecheck-complete.log), [lint](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/09/lint-complete.log), [build](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/09/build-verified.log) |
| Test schema/history/inventory | **38 migrations, release_ready=true, inventory rỗng** | [Preflight](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/09/preflight.json) |
| Cleanup/isolation | **0 test schemas, 0 Auth fixtures, 0 public app users; triggers enabled, episode constraint validated** | [Isolation](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/09/isolation.json) |

038 đã preview/apply **chỉ Docker --local**. Logs trong `apps/api/audit` là ignored local artifacts; checkout khác cần chạy lại. Giữ FAIL trung gian để truy vết: fixture keys/IDs/constraints, audit field và prefer-const đã sửa; không che lỗi bằng đổi oracle.

**Điểm dừng lịch sử ở Batch 09:** lúc đó Batch 10–14 còn chờ. Các sections 10–12 bên dưới cập nhật trạng thái hiện tại. Gate này là unit/route/SQL core; HTTP E2E và production acceptance chưa được kiểm chứng. Inventory rỗng chỉ phản ánh DB test đã cleanup.

## Đối chiếu trước Batch 10–12

- Batch 00 là baseline 35 migrations, audit 4 PASS/10 FAIL; giữ nguyên số liệu lịch sử, không coi là lỗi còn mở sau gate cuối.
- Batch 01–06 đã kiểm chứng quyền hiện tại, cancellation/recovery, tọa độ/lịch và mechanic detail. Batch 07–09 đã kiểm chứng quote totals, profile/list và dispatch recovery; audit đã 14/14 PASS.
- Batch 09 chỉ hoàn thành dispatch read/expire/retry/cancel; manual source, assignment supervision và delivery/audit là phần 10–12 tiếp tục lần này. Không chạy lại migration hoặc repair production để đối chiếu.
- SpecKit feature 003 còn dùng migration slots 017–021 đã bị các feature khác chiếm. Implementation nối tiếp 039–043; contracts/tasks/quickstart/data-model được cập nhật theo tên field, route và giới hạn thực tế, không thêm wrapper chỉ để khớp tên service dự kiến.

## Batch 10 — Hoàn thành

- Thêm 7 routes cho manual assignment, assignment detail/timeline/cancel/reassign/resolve-stuck/notes. Read models phân biệt current/future/closed, trả commitment reasons và safe next actions; note/reason/narrative không vào response.
- Migration **039** thêm `source`, admin provenance, replacement link và server distance snapshot. Manual source không có candidate; offer vẫn phải khớp request/mechanic/accepted candidate. Source/identity/snapshot bất biến; replacement unique và phải cùng request, khác mechanic, prior `recovery_canceled`.
- Manual assignment reuses native dispatch eligibility; recheck target profile, quyền admin/rider sau wait, motorcycle, skill/availability/fresh location/radius, current slot và toàn bộ reservation buffer. Scheduled duration 15–480 phút bắt buộc; không fake offer hoặc tin distance client. Rescue labor pricing dùng snapshot mới và fallback candidate legacy.
- Reassign chỉ `accepted`/`en_route` chưa có bất kỳ quote/agreement/unresolved money; đóng assignment cũ, tạo replacement, đồng bộ request/dispatch/history và notifications trong cùng UoW. Cancel dùng canonical helper; `resolve-stuck` chỉ cancel/reassign/investigate, không force status/completed/payment.
- Gate tại thời điểm batch: **687 unit / 173 files**, **110 SQL / 35 files**, typecheck/lint/build API+web PASS. Native tests có manual/reassign races và current-slot conflicts; unit kiểm tra rescue manual pricing, guard/rollback/idempotency, lịch và redaction. Hai test revoke-during-profile-wait bổ sung ở gate cuối.
- Evidence: [Batch 10](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/10). 039 preview/apply chỉ Docker local.

## Batch 11 — Hoàn thành

- Thêm 9 routes diagnosis metadata/history/revision, quote metadata/history/revision/void/expire, request supervision history và dispute resolution. Append-only supervision action tách reason riêng; đúng rider/mechanic nhận notification không kèm narrative/reason.
- Migration **040** enum-only `voided`; **041** append-only (update/delete/truncate)/RLS supervision và quote status guards. Content/lines/version và diagnosis đã được quote tham chiếu vẫn bất biến. Diagnosis revision chỉ ghi yêu cầu trước khi được phát hành/tham chiếu, không sửa record trực tiếp.
- Latest pending quote revision → voided, bắt buộc version mới. Expire chỉ khi có `expires_at` đã qua; dispute allowlist request_revision/void_pending_quote/uphold_latest_quote. Không approve thay rider, sửa ledger/provider/refund hoặc chỉnh approved labor.
- Reset workflow theo purpose: labor → accepted/assigned; standard/final trước work → diagnosis/in_service; maintenance addition giữ approved work in_progress. Sửa shared quote creation để phát hành lại sau void/expiry mà không kẹt ở trạng thái đã reset.
- Canonical **admin** cancel cho phép history quote đã void/rejected/expired nếu chưa work/agreement/unresolved money; pending quote vẫn phải close trước. Rider cancel/recovery giữ guard stricter. Quote-specific money guard không nhầm paid labor với pending parts/addition mới.
- Gate: **698 unit / 174 files**, **114 SQL / 35 files**, typecheck/lint/build PASS; schema preflight 041 PASS. PostgreSQL race void/revision/expire–approve chỉ một quyết định commit; version cũ và content không đổi, version mới vẫn phát hành/approve được.
- Evidence: [Batch 11](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/11). 040/041 preview/apply chỉ Docker local.

## Batch 12 — Hoàn thành

- Thêm 16 routes notification/outbox list/detail/summary/dead-letter/worker-health/retry/cancel/abandon và audit query/entity/actor/admin-actions/export. Worker-health reuse operational worker-run repository, không có stack monitoring mới.
- Retry notification chỉ failed original receipts có credential/version đang hợp lệ, owner active, không lease, không sent/invalid/new devices. Admin retry cap **3**; command fan-out cap **100 receipts**, reads paginated. Source event/payload/dedupe/domain identity giữ nguyên, reset lịch retry cùng transaction.
- Cancel dừng delivery trước khi có bất kỳ sent receipt; inbox/readAt không đổi. Native worker claim/outcome và aggregate commits tôn trọng canceled/abandoned; active provider lease chặn intervention, stale lease outcome không ghi đè terminal recovery.
- Outbox dead-letter retry chỉ supported consumers; abandon chỉ safe historical topics. `assignment.recovery.requested` có thể retry nhưng không abandon; unknown/critical handoff không bị xóa cảnh báo tùy tiện. Notification events delegate canonical recovery, không gọi FCM trực tiếp hoặc admin mark sent.
- Migration **042** enum-only canceled/abandoned; **043** provenance/counts/constraints, immutable identity + terminal guards và query indexes. Không mutate nguồn audit/quote/assignment/payment khi replay domain-only events.
- Audit native cursor filters actor/entity/action/admin/date, **31 ngày**, page 20/100; export default **1.000**, max **10.000**, statement timeout **5 giây**. Mỗi export thành công append đúng một access event actor/filter hash/count/time, không copy nội dung export hoặc sửa source rows. DTO whitelist loại narrative/reasons/provider payload/credential/raw errors.
- Focused gate **12 unit/static / 2 files**, **6 SQL / 2 files**; full bản cuối bên dưới. Provider race dùng stub có pause thật trong worker lease, PostgreSQL kiểm tra concurrent retry/cancel/worker claim, identity guards và append-only export.
- Evidence: [Batch 12](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/12). 042/043 preview/apply chỉ Docker local.

## Gate cuối Batch 00–12 và phần còn chờ

| Kiểm tra | Kết quả | Evidence local |
|---|---|---|
| Unit/static/route | **176 files / 712 PASS** | [Unit](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/12/unit-final.log) |
| PostgreSQL integration | **36 files / 118 PASS** | [DB](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/12/db-final.log) |
| Role-flow audit | **14/14 PASS** | [Audit](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/12/audit.log) |
| Typecheck / lint API | **PASS** | [Typecheck](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/12/typecheck-final.log), [lint](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/12/lint-final.log) |
| Build API + web | **PASS** | [Build](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/12/build.log) |
| Schema/history/inventory | **43 migrations / release_ready=true / inventory rỗng** | [Preflight](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/12/preflight.json) |
| Cleanup / SQL protection | **0 test schemas/Auth fixtures/app users; triggers/constraints/RLS enabled** | [Isolation](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/12/isolation.json) |
| Contract / implementation artifacts | **OpenAPI refs/parameters, 32 routes, T065–T132 PASS; T133+ pending** | [Artifacts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/12/artifacts.log) |
| Diff / dependency stability | **diff --check PASS; lockfile SHA-256 unchanged from Batch 09** | [Diff](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/12/diff-check.log) |

Contract và policy chi tiết: [Admin recovery operations](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/ADMIN-RECOVERY-OPERATIONS.md). Không thêm dependency; lockfile giữ nguyên. Sau review bổ sung truncate guard, reset DB Docker test rỗng và apply lại cả 43 source migrations từ đầu; xem [migration reset](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/12/migration-reset.log). Evidence logs là ignored local artifacts; checkout khác cần chạy lại. FAIL trung gian được giữ để truy vết các fixture/API typing sửa trước gate PASS.

**Snapshot tại thời điểm đóng Batch 12:** lúc đó Batch 13–15 và HTTP acceptance chưa làm. Các mục tiếp theo cập nhật phần triển khai mới; không thay đổi kết quả lịch sử ở bảng này. Production rollout/legacy repair vẫn chưa thực hiện.

## Batch 13 — Implemented và kiểm chứng local

- Thêm 14 routes admin reminder/dashboard. Reminder list/detail/occurrences/worker-health chỉ trả metadata, phân trang 20/100 và window 7 ngày/31 ngày; health chỉ lấy worker reminders, cursor dùng completed time và millisecond precision.
- Enable yêu cầu due time tương lai; retry chỉ failed occurrence, rule enabled, owner/role/bike còn hợp lệ, không active rule/outbox/receipt lease, tối đa 3 retries. Retry giữ notification context, original dedupe và receipt recovery policy của Batch 12; không tạo lại maintenance request, không đổi sent/dismissed thành queued hoặc giả lập push thành công.
- Bike → rule lock order dùng chung với rider reminder update, archive và worker; service-request creation cũng khóa bike. Native trigger migration **044** từ chối enabled reminder của xe archived hoặc rider ineligible. Failure count giữ lịch sử tích lũy; disabled, postponed và successfully processed rules không tạo cảnh báo stuck đang hoạt động.
- Dashboard dùng một SQL aggregate snapshot, không có table/cache mới. Tách current/future/closed assignments, 15 nhóm source và 9 loại finding: overdue dispatch, dispatch attention, stale assignment/appointment, divergence, dead letter, reminder failures, pending quote/payment và worker thiếu tiến độ. UUID finding ổn định theo target/category, safe read/investigate/note actions, window/page bounds và SQL timeout 5s.
- Native tests chứng minh retry/replay race, worker lease, archive–enable serialization, owner trigger, exact aggregates, đủ 9 categories, không duplicate, biên assignment threshold và cursor microsecond. Existing receipt/provider lease tests của Batch 12 được reuse. Static scope giữ reminder date/time, không kilometer/odometer.
- Migration 044 đã preview/apply chỉ Docker test. Spec 003 tasks/plan/data-model/contract/quickstart và handbook/AGENTS được đối chiếu với code thật, tên test được hợp nhất thay vì tạo file rỗng theo mỗi dòng task.

## Batch 15 — Optional Patch J đã implement

Người dùng đã cho phép triển khai đến hết Batch 15. `ADMIN_DISPATCH_CONFIGURATION_ENABLED=false` là default; cần schema **046** trước opt-in.

- Ba routes configuration read, dispatch update và provider-budget metadata. Chỉ cho sửa 4 dispatch keys; radius tăng nghiêm ngặt 1–8 steps/1–100 km, expiry 30–300s, max rounds 1–8, total wait 60–1800s và >= effective expiry. Unknown/secret/feature-flag/maintenance/payment/provider-budget mutations bị từ chối.
- Khóa bộ policy, validate merged values trước ghi; version tăng atomically, idempotent replay không tăng lại; audit/outbox sanitized. PostgreSQL enforce bounds, active-admin provenance, sequential version, cross-field budget, append-only history và RLS/revoked client grants. GET history chỉ tối đa 20 metadata entries.
- Dispatch/worker/recovery dùng immutable policy snapshot của đợt tìm thợ. Update không thay expiry của offer cũ; admin retry mở đợt mới lấy policy mới; legacy thiếu snapshot dùng defaults. Max rounds lớn hơn số radius steps thì reuse radius cuối. Tắt opt-in đưa runtime về defaults.
- Provider budgets chỉ configuration metadata; quota source chưa có thì usage/limit/remaining null, không bịa quota. Không thêm dependency. Migration 045 preview/apply chỉ Docker test; native tests kiểm tra update concurrency/rollback/native constraints/history/RLS, unit test kiểm tra worker policy snapshot qua nhiều rounds.
- Kiểm tra bổ sung phát hiện CHECK radius cũ chỉ chấp nhận 2/5/8/12 km, khiến policy tùy chỉnh không persist được. Migration 046 sửa bounds thành 1.000–100.000 mét; helper chung làm tròn km về mét cho cả ranking, ghi round và read explanation. Native dispatch/worker kiểm tra [1.0001, 3.1234, 99.9999] km, giới hạn SQL và policy snapshot sau update; HTTP recovery dùng radius tùy chỉnh.

Contract chi tiết: [Reminder/dashboard/configuration](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/ADMIN-REMINDER-DASHBOARD-CONFIGURATION.md). Batch 14 và gate cuối được ghi ở phần tiếp theo.

## Batch 14 — Nghiệm thu local PASS; external release gates còn chờ

Lượt tiếp tục 02–03/10/2026, giờ Việt Nam; HEAD `30ca0edaccff1a4a51cd3914a3d02a420596ed0b` cùng working tree chứa các batch chưa commit. Production Supabase đã được người dùng xác nhận là production; mọi DB validation/migration của lượt này chỉ chạy Docker test riêng. Không có deployment hoặc provider transaction thật.

- 14 audit regressions được đưa vào default unit suite, giữ report/log baseline. 88 OpenAPI operations đều có physical Next route/export; YAML parse, references và path parameters hợp lệ.
- HTTP suite chạy built Next server, ES256 JWT từ Supabase Auth local và JWKS verifier thật, PostgreSQL trong isolated schema. Bootstrap rider/mechanics, admin approve, dispatch/accept, diagnosis, quote, checklist, completion, review và inbox đều qua HTTP.
- Standard, rescue labor_upfront/after_repair và maintenance đều qua payOS local HTTP/signature adapter; invalid webhook bị 401, signed success và replay được kiểm tra. Không SQL seed paid/completed để bỏ qua bước thanh toán. Native dashboard fixtures có dữ liệu synthetic cho aggregate tests, không được tính là bằng chứng workflow tài chính.
- Admin retry/manual assign/reassign/void/cancel, failed reminder retry và failed original notification receipts được đọc lại qua rider/mechanic/admin APIs. Protected workers thực hiện matching, dispatch, recovery, reminder, outbox và payment reconciliation.
- Actual API process restart sau accept vẫn restore job detail; giữa provider initialization vẫn reconcile cùng order/link; sau actual outbox claim vẫn reclaim expired lease và re-dispatch, không duplicate recovery event. Chỉ advance fixture expiry/retry/lease clocks, không seed workflow kết quả. Một failed occurrence được inject cho admin recovery; receipt/provider failures và dead-letter do disabled FCM adapter/worker tạo thật.
- Performance dùng ít nhất 100 users, 50 mechanics, 100 requests, 50 assignments, 500 audit rows, 100 notification/outbox/rule/occurrence rows. **50 admin GETs**, mỗi operation 5 warmups + 20 measured; cả **1.000/1.000** measured requests dưới 2 giây, max operation p95 khoảng **465 ms**, request chậm nhất khoảng **563 ms**. Response page/export/byte bounds và secret scans PASS. Dataset là local synthetic read load, không phải benchmark production traffic.
- HTTP helper che password/token nếu signup command lỗi; response/server-log secret assertions dùng boolean để test failure không in secret. Test chạy riêng bằng `pnpm.cmd run test:http` sau build; default `test:db` skip HTTP suite có chủ ý.

## Gate cuối Batch 00–15

| Kiểm tra | Kết quả | Evidence local |
|---|---|---|
| Unit/static/route | **180 files / 756 PASS** | [Unit](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/14/unit.log) |
| PostgreSQL integration | **38 files / 127 PASS**; 9 HTTP tests chạy bằng gate riêng | [DB](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/14/db.log) |
| Local HTTP/JWT/SQL acceptance | **9/9 PASS**, payOS simulated, FCM disabled | [HTTP](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/14/http.log) |
| Admin performance | **50 operations, 1.000 measured requests, bounds PASS** | [Performance](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/14/admin-performance.json) |
| Role-flow audit | **14/14 PASS** | [Audit](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/14/audit.log) |
| Typecheck / lint | **PASS** | [Typecheck](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/14/typecheck.log), [lint](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/14/lint.log) |
| Build API + web | **PASS**; mobile/web source không đổi | [Build](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/14/build.log) |
| Schema test/history/inventory | **46 migrations, release_ready=true, inventory rỗng** trên Docker test | [Preflight](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/14/preflight.json) |
| Cleanup / isolation / guards | **0 test schemas, Auth fixtures, public app users; RLS/constraints enabled, 0 client config grants** | [Isolation](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/14/isolation.json) |
| OpenAPI / artifacts | **88 operations / refs / path parameters / routes PASS** | [Artifacts](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/14/artifacts.json) |
| Diff / dependencies | **diff --check PASS, lockfile unchanged** | [Diff](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/14/diff-check.log) |

Preflight `release_ready=true` ở bảng là schema **test**, không phải production release approval. Migration 044–046 đã preview/apply local; raw env/credentials không nằm trong report. Evidence logs là ignored local artifacts; checkout khác phải chạy lại. HTTP failures trung gian do contract/fixture/harness được giữ riêng ở `http-before-final.log`, `http-restart.log` và `http-radius-restart-before-final.log`; helper HTTP dùng connection riêng để tránh socket cũ sau khi cố ý kill API. Không đổi workflow hoặc seed money để làm PASS.

46 migration copies khớp source; lockfile không đổi. Manifest cuối ghi run/HEAD/config modes và gates: [verification](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/batch-00/fix-batches/14/verification.json). Các kết quả 756 unit, 127 SQL và 9 HTTP là ba gate riêng, không cộng trùng focused runs.

Những việc vẫn còn chờ của Batch 14:

1. payOS configured test và verified transaction thật trong môi trường/tài khoản được phép.
2. FCM push tới thiết bị Android/iOS và quan sát receipt; local failure/stub tests không chứng minh delivery exactly-once sau network timeout.
3. ETA/live tracking enabled với provider/device/config hợp lệ. Disabled mode và existing unit/native regressions đã kiểm tra; không bật feature chỉ để ghi PASS.
4. Hosted migration review, consumer compatibility, legacy dry-run repair và smoke sau rollout được phép. Production chưa migrate/seed/repair/deploy.

Luồng abort/đổi thợ sau approved agreement hoặc nhận tiền, refund/compensation và pricing/cancellation-fee policy vẫn là backlog riêng theo fix plan; admin không force paid/completed hoặc redispatch để che cam kết tài chính.

Đã triển khai đến hết Batch 15 trong phạm vi local được cho phép; Batch 14 chưa đóng gate môi trường thật. Hướng dẫn: [handbook](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/CAREONROAD_CODEBASE_HANDBOOK.md), [quickstart](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/specs/003-careonroad-admin-operations/quickstart.md), [schema release checklist](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/SCHEMA-RELEASE-CHECKLIST.md).
