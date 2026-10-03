# Kế hoạch sửa và hoàn thiện backend theo batch

Ngày lập: **02/10/2026, giờ Việt Nam**. Phạm vi: backend/API của rider, mechanic và admin. Trạng thái: **Batch 00 đã implement phần local; migration/DB integration còn chờ DB test riêng**. Xem [báo cáo Batch 00](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/BACKEND-BATCH-00-REPORT.md). Các batch 01–15 chưa implement theo plan này.

## 1. Kết luận thiết kế

Cần sửa tính nhất quán của workflow trước, rồi bổ sung các API còn thiếu và công cụ vận hành. Không nên mở rộng state machine để mọi thao tác hủy/reassign đều thành công: một số nhánh đã tạo cam kết báo giá hoặc đã nhận tiền, trong khi hệ thống chưa có refund/chuyển tiền giữa assignment.

Giải pháp chọn:

- Request, assignment, quote và payment được kiểm tra trong cùng transaction trước khi thay đổi workflow. Nếu đồng bộ request thất bại, toàn bộ mutation phải rollback.
- Recovery trước báo giá chỉ chạy khi assignment hiện tại chưa phát hành quote và chưa có hoạt động thanh toán. Rescue/maintenance đã duyệt công không còn thuộc nhánh này dù trạng thái quay về `accepted`.
- Thu hồi role giữ profile và lịch sử, chặn công việc còn dang dở/lịch đã xác nhận, tắt availability trước khi bỏ role và sửa trigger để rating lịch sử vẫn cập nhật được.
- Tất cả request tìm thợ bằng vị trí phải có tọa độ từ lúc tạo. Địa chỉ vẫn giữ để hướng dẫn đến nơi. Không thêm geocoding ở giai đoạn sửa lỗi.
- Tái sử dụng reservation/activation của maintenance cho at-home và `other/scheduled_visit`; không xây một hệ thống lịch mới.
- Quote `standard` có tổng sau discount bằng 0 bị từ chối trước khi persist. Không tạo payment giả hoặc bỏ điều kiện thanh toán cho quote có tiền.
- Admin can thiệp bằng command có phạm vi cụ thể, reason, idempotency và audit; không có API force-status tùy ý.
- Tận dụng UnitOfWork, repository, PostgreSQL constraints, worker leases, outbox và các helper đang có. Không thêm dependency hoặc framework workflow.

## 2. Nguồn và độ chắc chắn của kết luận

Nguồn chính là [audit B01–B12](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/BACKEND-ROLE-FLOW-AUDIT.md) và [14 kiểm tra audit](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/role-flows.test.ts). Baseline của lượt audit trước: 564 test thường pass; 4 chuỗi service pass, 10 kiểm tra audit fail. Đây không phải kết quả HTTP/provider thật.

Đã đối chiếu lại code hiện tại của assignment, recovery, quote, payment, dispatch, profile, admin, repository và migration. Kiểm tra DB **READ ONLY** lúc **01:49 ngày 02/10/2026** tiếp tục xác nhận public schema chỉ có migration 034, thiếu 035 và hai truy vấn cột nhận `42703`. Cấu hình test DB vẫn không tách khỏi DB ứng dụng.

Workspace hiện có thay đổi từ công việc khác trong dispatch/payment/idempotency và workflow harness. [Implementation findings của workflow](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/tests/workflows/IMPLEMENTATION-FINDINGS.md) ghi nhận đã sửa cạnh tranh idempotency, lọc reservation trùng và xử lý currency mismatch, cùng một lượt 567 test pass. Phải kiểm tra lại theo đúng commit/run trước khi dùng làm baseline; không viết đè hoặc làm lại những bản sửa đã đúng.

Lệnh chạy lại audit trong lượt lập kế hoạch chưa thực hiện được vì `vitest` không được resolve trong workspace hiện tại. Không cài dependency hoặc thay lockfile để lập tài liệu. Việc khôi phục runtime test được đưa vào Batch 00; không coi các test cũ là một run mới.

Các phát hiện bổ sung khi phân tích solution:

1. Trigger yêu cầu role mechanic chạy trên **mọi UPDATE profile**, bao gồm rebuild rating. Chỉ đổi thứ tự revoke sẽ sửa HTTP revoke nhưng vẫn khiến review/rebuild rating sau revoke lỗi. Đây là tác động xác định từ code SQL; chưa tái hiện bằng mutation DB mới.
2. Recovery đang khóa assignment trước request, khác các đường quote/status/accept. Webhook khóa payment order rồi đọc workflow không khóa. Đây là rủi ro cạnh tranh cần test PostgreSQL, chưa kết luận đã có một deadlock/race cụ thể trên hosted.
3. `declineOffer` có nhánh update candidate thành `expired` rồi throw trong transaction, cùng kiểu rollback với B09. Cần xử lý cùng nguyên nhân nếu contract yêu cầu lưu expiry ngay tại thao tác decline.
4. Admin suspend/ban đang dùng truy vấn “current work”; sau migration 035, truy vấn đó bỏ qua lịch tương lai chưa activated. Policy vô hiệu hóa mechanic phải kiểm tra cả các lịch đã xác nhận, tránh để appointment không còn người thực hiện.

## 3. Phân tích toàn bộ vấn đề và solution chọn

| ID | Nguyên nhân gốc / ảnh hưởng | Solution | Batch | Bằng chứng nghiệm thu chính |
|---|---|---|---|---|
| B01 | Code phụ thuộc 035 nhưng public DB chỉ ở 034; build không phát hiện thiếu cột | Preflight schema, DB test tách biệt, apply/verify migration trên môi trường đã xác định; readiness kiểm tra schema cần thiết | 00 | History, cột, index/constraint/trigger đúng; API nhận việc và notification claim chạy SQL thật |
| B02 | Assignment cho hủy nhưng request không cho; helper nuốt lỗi đồng bộ | Policy hủy theo giai đoạn; bỏ silent catch; mutation của hai entity và history cùng transaction | 03 | Hủy được thì cả hai terminal; hủy không được thì không entity/history/outbox nào đổi |
| B03 | Recovery chỉ dựa status; approved labor quay lại accepted; tiền thuộc assignment cũ | Guard quote/agreement/payment trên assignment hiện tại; khóa theo cùng thứ tự; không redispatch sau cam kết | 03 | Rescue trả trước, trả sau và maintenance đã duyệt công đều bị chặn; recovery thật sự trước quote vẫn hoạt động |
| B04 | Xóa role trước UPDATE profile; trigger bắt buộc role trên mọi update | Tắt profile trước revoke; giữ history; guard công việc/lịch; giới hạn trigger vào thay đổi vận hành | 01 | Grant → approve → revoke chạy PostgreSQL; review/rebuild rating lịch sử sau revoke vẫn chạy |
| B05 | Ownership bị dùng thay cho quyền mechanic hiện tại | Admin hoặc mechanic hiện tại đúng ownership; kiểm tra role trong service chung | 01 | Former mechanic/rider bị 403; mechanic khác bị 403; owner mechanic/admin hợp lệ chạy |
| B06 | Offer có detail nhưng biến mất sau accept; jobs chỉ là summary | GET detail dành riêng cho mechanic sở hữu assignment | 06 | Sau restart lấy lại mô tả, địa chỉ, tọa độ, xe và trạng thái cần làm mà không cần cache offer |
| B07 | Create cho address-only nhưng dispatch yêu cầu tọa độ | Require location theo fulfillment; sửa request legacy trước matching qua owner PATCH có giới hạn | 05 | Address-only mới bị 400 rõ ràng; request tọa độ hợp lệ đi đến offer/accept; legacy có đường sửa/cancel |
| B08 | Chỉ maintenance được copy lịch và reservation | Dùng cùng policy scheduled cho mọi dịch vụ có lịch; sửa cả ranking, accept, activation và notification | 05 | Không travel trước cửa sổ; lịch không chiếm current slot; lịch trùng bị chặn; đúng cửa sổ thì đi được |
| B09 | Ghi escalation rồi throw trước commit | Transaction trả kết quả nghiệp vụ; map conflict sau commit | 04 | Response 409 vẫn tương thích; DB lưu escalation/history đúng một lần |
| B10 | Calculator cho 0; approval đòi payment; provider không nhận 0 | Chặn standard total <= 0 sau tính server và trước persist; chặn approve pending legacy 0 | 07 | Không sinh quote/workflow 0đ mới; standard >0 và rescue phần còn lại 0 vẫn đúng |
| B11 | Nhánh mechanic ưu tiên hơn rider trong visibility | OR theo role AND ownership; không chọn một role duy nhất | 01 | Actor rider+mechanic thấy cả hai nhóm, không trùng; không thấy đơn người khác |
| B12 | Matcher chỉ nhận một thứ tự từ | Bổ sung biến thể có kiểm soát, kiểm tra phủ định/ngữ cảnh; safety override xuyên diagnosis pipeline | 02 | Câu đảo thứ tự/có và không dấu nhận diện; AI/fallback không hạ mức nguy hiểm |

Khoảng trống tính năng cũng phải xử lý, nhưng tách khỏi bug để biết khi nào backend ổn định và khi nào đủ admin contract:

| ID | Khoảng trống | Solution / phạm vi | Batch |
|---|---|---|---|
| G01 | POST bootstrap không sửa profile; tài liệu có chỗ ghi PATCH | Giữ POST; bổ sung PATCH chỉ sửa display name của actor | 08 |
| G02 | Rider request list chưa có filters/pagination | Status/date/limit/cursor có giới hạn, owner predicate bắt buộc; kiểm tra các list assignment liên quan | 08 |
| G03 | Rider không hủy được lịch đã accept dù chưa travel | Hủy trước travel và trước quote/tiền theo policy Batch 03; sau đó trả conflict có lý do | 03 |
| G04 | manual_escalation không có đường xử lý chung | Admin retry/cancel trước; sau đó manual assignment đủ invariants | 09, 10 |
| G05 | Admin thiếu assignment/diagnosis/quote intervention | Detail/timeline/notes, reassign trước quote, revision/void/expire/dispute an toàn | 10, 11 |
| G06 | Admin delivery/audit/reminder/dashboard thiếu | Retry/cancel/abandon có lease guard; audit search/export; reminder recovery; dashboard derived | 12, 13 |
| G07 | Chưa chứng minh đầy đủ PostgreSQL/JWT/workers/provider/device E2E | Ma trận HTTP trên DB test riêng, test race/restart, bằng chứng provider tách khỏi mock | 14 |
| G08 | Configuration Patch J chưa có | Optional: bốn dispatch keys đã định nghĩa; không sửa secret/feature flags/payment policy | 15 |

## 4. Các quy tắc chung trước khi code

### 4.1. Invariants bắt buộc

1. Request terminal không có assignment hoạt động mới; assignment hủy không để request tiếp tục báo đang phục vụ bởi chính assignment đó.
2. Tối đa một assignment hoạt động cho request; tối đa một current-work slot cho mechanic. Future appointment dùng reservation riêng, không bị đánh đồng với current work.
3. Status không đủ chứng minh “chưa có cam kết”. Phải xét quote, labor agreement và payment thuộc **đúng assignment hiện tại**, không dùng một quote cũ của assignment trước để chặn mọi redispatch.
4. Không thay đổi nội dung/tổng của quote đã duyệt, không tự đánh dấu paid, không chuyển khoản đã thu sang assignment khác.
5. Quote approval, assignment status, cancel, recovery, admin reassign và payment success phải re-check trạng thái sau khi khóa.
6. Mọi public mutation giữ active-actor/role/ownership checks. Admin command mới giữ reason + idempotency + sanitized audit/outbox trong transaction.
7. Worker retry không tạo lại domain side effect; history và notifications dùng dedupe phù hợp. Claim/lease còn hiệu lực không bị admin reset giữa chừng.
8. Không giả lập một payment thành công để mở workflow. `needs_review` giữ nguyên ý nghĩa tiền cần đối chiếu.

### 4.2. Policy hủy/recovery chọn cho phạm vi hiện tại

| Tình huống | Rider | Mechanic được gán | Admin | Xử lý |
|---|---|---|---|---|
| Chưa có assignment hoạt động; submitted/dispatching/offered/manual_escalation, không cam kết/tiền chưa xử lý | Hủy đơn của mình | Không hủy request của rider | Hủy có reason | Đóng request và dispatch, giữ history |
| accepted, chưa travel, chưa phát hành quote, không payment | Hủy được, gồm lịch tương lai | Hủy; hoặc recover nếu không thể tiếp tục | Hủy/recover theo reason | Hủy: cả hai canceled; recover: assignment recovery_canceled, request submitted |
| en_route, chưa quote/payment | Chưa mở tự hủy sau travel | Hủy hoặc pre-quote recover | Hủy hoặc recover | Atomic; không tự tính phí/compensation |
| on_site/diagnosis, chưa quote/payment, chưa in_progress | Chưa mở tự hủy | Hủy terminal theo policy hiện có | Hủy terminal | Không recover/reassign qua API trước quote đang có |
| Có pending quote chưa duyệt | Chưa mở hủy trực tiếp | Không dùng status để bỏ quote | Batch 11: void pending rồi kết thúc/revision hợp lệ | Giữ content/history quote; không để approve cạnh tranh thành công |
| Đã duyệt công/báo giá, hoặc payment created/pending/succeeded/needs_review | Không hủy tự động | Không recover/cancel/reassign tự động | Ghi nhận và xử lý case trong phạm vi cho phép | 409 có mã lý do; giữ liên kết tài chính, không queue tìm thợ mới |
| Đã in_progress/completed | Không hủy trực tiếp | Không hủy trực tiếp | Không force terminal/paid | Điều tra theo case; workflow tài chính mở rộng là scope riêng |

Đây là policy kỹ thuật bảo toàn dữ liệu cho plan này. Phí di chuyển, phí hủy, compensation và giải quyết tiền đã thu cần policy sản phẩm riêng trong [kế hoạch giá/hủy](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/PRICING-TRANSPARENCY-AND-CANCELLATION-PLAN.md). Không triển khai catalog, pricing engine, dispute tài chính hay refund chỉ để sửa B02/B03. Khi một case có tiền không thể tự giải quyết, admin nhìn thấy lý do và history; không được ghi nhận nó là một luồng hủy tài chính đã hoàn chỉnh.

`recover` giữ đúng nghĩa **trước khi phát hành quote**. Quote đã rejected/expired/voided vẫn là history báo giá; các thao tác xử lý tiếp thuộc command quote/admin, không nới lỏng recovery dựa vào status cuối cùng. Rescue labor rejection tiếp tục dùng workflow rejection/recall chuyên biệt đang có.

### 4.3. Thứ tự lock và tác vụ ngoài DB

Trong các transaction cùng một workflow: lấy snapshot không khóa để biết IDs, sau đó khóa request → mechanic profile khi cần tranh current-slot/reservation → assignment → quote → payment order. Đối tượng nhiều ID khóa theo thứ tự ổn định. Idempotency dùng cùng thứ tự trong các command liên quan; không thêm hàng loạt advisory lock mới nếu row lock hiện tại đủ.

Recovery bỏ thứ tự assignment → request. Webhook đọc snapshot order trước rồi khóa workflow/order theo cùng thứ tự và kiểm tra lại event dedupe sau khi chờ lock. Provider call/FCM không đặt vào helper hủy/reassign trong transaction; tái sử dụng handoff hai bước/outbox hiện có. Payment cancel/reconcile giữ xác nhận provider thật, không đổi pending thành canceled để làm test xanh.

### 4.4. Tương thích và dữ liệu cũ

- Không sửa migration đã được áp dụng. Migration mới lấy số sau **phiên bản mới nhất tại thời điểm thực hiện**; hiện source đến 035. Không dùng lại 017–022 được ghi trong spec admin cũ.
- Preflight liệt kê chỉ đọc các cặp trạng thái lệch, approved quote 0đ, request thiếu location, lịch thiếu reservation, profile không còn role và khoản thanh toán liên quan.
- Data repair có dry-run, mục tiêu ID rõ, reason, idempotency và audit. Chỉ sửa case có history đủ chứng minh và không tiền. Case có tiền/assignment thay thế không được bulk UPDATE.
- Đơn address-only legacy chưa assigned được rider gắn tọa độ qua PATCH hoặc hủy. Không tự đoán tọa độ từ chuỗi địa chỉ.
- Các API additive giữ POST bootstrap, items và DTO đang dùng. Thay đổi validation/lịch/limit phải có contract note và ví dụ lỗi; rollout phải kiểm tra client hiện có gửi tọa độ, thời lượng và đọc cursor.

## 5. Thứ tự batch

| Batch | Kết quả cần đạt | Phụ thuộc | Mức thay đổi |
|---|---|---|---|
| 00 | Runtime test, schema và baseline xác minh được | Không | Môi trường + release gate |
| 01 | Role revoke, status auth, multi-role visibility đúng | 00 cho DB verification | Nhỏ–vừa; có trigger migration |
| 02 | Safety override nhận biến thể tiếng Việt | Baseline local | Nhỏ; độc lập workflow |
| 03 | Cancel/recovery không làm mất trạng thái hoặc tiền | 01; schema test | Vừa; nhiều nhánh và race |
| 04 | Dispatch escalation/expiry persist đúng | Baseline local; 00 cho DB | Nhỏ |
| 05 | Location + mọi lịch hẹn đi đến accept/travel đúng | 00, 03, 04 | Vừa; chia 05A/05B |
| 06 | Mechanic khôi phục đủ job detail | 01, 05 | Nhỏ–vừa |
| 07 | Không còn quote standard 0đ mới/approve legacy 0đ | 03 | Nhỏ |
| 08 | Rider có profile edit và bounded list | 01, 06 | Vừa; hai phần độc lập |
| 09 | Admin đưa đơn manual_escalation trở lại matching/cancel | 03, 04, 05 | Vừa |
| 10 | Admin manual assign/reassign có provenance và eligibility | 06, 09 | Vừa–lớn; chia read/command |
| 11 | Admin xử lý pending quote/revision/dispute đúng | 03, 07, 10 | Vừa; enum commit boundary |
| 12 | Admin delivery recovery + audit query/export | 00, 09–11 | Vừa; chia 12A/12B |
| 13 | Admin reminder recovery và dashboard/stuck actions | 09–12 | Vừa; chia 13A/13B |
| 14 | HTTP/DB/race/worker E2E và release evidence đầy đủ | 00–13 | Verification + documentation |
| 15 | Optional dispatch configuration | 09, 13; nhu cầu cấu hình đã chốt | Optional |

Không cần đợi mở rộng admin mới kiểm tra core. Sau **00–08** chạy một gate E2E rider/mechanic và admin nền tảng; sau **09–13** mới đánh giá đủ các nhóm admin E–I. Batch 02 có thể làm sớm vì không phụ thuộc payment/schema. Mỗi batch dừng để đánh giá diff và kết quả, không gộp tất cả vào một lần sửa.

## 6. Chi tiết từng batch

### Batch 00 — Môi trường, schema và baseline

**Mục đích:** không sửa logic trên một schema không chạy được và không nhận test mock là bằng chứng SQL.

Tasks:

- [x] Lưu working-tree/commit baseline và danh sách thay đổi đang có; đọc lại findings của workflow để tránh trùng sửa.
- [x] Kiểm tra test runtime, package manager và lockfile. Khôi phục dependency đã khai báo theo [kế hoạch workspace](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/DEPENDENCY-WORKSPACE-RECOVERY-PLAN.md), không nâng version để chữa việc thiếu binary. Nếu lockfile không khớp, xử lý đúng installation boundary trước.
- [ ] Thiết lập DB/Supabase Auth test riêng, xác minh khác application DB theo host/project/database identity. Không hạ guard `TEST_DATABASE_CONFIRMED` hoặc chỉ đổi tên schema để coi là project test riêng.
- [ ] Kiểm tra migration list và dry-run trên đúng development/test; kiểm tra extension `btree_gist`, quyền tạo extension, lịch legacy và constraints mới trước khi apply 035.
- [ ] Apply 035 trong môi trường test; query cả cột, unique/exclusion index, trigger và notification lease constraints. Chạy smoke accept/reservation và notification claim SQL thật.
- [x] Bổ sung schema preflight vào quy trình release và bounded readiness DB probe: thiếu cột bắt buộc phải `not_ready`, chỉ trả trạng thái redacted. `SELECT 1` hiện chưa đủ chứng minh schema tương thích.
- [x] Chạy lại baseline unit/typecheck/lint/build và audit; lưu kết quả theo run/commit, tách expected red audit khỏi test thường.
- [x] Lập danh sách data repair dry-run theo mục 4.4, chưa thay đổi dữ liệu khi lập danh sách.

**Cập nhật implementation 02/10/2026:** user xác nhận DB hiện tại là production, chưa có DB test và yêu cầu hoàn thiện local. Unit 578 PASS, typecheck/lint/build API+web PASS; audit 4 PASS/10 FAIL như baseline. Production chỉ đọc, vẫn ở 034; inventory có 4 request thiếu tọa độ. Ba task DB chưa tick ở trên còn BLOCKED theo phạm vi user đã chọn; không áp dụng 035 vào production.

Điểm sửa chính: [schema 035](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/supabase/migrations/202606250035_maintenance_reservations_notification_leases.sql), [schema checker](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/check-live-schema.mjs), [readiness adapter](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/health/health.route-handlers.ts), [DB test guard](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/server/testing/postgres-test-context.ts).

**Nghiệm thu:** source/schema khớp trên test; test guard từ chối application DB; readiness đỏ khi thiếu schema; secrets không xuất hiện trong output. Nếu chưa có test DB, vẫn có thể sửa/test local các batch độc lập nhưng chưa đóng B01 hoặc tuyên bố DB/E2E pass.

**Rollout:** hosted application DB chỉ apply sau khi đã xác định là development/test và việc apply/deploy được cho phép. Với môi trường chưa cập nhật, chặn release code phụ thuộc 035; không tạo fallback SQL che schema sai.

### Batch 01 — Phân quyền, revoke và visibility

Tasks:

- [ ] `AssignmentService.updateStatus` yêu cầu admin hoặc **mechanic hiện tại + đúng mechanicId**. Giữ active-user check.
- [ ] Revoke mechanic khóa profile, kiểm tra mọi assignment chưa terminal gồm future reservations; nếu còn việc trả 409 để admin xử lý việc trước. Không tự orphan/cancel/reassign toàn bộ lịch.
- [ ] Tắt availability khi role còn tồn tại; profile active có thể chuyển suspended theo policy hiện có trước khi revoke. Giữ pending/rejected/banned và lịch sử phù hợp, không tự re-approve khi re-grant.
- [ ] Migration mới giới hạn trigger role vào INSERT và UPDATE các cột vận hành/identity. UPDATE chỉ rating/count/updated_at từ review vẫn hợp lệ trên profile lịch sử không còn role. INSERT hoặc bật/sửa vận hành khi không có role vẫn bị chặn.
- [ ] Kiểm tra dispatch eligibility và admin profile commands không dùng profile cũ không-role như mechanic đang hoạt động. Re-grant giữ unavailable và cần approve/reactivate đúng status.
- [ ] Guard suspend/ban tương tự phải xét appointment còn nghĩa vụ, không chỉ current slot. Kiểm tra accept/activation cạnh tranh với revoke dưới profile lock; re-read role sau khi chờ lock nếu cần.
- [ ] PostgreSQL và in-memory `listVisibleToActor` dùng `(mechanic role AND mechanic owner) OR (rider role AND request owner)`; admin dùng policy riêng. Một assignment thỏa cả hai chỉ xuất hiện một lần.

Điểm sửa: [assignment service](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/assignments/assignment.service.ts), [admin user service](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/admin/admin-user-management.service.ts), [admin mechanic service](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/admin/admin-mechanic-management.service.ts), [assignment SQL](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/server/repositories/postgres/assignment.repository.ts), [rating SQL](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/server/repositories/postgres/review.repository.ts).

**Tests/Done:** A02/A10 đạt policy; PostgreSQL grant → profile → approve → revoke không 23514; còn current/future job thì 409; review lịch sử/rebuild ratings sau revoke pass; self/last-admin protections còn pass; cạnh tranh accept/revoke không nhận thêm việc sau revoke đã commit.

### Batch 02 — Safety gate tiếng Việt

Tasks:

- [ ] Thêm biến thể phổ biến của chết/tắt máy khi đang chạy vào matcher hiện có. Ưu tiên danh sách cụm ngắn; chỉ dùng regex có biên/ngữ cảnh nếu danh sách không đủ cho case đã xác định.
- [ ] Test có dấu/không dấu, đảo thứ tự, dấu câu và các câu không phải đang chạy: “không chết máy”, “đã tắt máy rồi”, “không đề được khi đỗ”. Không dùng một từ “chết máy” để đánh dấu mọi trường hợp nguy hiểm.
- [ ] Kiểm tra câu phủ định có kèm triệu chứng khác thật sự nguy hiểm không làm mất override đó. Giới hạn xử lý phủ định vào phạm vi đã kiểm chứng, không viết NLP engine.
- [ ] Test qua `DiagnosisService` với provider trả câu cho phép tiếp tục và khi provider lỗi: safety vẫn quyết định `can_continue_riding=false`, risk/action đúng.

Điểm sửa: [safety gate](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/chatbot/safety-gate.ts), normalize/pipeline tests hiện có. Giữ local fallback và ASR nguyên workflow.

**Done:** A07 pass; các danger categories cũ không regress; test không gọi AI/ONNX thật.

### Batch 03 — Cancel, recovery và cạnh tranh với tiền

Tasks:

- [ ] Áp dụng ma trận ở mục 4.2 cho status canceled, rider cancel, admin cancel và recovery. Nếu hai command cùng cần guard quote/payment, dùng một helper nhỏ dùng repositories hiện có; không tạo policy framework.
- [ ] Guard theo quote của assignment hiện tại, các agreement IDs và payment orders. Bổ sung query EXISTS nhỏ cho hoạt động payment nếu contract hiện tại chưa đủ; cập nhật cả SQL/in-memory.
- [ ] Request không còn active assignment nhưng có khoản tiền chưa xử lý từ assignment cũ cũng không được hủy như đơn chưa nhận việc. Đưa case legacy này vào điều tra, không làm mất dấu tiền bằng terminal status.
- [ ] Bỏ silent catch trong request synchronization. Request thiếu/transition sai trả controlled conflict và rollback assignment, history, audit, outbox.
- [ ] Chỉ thêm request → canceled transitions cần cho các nhánh được phép. Hủy từ in_service phải chứng minh chưa started/quote/tiền; không suy ra chỉ từ request status thô.
- [ ] Cho owning rider hủy `accepted` chưa travel, chưa quote/tiền; thêm manual_escalation cancel khi không active assignment. Cancel đã assigned phải cập nhật cả assignment/request, giải phóng reservation và đóng open dispatch trong một transaction.
- [ ] Chặn recovery rescue/maintenance đã duyệt công kể cả chưa thanh toán hoặc chọn after_repair. Pending/rejected quote trên assignment hiện tại cũng không thuộc pre-quote recovery.
- [ ] Recovery đủ điều kiện giữ durable outbox re-dispatch, actor/reason restrictions và idempotent replay. Không gọi dispatch/provider ngoài transaction trước khi commit recovery.
- [ ] Sửa thứ tự lock recovery; thống nhất các đường quote/payment success/status/cancel. Webhook re-check workflow dưới khóa và late payment vẫn vào needs_review, không credit vào job đã hủy.
- [ ] Khi bị chặn trả `CONFLICT` kèm bounded reason code, ví dụ `quote_already_issued`, `agreement_exists`, `payment_unresolved`, `work_started`. Không tự đánh dấu một case có tiền đã được giải quyết.
- [ ] Data repair B02 legacy: chỉ case assignment canceled đúng history, không tiền, không replacement active mới thì đồng bộ request bằng command audited; mọi case còn nghi vấn chỉ báo cáo.

Điểm sửa: [assignment/recovery](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/assignments/assignment-recovery.service.ts), [rider request service](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/service-requests/service-request.service.ts), [admin request policy](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/admin/admin-request-state.ts), [payment service](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/payments/payment.service.ts) và hai state maps.

**Tests/Done:** A01/A03 pass; hủy từng trạng thái được phép/không phép; request-update lỗi gây rollback toàn bộ; quote cũ của assignment khác không chặn recovery mới; same-key recovery không duplicate; accept/cancel, approve/cancel, approve/recover, payment-success/cancel/recover chạy concurrent PostgreSQL và chỉ có kết quả hợp lệ. Case post-agreement/paid giữ nguyên assignment và không có recovery event.

### Batch 04 — Dispatch transaction outcomes

Tasks:

- [ ] `startDispatch` trả một kết quả escalation từ UnitOfWork, rồi throw/map 409 sau commit. Giữ response success của round như hiện tại.
- [ ] History/audit/outbox escalation ghi một lần; gọi lại đã escalation không nhân sự kiện. Dùng cùng helper với worker thay vì một nhánh riêng thiếu audit.
- [ ] Rà soát mọi caller của `manualEscalate`, expiry/decline và các nhánh cố ý ghi rồi báo lỗi. Với expired decline cần persist expiry, cũng map conflict sau commit; lỗi validation thuần túy vẫn rollback.
- [ ] Giữ các bản sửa reservation ranking/idempotency đang có sau khi kiểm tra regression; không refactor ranking không cần thiết.

Điểm sửa: [dispatch service](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/dispatch/dispatch.service.ts), dispatch route/service/worker tests.

**Done:** A04 pass; DB thấy manual_escalation dù HTTP 409; hết rounds/hết thời gian/expired decline/worker retry có state đúng và event không trùng.

### Batch 05 — Địa điểm và lịch hẹn đầy đủ

**05A: create/PATCH location**

- [ ] Require coordinates cho mobile_repair, at_home và cả hai fulfillment modes của other; at-home/scheduled_visit vẫn yêu cầu address và giờ tương lai. Emergency/maintenance giữ điều kiện đang có.
- [ ] Mở rộng owner PATCH hiện có để sửa service location/address trước matching, khi chưa có round/assignment/cam kết. Request đã dispatching/offered/assigned trả conflict; giữ phạm vi nhỏ của PATCH thay vì thêm rescheduling sau matching.
- [ ] PATCH location/schedule tại manual_escalation chỉ hỗ trợ bổ sung input legacy trước matching, không tự bỏ kiểm soát admin; retry ở Batch 09. Request assigned/travel/paid không sửa địa điểm/lịch qua PATCH này.
- [ ] Emit maintenance matching event chỉ cho maintenance đủ điều kiện submitted; các loại khác giữ entry point dispatch hiện có. Không gửi at-home/other vào consumer maintenance bằng việc mở rộng PATCH.
- [ ] API errors ghi rõ thiếu `location`; docs/examples đổi contract. Guard DB mới cho insert/thay đổi điểm phục vụ nếu cần, không validate lại legacy row trên update status cancellation.

**05B: scheduled fulfillment**

- [ ] Xác định scheduled bằng request.scheduledStartAt/fulfillment policy, không riêng serviceType maintenance.
- [ ] Reuse buffer 30 phút và duration 15–480 phút hiện có; mọi scheduled accept cần estimated_duration_minutes. Không bắt immediate clients gửi trường mới.
- [ ] Dispatch conflict/ranking áp dụng đúng khoảng thời gian cho at-home/other; offer dùng minimum duration để lọc sơ bộ, accept kiểm tra duration thực và DB exclusion.
- [ ] Future appointment không chiếm current work slot. `en_route` chỉ được activation trong preparation window và khi current slot trống, mechanic vẫn có role/profile hợp lệ.
- [ ] Worker preparation, accepted/canceled notifications dùng nội dung đúng loại dịch vụ; không gọi lịch at-home là lịch bảo dưỡng. Giữ event cũ của maintenance cho compatibility/dedupe.
- [ ] Scheduled appointment đã quá giờ/không đến được có conflict và đường admin điều tra/hủy/reassign theo policy; không âm thầm kích hoạt hoặc bỏ reservation.
- [ ] Dry-run nhận diện at-home/other legacy đã accepted nhưng chưa có scheduled reservation. Chỉ backfill khi chưa travel/quote/tiền và duration được xác nhận; case đã travel hoặc overlap đưa cho admin xử lý, không viết lại history để giả định chưa đi.

Điểm sửa: [create/PATCH service](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/service-requests/service-request.service.ts), [accept](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/assignments/accept-assignment.service.ts), dispatch/status services, [dispatch worker](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/server/workers/dispatch.worker.ts), reservation repositories/tests.

**Tests/Done:** A08 đổi thành oracle “create address-only bị 400 trước persist” và thêm create-with-location → accept; A09 accept với duration hợp lệ rồi travel sớm bị 409. Kiểm tra đúng biên now, start-window, [start,end), overlapping/nonoverlapping, current job + future appointment, cancel giải phóng lịch và race activation hai lịch.

### Batch 06 — Mechanic job detail

Tasks:

- [ ] Thêm `GET /api/v1/mechanics/me/jobs/{assignmentId}`; actor phải active, có mechanic role và là mechanic được gán. Admin tiếp tục read qua admin API; rider qua owner API.
- [ ] DTO gồm assignment/status/lịch, request code/type/problem, service coordinates/address, xe cần phục vụ, media references được phép, latest relevant quote/agreement và checklist summary nếu có.
- [ ] Reuse repository/mappers hiện có; thêm bounded detail query khi composition có N+1. Không đổi jobs summary thành payload lớn.
- [ ] Không lộ internal admin note, token, payment provider payload, raw storage path/secrets hoặc thông tin liên hệ không cần cho công việc. DTO tài chính chỉ lấy phần quote được phép, không trả ledger/provider response.
- [ ] History đã terminal vẫn đọc được summary công việc của chính mechanic; giới hạn thông tin vị trí/contact theo privacy policy và retention hiện có.

Điểm sửa: [mechanic job service](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/mechanic-operations/mechanic-job-list.service.ts), mapper/types/route handlers và route mới.

**Done:** A06 dùng API detail mới để chứng minh restore; GET request của người khác vẫn 403; restart không phụ thuộc open offer; response không có private admin fields.

### Batch 07 — Giá trị quote hợp lệ

Tasks:

- [ ] Sau calculateQuote, `purpose=standard` yêu cầu total > 0 và nằm trong giới hạn amount thật sự payment hỗ trợ. Giữ calculator làm số học tổng quát, không cấm mọi line 0 hoặc cấm rescue parts rỗng.
- [ ] Validation hoàn thành trước supersede/insert/transition, tránh pending quote cũ bị mất khi quote mới invalid.
- [ ] Pending legacy standard 0 không được approve để vào awaiting_payment; trả conflict yêu cầu quote thay thế. Approved legacy 0 đưa vào danh sách cần xử lý admin, không sửa approved total hoặc sinh fake payment.
- [ ] Standard >0 vẫn yêu cầu succeeded trước in_progress. Rescue đã paid đủ total có thể remaining=0 và completed mà không tạo order 0; maintenance additions giữ cách tính cumulative.

Điểm sửa: [quote service](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/quotes/quote.service.ts), quote schema/calculator tests và payment boundary tests.

**Done:** A05 đổi oracle thành “reject total 0 khi create”, kèm regression work-start >0 vẫn chặn unpaid. Preserve audit log gốc và ghi rõ lựa chọn nghiệp vụ; không sửa assertion chỉ để bỏ một FAIL.

### Batch 08 — Profile và danh sách rider

Tasks:

- [ ] POST /auth/profile vẫn bootstrap. Bổ sung PATCH tự sửa display_name với schema strict, actor row lock và active check; không chấp nhận roles/status/account_type/rating/verified fields.
- [ ] Reuse user repository; audit ghi loại thao tác/trường thay đổi, không copy tên hoặc PII không cần vào outbox.
- [ ] Service-request list parse status/date_from/date_to/limit/cursor, reject query không hợp lệ; default limit 20, max 100, sort ổn định `(created_at,id)` và owner predicate trong mọi query.
- [ ] Giữ `items`, bổ sung `page` có next_cursor/has_more; docs nói rõ giới hạn mới và cách đi trang. Không silently truncate mà không có cursor. Kiểm tra consumer contract trước rollout.
- [ ] Rà soát assignment list dùng bởi rider/admin có bounded pagination tương ứng, giữ visibility hợp sau Batch 01. Không mở unrestricted query để tiện dashboard.

**Done:** PATCH đổi display name, gọi POST lại không giả làm update; roles/status injection bị 400; user khác không sửa được; pagination không trùng/mất item ở timestamp bằng nhau và không lộ đơn khác; filter thật sự tác động SQL.

### Batch 09 — Admin dispatch retry và giải thích đơn kẹt

Phạm vi tương ứng phần cần thiết của Patch E, T065–T083; manual assignment chuyển Batch 10.

Tasks:

- [ ] Read dispatch status/round detail/eligible mechanics/explanation bằng dữ liệu đã lưu và eligibility thật. Trả tất cả lý do loại phù hợp: inactive/role, skill, stale location, radius, current work, reservation và search limits; redacted và bounded.
- [ ] Command expire overdue round, retry search và cancel dispatch có reason/idempotency. Request manual_escalation không active assignment được admin retry → submitted → matching hoặc cancel request theo Batch 03.
- [ ] Retry mở search episode mới có provenance/budget rõ, không sửa/xóa round cũ và không mở lại vì đọc cùng request vô hạn. Tận dụng currentSearchRounds/recovery boundary; nếu chưa có marker episode đủ rõ, thêm field tối thiểu.
- [ ] Phân biệt cancel dispatch với cancel request: dừng matching chuyển manual_escalation, còn hủy nhu cầu chuyển canceled. Không để request offered nhưng tất cả offers đã bị đóng mà không có action tiếp theo.
- [ ] Reuse dispatch ranking/round creation trong service chung, không copy thuật toán cho admin. Notifications nói đúng kết quả; worker/rider/admin dùng cùng domain rules.

**Done:** manual_escalation có đường retry/cancel thực tế; exhausted retry không quay vòng vô hạn; cạnh tranh retry/worker/accept không tạo hai active rounds hoặc assignment thứ hai; rider/mechanic không gọi được admin mutation.

### Batch 10 — Admin assignment operations và manual assignment

Phạm vi Patch F, T084–T097 và manual assign của Patch E.

**10A: read models**

- [ ] Admin assignment detail/timeline/internal note; dùng history/audit/metadata có sẵn. Redaction theo admin contract, pagination có giới hạn.
- [ ] Hiển thị current vs future appointment, quote/agreement/payment commitment và safe next action codes; không đề xuất reassign/cancel nếu guard sẽ cấm.

**10B: commands**

- [ ] Migration source/provenance/replacement fields, source-dependent candidate constraint và uniqueness cho replacement. Không dùng migration 017 cũ; không fake offer ID cho manual assignment.
- [ ] Rà soát mọi caller của acceptedCandidateId khi field trở thành optional theo source: assignment DTO/mappers, quote pricing, admin/mechanic reads và test fixtures. Contract biểu diễn rõ manual source không có offer; không trả UUID giả để giữ type cũ.
- [ ] Admin manual assign chỉ khi request chưa có active assignment, target có current role/profile/skill/location/radius/availability hợp lệ, không current/reservation conflict và không phát sinh chuyển tiền. Tất cả eligibility được re-check dưới khóa.
- [ ] Source manual có thể không có accepted candidate. Lưu snapshot khoảng cách được server tính để rescue labor pricing vẫn hoạt động; acceptance thông thường cũng lưu snapshot từ candidate, quote giữ fallback cho legacy candidate. Không tin khoảng cách do admin/client nhập.
- [ ] Thêm đúng request transitions cần cho canonical admin manual assignment, vẫn khóa command theo quyền/state; không dùng public status API để bypass matching.
- [ ] Reassign chỉ accepted/en_route thực sự chưa quote/tiền; giữ assignment cũ recovery_canceled, replacement link và hai lịch sử trong cùng transaction. Reuse internal transaction helper, không gọi hai public services với UnitOfWork lồng nhau.
- [ ] Các API cancel/resolve-stuck chỉ delegate command hợp lệ: cancel-before-commitment, pre-quote recovery/reassign, expire/retry matching, hoặc ghi case đang cần điều tra. Không arbitrary status input/force completed.
- [ ] Paid/approved commitment trả conflict có reason code và note/history; không cấp quyền chuyển tiền cho admin bằng manual assign.

**Done:** manual/reassignment có nguồn và history chứng minh; quote rescue trên manual source vẫn tính khoảng cách server đúng; simultaneous manual assignments/reassignments chỉ một thắng; current slot + reservations đúng; profile inactive, location stale, thiếu skill và quote/payment commitment đều bị chặn.

### Batch 11 — Admin diagnosis/quote supervision

Phạm vi Patch G, T098–T111, reconcile với workflow rescue/maintenance hiện tại.

Tasks:

- [ ] Read diagnosis/quote history và request revision bằng append-only supervision action, notification cho đúng actor. Không sửa diagnosis/quote content đã phát hành.
- [ ] Thêm `voided` cho pending quote bằng enum migration riêng; commit enum trước migration dùng giá trị mới. Void có reason/idempotency và không áp dụng approved/paid quote.
- [ ] Expire chỉ quote đủ điều kiện/time policy; void không dùng tên expire để che việc hủy quote chưa hết hạn.
- [ ] Sau void/expire, reset workflow theo purpose: pre-travel labor → accepted/assigned; standard/final/work chưa bắt đầu → trạng thái cho phép quote mới; pending maintenance addition → giữ approved work hiện tại in_progress. Không đổi agreement/labor cố định đã approved.
- [ ] Quote dispute chỉ các action trong contract: request_revision, void_pending_quote, uphold_latest_quote, với audit và role checks. Không tự giảm tiền hoặc tạo refund.
- [ ] Admin void/revision và rider approve cạnh tranh cùng locks; chỉ một kết quả hợp lệ. Cancel pending quote sau Batch 03 dùng canonical void rồi cancel, không bỏ pending quote bằng status endpoint.
- [ ] Mở nhánh canonical admin cancel cho quote đã void/rejected/expired, chưa agreement approved/tiền và chưa work, sau khi re-check dưới cùng locks. Guard recovery vẫn cấm mọi quote đã phát hành; public mechanic/rider cancel không được dùng quote history đã đóng để nới quyền.
- [ ] Reconcile spec/static “no payment” cũ với backend đã có payment: admin supervision không mutate ledger/provider nhưng phải đọc commitment để chặn thao tác sai.

**Done:** quote content/version giữ bất biến; void/expire/approve race không commit hai quyết định; rescue labor đã approved không đổi; additions không xóa công việc đã duyệt; approved legacy standard 0 chỉ được báo cáo/điều tra theo policy, không sửa tổng.

### Batch 12 — Delivery operations và audit

**12A: notification/outbox recovery — Patch H1**

- [ ] Admin list/detail/delivery-summary/worker-health reuse bốn operational queues hiện có, không tạo một monitoring stack mới.
- [ ] Retry notification chỉ receipt thất bại, không sent, còn delivery credential hợp lệ và không active lease. Retry outbox dead-letter reset retry/next-attempt theo policy, giữ payload/domain identity.
- [ ] Cancel notification là dừng delivery chưa gửi, không thay unread/read state và không xóa inbox lịch sử. Abandon outbox ghi reason/provenance, worker không claim lại.
- [ ] Phân loại topic được abandon an toàn; không bỏ domain handoff tài chính/nghiệp vụ quan trọng chỉ để xóa cảnh báo. Retry không tái tạo quote/payment/assignment đã tồn tại.
- [ ] Enum canceled/abandoned nếu cần có migration commit boundary; worker claim/lease queries cập nhật cùng batch. Admin không đặt `sent` thủ công hoặc gọi FCM trực tiếp.

**12B: audit query/export**

- [ ] Cursor queries theo actor/entity/action/date và admin actions; giới hạn ngày/số bản ghi/thời gian.
- [ ] Export định dạng đơn giản theo contract, bounded; audit source không update/delete/reorder. Một export thành công append đúng một access-audit chứa filter hash/count/actor/time, không copy exported content.
- [ ] DTO loại secrets, PII/narrative/provider errors thô; test authorization và redaction cho cả read/export.

**Done:** retry/worker race không double deliver; cancel/abandon không làm event đang leased bị commit sai; inbox read-state nguyên ý nghĩa; domain replay không duplicate; export có access evidence và không mutate nguồn.

### Batch 13 — Reminder recovery, dashboard và spec reconciliation

**13A: reminders — Patch H2**

- [ ] Admin rule/occurrence list/detail/worker-health, enable/disable và failed-occurrence retry có reason/idempotency.
- [ ] Không retry sent/dismissed hoặc active lease; giữ occurrence/request dedupe. Archived motorcycle không được re-enable reminder hoặc tạo job mới.
- [ ] Race disable/archive/retry/worker không sinh duplicate maintenance request/push; chỉ date/time, không thêm kilometer/odometer.

**13B: dashboard — Patch I**

- [ ] Derived SQL summary cho request/dispatch/assignment/mechanic/worker và stuck workflows; reuse operational queries và bounded date filters, không tạo dashboard table/cache nếu chưa có nhu cầu đo được.
- [ ] Bao gồm state divergence, manual escalation, quá cửa sổ appointment/chưa activated, pending quote/payment quá hạn, outbox dead-letter và worker thiếu tiến độ theo contract đã reconcile.
- [ ] Safe action codes trỏ tới command Batch 09–12 và phản ánh commitment/lease thực tế. Không hiển thị resolve đã có API khi chỉ hỗ trợ ghi chú điều tra.
- [ ] Đối chiếu tasks/contracts feature 003: đánh dấu reuse/done/superseded/deferred theo evidence; sửa số migration cũ và các giả định tiền/provider lỗi thời. Không chỉ tick đủ 111 ô.
- [ ] Cập nhật handbook/AGENTS/workflow setup chỉ cho hành vi đã implement, tách source migration với migration thực sự deployed.

**Done:** aggregate đối chiếu đúng fixture SQL; appointment không bị tính sai vào current work; mỗi stuck case không trùng và có action hợp lệ; reminder retry không spam hoặc tạo lại đơn.

### Batch 14 — Nghiệm thu E2E và release

Tasks:

- [ ] Cập nhật oracle audit theo các quyết định đã công bố: A05 reject zero, A08 require location, A06 đọc detail riêng, A09 scheduled accept có duration. Giữ báo cáo/log trước sửa để chứng minh vấn đề gốc và lý do đổi oracle.
- [ ] Đưa regression phù hợp vào test thường; reuse fixtures/harness đang có, không giữ lỗi cốt lõi chỉ ở bộ audit ngoài default test.
- [ ] Chạy HTTP với Supabase JWT/DB test thật: bootstrap rider/mechanic, admin approve, request/dispatch/accept, diagnosis/quote, ký webhook, progress, checklist, review, inbox. Trạng thái paid/completed không được SQL seed để vượt bước.
- [ ] Chạy nhánh admin retry/manual assign/reassign/void/delivery retry/reminder retry rồi đọc kết quả lại qua API của rider/mechanic.
- [ ] Chạy PostgreSQL concurrency theo ma trận ở mục 7; thử restart khi đã accept, khi payment link đang initialize và khi worker đã claim lease.
- [ ] Chạy worker matching/recovery/dispatch/reminder/outbox/payment reconcile qua protected route/CLI, không gọi service trực tiếp để thay thế bằng chứng handoff HTTP.
- [ ] Provider mode tách rõ: mock kiểm tra deterministic HTTP/signature/race; payOS configured test kiểm tra contract/network và nếu cần verified payment thật bằng transaction có authorization; FCM cần device observer để chứng minh push đến Android/iOS.
- [ ] ETA/live tracking chỉ nghiệm thu provider/config thật khi feature enabled hợp lệ; disabled phải trả lỗi/status đúng và không bị đánh dấu implementation fail. Không ép bật Maps/live để làm báo cáo xanh.
- [ ] `pnpm.cmd test`, typecheck, lint, build toàn workspace; DB integration qua test:db và HTTP suite riêng. Lưu run/commit/config mode/results, tách PASS/FAIL/BLOCKED.
- [ ] Apply/verify migration trên development/hosted đã được phép, chạy smoke sau rollout, cập nhật schema evidence và không seed production.

**Done:** không còn B01–B12 chưa xử lý trong scope đã chọn; core và admin E–I có đủ route/service/test/SQL evidence; mọi blocked provider/device/business-policy được nêu cụ thể. Không tuyên bố “toàn bộ E2E” nếu chỉ có mock hoặc thiếu các bước tiền/push quan trọng.

### Batch 15 — Optional operational configuration

Chỉ thực hiện khi nhóm cần sửa dispatch policy qua admin API; không phải điều kiện sửa 12 lỗi.

- [ ] Bốn keys: radius_steps_km, offer_expiry_seconds, max_rounds, total_wait_seconds theo Patch J.
- [ ] Defaults/bounds/cross-field validation, version history, row locks, reason/idempotency/audit; immutable history.
- [ ] Provider budget chỉ read-only metadata; không lưu secret, không sửa payment timing/maintenance workflow/feature flags qua API cấu hình chung.

**Done:** keys ngoài allowlist bị từ chối; config invalid rollback; disabling Patch J vẫn chạy defaults. Pricing/cancellation fee engine và refund là backlog riêng, không gộp vào batch này.

## 7. Ma trận kiểm tra và tiêu chí đóng từng batch

| Nhóm | Happy path cần có | Nhánh ngoại lệ/race bắt buộc |
|---|---|---|
| Auth/roles | Rider, mechanic pending→approved, admin; actor nhiều role | Suspended/archived, former mechanic, other owner, last admin, revoke/accept/future reservation, review sau revoke |
| Standard | Create→dispatch→accept→travel→diagnosis→quote→approve→verified pay→work→complete→review | 0đ, invalid total, reject/expire/revision, unpaid start, cancel từng giai đoạn |
| Rescue upfront | Agree labor→pay labor→travel→approve parts→work→remaining pay→complete | Recovery sau agreement/paid bị chặn; parts rỗng; remaining=0; reject/recall; late/mismatched payment |
| Rescue after_repair | Agree labor→travel→approve final→work→pay total→complete | Chưa trả tiền vẫn không pre-quote recover sau agreement; không đổi công đã chốt |
| Maintenance | Future reserve→agree labor→window activation→materials→work/additions→quote-bound checklist→pay→complete | Overlap, early travel, stale basis/addition/checklist, pending addition, archived bike/reminder, current job + future lịch |
| At-home/other | Location+address+schedule→offer→duration accept→window travel→standard quote/pay/work | Address-only, passed schedule, early travel, schedule/location PATCH vs accept, booking cancel |
| Admin | Retry/cancel/manual assign/reassign/void/revision/delivery/reminder commands | Reason/key missing, payload mismatch, stale state, no force paid/status, lease conflict, privacy redaction |
| Workers/provider | Recovery/reminder matching→outbox→inbox/delivery; reconciliation | Duplicate event, lease expiry/restart, provider 429/5xx/timeout, invalid signature/currency/amount, abandoned work |
| Safety | Câu nguy hiểm tiếng Việt qua pipeline | Đảo từ/không dấu/phủ định, provider trả unsafe, fallback khi provider lỗi |

Race suite tối thiểu: accept–accept; accept–rider cancel; approve–cancel; approve–recover; webhook success–cancel/recover; revoke–accept/activation; activation–activation; retry–worker/accept; manual assign–manual assign; reassign–reassign; void/expire–approve; delivery/reminder retry–worker claim.

Sau mỗi batch implementation:

1. Focused regression của bug/feature và checks phù hợp SQL/security/money; không thêm test mirror implementation.
2. `pnpm.cmd test` theo AGENTS. Typecheck/lint cho thay đổi lớn; `pnpm.cmd run build` khi đổi route/schema/TypeScript, xử lý lỗi trước khi đóng batch.
3. DB tests bắt buộc cho batch đụng trigger/constraint/row lock. Local pass không thay thế DB pass.
4. Report scope, files, migration, hành vi trước/sau, kết quả mới và blockers. Không dùng lại PASS của commit khác.
5. Review diff để giữ thay đổi của user/công việc khác; không force push/deploy. Commit khi được yêu cầu, mỗi batch/tiểu batch giữ phạm vi rõ.

## 8. Release, rollback và định nghĩa hoàn thành

- Migration theo hướng bổ sung trước, code sau; enum commit riêng khi PostgreSQL yêu cầu. Không down-migration phá dữ liệu để rollback app.
- Batch 01 trigger change cần verification historical rating; Batch 05 và 07 thay input contract cần consumer compatibility note; Batch 10–12 cần schema trước khi enable routes/workers liên quan.
- Data repair phải được dry-run và review theo IDs. Ưu tiên forward repair có history; không truncate/reset app DB và không viết lại approved money.
- Với code đã phụ thuộc 035, release gate phải yêu cầu 035 thật; không cho ready chỉ vì kết nối DB được.

Ba mức hoàn thành:

1. **Core ổn định:** 00–08 đạt acceptance; B01–B12 hết nhánh sai đã xác định; rider/mechanic có các API đủ cho workflow MVP hiện có.
2. **Admin đủ vận hành trong scope:** 09–13 đạt E–I contract đã reconcile; đơn manual_escalation/pending quote/delivery/reminder lỗi có safe command tương ứng. J vẫn optional.
3. **Sẵn sàng chạy môi trường mục tiêu:** Batch 14 có HTTP/JWT/SQL/workers và evidence provider cần thiết. Thiếu test DB/device/verified payment thật là giới hạn được ghi nhận, không được quy đổi thành PASS.

Trường hợp không thể tiếp tục do mất mechanic sau agreement/đã paid vẫn cần workflow tài chính/abort riêng để đóng hoàn toàn. Plan này ngăn redispatch/thu tiền lặp và cho admin điều tra; không tuyên bố đã hoàn tất refund hoặc compensation. Bổ sung feature đó chỉ sau khi chốt policy và phạm vi.

## 9. Cách bắt đầu implementation

Bắt đầu **Batch 00**, tiếp theo **01 → 02 → 03 → 04** để xử lý schema, quyền, safety và tính nhất quán. Sau đó **05 → 06 → 07 → 08**, chạy gate core trước khi mở rộng admin. Hoàn thiện **09 → 10 → 11 → 12 → 13** rồi nghiệm thu **14**. Mọi batch đều có output review được và test chứng minh; không gom bug fixes, mở rộng admin và policy tài chính vào một patch lớn.
