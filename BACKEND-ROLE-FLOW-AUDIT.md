# Kiểm tra backend/API: rider, mechanic và admin

Ngày kiểm tra: **01/10/2026, giờ Việt Nam**. Phạm vi: working tree hiện tại, bao gồm các thay đổi chưa commit trong `apps/api` và migrations. Đây là audit; chưa sửa implementation hoặc áp dụng migration.

## Kết luận

**Chưa thể xác nhận backend đã hoàn thành end-to-end hoặc đủ toàn bộ chức năng cho ba role.** Các luồng thuận lợi chính có thể chạy xuyên tầng service, nhưng còn lỗi nhánh ngoại lệ, thiếu chức năng vận hành và database chưa tương thích với code hiện tại.

- Database ứng dụng hiện chỉ ghi nhận migration **034**; code đã phụ thuộc **035**. Hai truy vấn kiểm tra cột thật thất bại với PostgreSQL **42703: undefined_column**.
- Bộ test hiện có: **168 file / 564 test PASS**.
- Audit bổ sung: **4 chuỗi nghiệp vụ PASS**, **10 kiểm tra không đạt**. Trong 10 kiểm tra này có lỗi logic và khoảng trống chức năng; không quy đổi tất cả thành lỗi vi phạm spec.
- Admin feature 003 mới đánh dấu hoàn thành **T001–T064**, còn **111 task mở**. Một số chức năng monitoring/payment/recovery được bổ sung ở feature khác, nhưng chưa thay thế toàn bộ phần admin còn thiếu.
- Typecheck, lint và production build API PASS. Những kết quả này không kiểm tra schema database đang triển khai.

## Bằng chứng đã chạy trong lần audit này

| Kiểm tra | Kết quả | Giới hạn |
|---|---|---|
| `pnpm.cmd test` | 564/564 PASS | Unit/static/route; DB integration được loại khỏi lệnh này |
| `pnpm.cmd run typecheck` | PASS | Kiểm tra TypeScript |
| `pnpm.cmd run lint` | PASS | Kiểm tra lint |
| `pnpm.cmd run build:api` | PASS | Build API, không xác minh DB hoặc provider thật |
| Bộ audit riêng | 4 PASS / 10 FAIL | Service thật, repository trong bộ nhớ, provider giả |
| Database ứng dụng | Kết nối và đọc được | Chỉ dùng transaction `READ ONLY` |
| Schema dùng bởi code mới | FAIL | Migration 035 chưa có; thiếu cột assignments và notification receipts |
| DB integration / HTTP đủ ba role | Chưa chạy mới | `TEST_DATABASE_URL` trỏ cùng database ứng dụng; không đủ điều kiện chạy bộ integration an toàn |

Log và mã kiểm tra:

- [Unit tests](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/unit-tests.log), [typecheck](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/typecheck.log), [lint](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/lint.log), [build](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/build.log).
- [10 kiểm tra tái hiện và 4 chuỗi thuận lợi](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/role-flows.test.ts), [kết quả](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/reproductions.log).
- [Bằng chứng schema hiện tại](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/schema-evidence.json), [script chỉ đọc](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/audit/check-live-schema.mjs).

Chạy lại từ thư mục repository:

```powershell
pnpm.cmd --filter @careonroad/api exec vitest run --config audit-role-flows.config.ts
node apps/api/audit/check-live-schema.mjs
```

Bộ audit đặt ngoài `src/**`, nên không nằm trong `pnpm.cmd test` mặc định. Các assertion mô tả hành vi mong muốn và đang cố ý báo FAIL để lưu bằng chứng các vấn đề; một số cách xử lý nghiệp vụ có thể cần thống nhất khi sửa.

## Các phát hiện cần xử lý

### B01 — P1: Database chưa có migration 035 mà code đã sử dụng

**Đã xác minh trực tiếp bằng truy vấn chỉ đọc.** Migration history có 34 phiên bản, mới nhất `202606250034`; không có `202606250035`.

`assignments` thiếu các cột lịch/reservation/activation. `notification_delivery_receipts` thiếu các cột lease/retry mới. Hai câu `SELECT ... LIMIT 0` trên các cột này đều nhận `42703`.

Hậu quả: query workload/nhận việc và notification delivery có thể thất bại dù build và unit tests pass. Đây là vấn đề tương thích giữa code và database, không chỉ thiếu một feature tùy chọn.

Nguồn: [migration 035](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/supabase/migrations/202606250035_maintenance_reservations_notification_leases.sql:4), [assignment repository](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/server/repositories/postgres/assignment.repository.ts:155), [notification claim](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/server/repositories/postgres/notification-delivery.repository.ts:34).

Xử lý: kiểm tra và áp dụng 035 trên đúng project development/test trước khi xác nhận các API phụ thuộc chạy được. Tài liệu hiện vẫn ghi mốc 034 cũng cần cập nhật sau khi triển khai được xác minh.

### B02 — P1: Hủy assignment làm request và assignment lệch trạng thái

**Tái hiện A01:** `accepted → en_route → canceled` thành công ở assignment, nhưng request vẫn `mechanic_en_route`.

`maybeUpdateRequestForAssignmentStatus()` bắt lỗi transition rồi `return`. Request state machine không cho các trạng thái sau khi di chuyển/sửa chuyển sang `canceled`, trong khi assignment state machine cho phép. Các nhánh `on_site`, `diagnosis`, `quoted`, `awaiting_payment`, `in_progress` cũng chịu cùng nguyên nhân khi hủy không có request transition tương ứng.

Hậu quả: thợ được giải phóng nhưng khách vẫn thấy đơn đang chạy; rider/admin không thể hủy qua request endpoint vốn chỉ nhận trạng thái trước assignment. Đơn không có đường kết thúc/re-dispatch bình thường.

Nguồn: [đồng bộ bị bỏ qua](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/assignments/assignment.service.ts:329), [request transitions](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/service-requests/service-request-state.ts:3).

Xử lý: thống nhất policy hủy theo giai đoạn và tiền đã thu; transition không hợp lệ phải rollback cả thao tác, không commit một nửa workflow.

### B03 — P1: Recovery “trước báo giá” vẫn cho hủy thỏa thuận cứu hộ đã trả tiền

**Tái hiện A03:** thợ tạo `rescue_labor` 100.000đ → rider duyệt `labor_upfront` → payment được provider giả xác minh `succeeded` → mechanic gọi recovery `cannot_continue` vẫn thành công.

Sau khi duyệt công, assignment quay về `accepted` và request về `assigned`. Recovery chỉ xét hai trạng thái này hoặc `en_route`, không kiểm tra agreement/quote/payment đã có.

Hậu quả: assignment đã thu tiền chuyển `recovery_canceled`, request được xếp tìm thợ lại. Tiền đã trả vẫn gắn với assignment cũ; báo giá/payment mới tính theo assignment mới. Có nguy cơ khách phải trả công lần nữa và không có workflow hoàn tiền/chuyển khoản công trong scope hiện tại.

Nguồn: [điều kiện recovery](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/assignments/assignment-recovery.service.ts:83), [thu tiền theo assignment](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/payments/payment.service.ts:195).

Xử lý: khóa recovery trước báo giá khi đã có thỏa thuận hoặc tiền; chỉ mở recovery sau thỏa thuận khi đã định nghĩa cách xử lý tài chính và lịch sử.

### B04 — P1: Admin không thu hồi được role mechanic khi đã có profile

**Phân tích code/migration, có bằng chứng HTTP cũ; chưa thực hiện mutation DB mới trong audit này.** Service xóa role mechanic trước, sau đó gọi `updateAvailability(false)` trên mechanic profile. Trigger chạy trước mọi update profile và yêu cầu role mechanic còn tồn tại, nên update này bị `23514`, transaction rollback.

Báo cáo HTTP hiện có ghi nhận cùng thao tác nhận `422 DATABASE_CONSTRAINT_VIOLATION`; unit test trong bộ nhớ vẫn pass vì repository giả không thực thi trigger PostgreSQL này.

Nguồn: [thứ tự thu hồi role](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/admin/admin-user-management.service.ts:398), [trigger bắt buộc role](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/supabase/migrations/202606250006_motorcycles_and_mechanics.sql:73), [HTTP observations](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/tests/http/EXECUTION-NOTES.md:11).

Xử lý: cập nhật profile khi role còn tồn tại rồi mới thu hồi, đồng thời xác định policy cho các assignment đang hoạt động. Cần một test PostgreSQL cho đúng chuỗi grant → tạo profile → revoke.

### B05 — P1: Status endpoint thiếu kiểm tra role mechanic hiện tại

**Tái hiện A02:** actor còn active, là chủ assignment cũ nhưng chỉ còn role rider, vẫn chuyển assignment sang `en_route` thành công.

Điều kiện chỉ xét `admin` hoặc `assignment.mechanicId === actor.id`; không yêu cầu role mechanic. Các service diagnosis/quote/metadata khác có kiểm tra role nên hành vi phân quyền không nhất quán.

Tình huống này có thể xuất hiện sau một đường thu hồi role được sửa hoặc thay đổi role khác; test dùng fixture có role đã bị thu hồi, không tuyên bố API revoke hiện tại đã chạy thành công.

Nguồn: [authorization của status](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/assignments/assignment.service.ts:90).

Xử lý: yêu cầu actor có role mechanic và đúng ownership, hoặc có role admin.

### B06 — Khoảng trống chức năng: Thợ không khôi phục được đầy đủ thông tin job đã nhận

**Tái hiện A06:** mechanic gọi GET service request nhận 403; jobs/dashboard chỉ trả request code, service type, status, priority và lịch, không có mô tả sự cố, địa chỉ hoặc tọa độ điểm phục vụ. Assignment list cũng không có các trường này.

Offer DTO có thông tin điểm phục vụ trước khi accept, nhưng offer list chỉ trả offer đang mở. Khi app khởi động lại hoặc không giữ cache offer, không có API detail tương đương để đọc lại thông tin này. Route ETA chỉ trả khoảng cách/thời gian, không trả destination.

Đây là thiếu chức năng phục vụ mechanic end-to-end; không phải khẳng định jobs summary vi phạm thiết kế read-model hiện tại.

Nguồn: [request chỉ dành cho rider](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/service-requests/service-request.service.ts:156), [job DTO](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/mechanic-operations/mechanic-operations.mappers.ts:136), [offer list](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/dispatch/dispatch.service.ts:260).

Xử lý: bổ sung một read API cho mechanic được gán, với mô tả, điểm phục vụ và thông tin xe cần thiết; kiểm tra ownership và tránh mở quyền đọc tùy ý mọi request.

### B07 — P2: Request chỉ có địa chỉ tạo được nhưng không vào dispatch được

**Tái hiện A08:** `mobile_repair` với `address_text`, không có tọa độ, được create chấp nhận; dispatch trả 400 vì bắt buộc `serviceLocation`.

Validation cũng cho phép `at_home_service` và các biến thể `other` dùng địa chỉ mà không có tọa độ. Hiện chưa có geocoding hoặc admin manual-assignment workflow để nối các đơn này sang nhận việc. Maintenance PATCH không sửa được các loại request đó.

Nguồn: [create cho phép địa chỉ](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/service-requests/service-request.service.ts:546), [dispatch bắt buộc tọa độ](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/dispatch/dispatch.service.ts:85).

Xử lý: yêu cầu tọa độ ngay khi create cho các luồng hiện chỉ dispatch theo tọa độ, hoặc triển khai một đường fulfillment hợp lệ cho address-only trước khi tiếp tục cho tạo.

### B08 — P2: Lịch at-home bị bỏ khi nhận việc

**Tái hiện A09:** request `at_home_service` hẹn ngày hôm sau, mechanic accept rồi chuyển `en_route` ngay hiện tại vẫn thành công.

Accept chỉ sao chép lịch/reservation khi `serviceType === periodic_maintenance`. `at_home_service` và `other/scheduled_visit` có lịch trên request nhưng assignment được coi là việc tức thời; không có cùng kiểm tra cửa sổ di chuyển/đặt chỗ.

Nguồn: [chỉ bảo dưỡng có scheduled assignment](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/assignments/accept-assignment.service.ts:76).

Xử lý: định nghĩa policy cho tất cả dịch vụ có lịch. Nếu at-home chỉ hỗ trợ lưu giờ hẹn trong MVP thì cần ghi rõ giới hạn; không thể coi chức năng lịch hẹn đã hoàn chỉnh.

### B09 — P2: Dispatch báo đã escalation nhưng thay đổi bị rollback

**Tái hiện A04:** sau bốn round hết hạn, rider gọi dispatch nhận 409 “request escalated”, nhưng request vẫn `offered`.

Service gọi `manualEscalate()` rồi throw bên trong `UnitOfWork.execute`; transaction rollback cả escalation và history. Worker có đường xử lý khác có thể escalation thành công, nhưng không làm nhánh rider này đúng.

Nguồn: [throw sau escalation](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/dispatch/dispatch.service.ts:102), [transaction](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/server/db/transaction.ts:34).

Xử lý: hoàn tất transaction trước khi map kết quả thành HTTP conflict, hoặc trả một kết quả nghiệp vụ đã commit.

### B10 — P2: Báo giá standard tổng 0đ làm workflow kẹt

**Tái hiện A05:** quote 100.000đ, discount 100.000đ được tạo và duyệt. Assignment/request chuyển `awaiting_payment`. Payment order từ chối số tiền 0đ; bắt đầu việc lại đòi payment `succeeded`.

Nguồn: [calculator cho tổng 0](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/quotes/quote-calculator.ts:65), [payment amount guard](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/payments/payment.service.ts:197), [start guard](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/assignments/assignment.service.ts:167).

Xử lý: nếu miễn phí ngoài scope, chặn tổng 0 ngay khi tạo quote. Nếu hỗ trợ miễn phí, cần nhánh workflow rõ ràng không tạo payment 0đ. Assertion audit hiện dùng phương án thứ hai để chỉ ra trạng thái bị kẹt; không yêu cầu tự động bỏ điều kiện thanh toán cho các quote có tiền.

### B11 — P2: Tài khoản có cả rider và mechanic mất assignment phía rider

**Tái hiện A10:** thêm role mechanic cho rider có đơn do thợ khác nhận; assignment list của rider trở thành rỗng.

Repository chọn nhánh mechanic trước và chỉ lọc `mechanic_id`; không hợp nhất visibility theo các role. Cả PostgreSQL và in-memory adapter có cùng hành vi.

Nguồn: [visibility theo nhánh role](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/server/repositories/postgres/assignment.repository.ts:203).

Xử lý: trả hợp của assignment được gán và assignment thuộc request do actor sở hữu; admin vẫn dùng policy của admin.

### B12 — P1: Safety gate bỏ sót biến thể câu chết máy khi đang chạy

**Tái hiện A07:** “Xe đang chạy thì chết máy” trả `is_dangerous=false`, `can_continue_riding=null`; câu “Xe chết máy khi đang chạy” được nhận diện.

Matcher chỉ nhận đúng cụm từ liền nhau, nên guardrail deterministic không áp dụng cho biến thể cùng nghĩa. Provider/fallback có thể cho kết quả khác, nhưng điều đó không thay thế được safety override bắt buộc. Audit mới chỉ tái hiện safety gate, không gọi AI thật để khẳng định diagnosis cuối cùng của mọi lần gọi.

Nguồn: [keywords/matching](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/apps/api/src/features/chatbot/safety-gate.ts:58), [quan sát HTTP trước đó](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/tests/http/EXECUTION-NOTES.md:12).

Xử lý: bổ sung nhận diện biến thể tiếng Việt có kiểm soát và các câu phủ định; giữ test advisory/safety, không chỉ dựa vào provider.

## Mức hoàn thành của từng role

| Role | Nhóm chức năng đã có code | Phần chưa thể coi là hoàn chỉnh |
|---|---|---|
| Rider | Bootstrap/JWT, thiết bị/push token; CRUD xe; create/read/list/cancel request; dispatch/recall cứu hộ; xem assignment/quote và duyệt/từ chối; payment orders/summary; reminders; inbox; upload; review; ETA/live polling; chatbot | Schema 035 chưa áp dụng; các nhánh hủy/recovery/0đ/address-only/lịch; multi-role visibility; chưa có profile update API thực sự; chưa chứng minh payment/push HTTP E2E trên DB hiện tại |
| Mechanic | Bootstrap profile pending; admin approve; skills/radius/availability/location; offers accept/decline; dashboard/jobs/performance; progress; diagnosis/quote; ETA/delay/media/checklist; recovery; inbox/ETA/live ingest | Thiếu job detail khôi phục thông tin; role status guard; recovery sau trả công; hủy lệch trạng thái; at-home scheduling; schema mới chưa triển khai |
| Admin | Users/status/roles/devices/activity; mechanics approval/status/skills/radius/history/performance; request list/detail/timeline/media/quotes/note/cancel/escalate; bốn monitoring queues; payment review resolution; một phần status/recovery qua endpoint chung | Revoke mechanic lỗi DB; chưa đủ dispatch/assignment/quote intervention; notification/outbox/reminder operations; audit export/dashboard; cấu hình optional chưa có |

Các role đã có ownership/active-user checks, idempotency cho nhiều command, audit/outbox trong transaction và API lỗi có kiểm soát. Cần giữ các cơ chế này khi sửa.

### Rider: các giới hạn API cần làm rõ

- `/auth/profile` thực tế chỉ có POST bootstrap. Gọi lại trên user đã có chỉ trả profile cũ, không sửa display name. AGENTS có chỗ ghi PATCH nhưng route không export PATCH. Đây là khoảng trống/chênh lệch contract cần thống nhất, không phải một profile edit đã được triển khai.
- Request list phía rider hiện không parse status/date/limit/cursor, trả danh sách theo owner. Không coi filter/pagination là đã hỗ trợ chỉ vì endpoint tồn tại.
- Hủy phía rider chỉ trước assignment. Nếu muốn rider hủy sau xác nhận lịch/thợ nhận thì cần policy và command riêng; API hiện chưa hỗ trợ.
- Reminders theo ngày/giờ đã có; nhắc theo số km không thuộc scope hiện tại.

### Admin: đối chiếu kế hoạch với route thực tế

Feature 003 có 64 task done / 111 task open. Kiểm kê có 36 file route admin hiện tại. Các nhóm còn thiếu được xác nhận thêm bằng việc không có service/route tương ứng, không chỉ dựa vào checkbox.

| Nhóm kế hoạch | Trạng thái hiện tại |
|---|---|
| A–D: nền tảng, users, mechanics, service requests | Có implementation và test; còn lỗi revoke nêu trên |
| E: dispatch operations | Chưa có đầy đủ retry/cancel/manual assign/eligible/explain/status/round intervention |
| F: assignment operations | Có endpoint status/recover chung; thiếu bộ detail/timeline/reassign/resolve-stuck/notes theo admin contract |
| G: diagnosis/quote supervision | Có quote history trên request và quyền admin trong service quote; thiếu request-revision/void/expire/dispute workflow |
| H1: audit/notification/outbox | Có activity/timeline và dead-letter queue đọc; thiếu audit search/export, retry/cancel notification, retry/abandon outbox |
| H2: reminder operations | Có worker và rider reminder APIs; chưa có bộ quản trị rules/occurrences/retry/health theo admin contract |
| I: dashboard | Có bốn monitoring queues, chưa có dashboard/metric/stuck-workflow đầy đủ theo contract |
| J: configuration | Chưa có; đây là patch optional trong kế hoạch |

Nguồn: [task index và trạng thái](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/specs/003-careonroad-admin-operations/tasks.md:17), [Patch E còn mở](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/specs/003-careonroad-admin-operations/tasks.md:169), [admin contract](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/specs/003-careonroad-admin-operations/contracts/admin-api.yaml).

`manual_escalation` hiện là điểm dừng vận hành quan trọng: rider không thể dispatch lại trực tiếp từ trạng thái này và admin chưa có bộ retry/manual assign đầy đủ. Rescue recall chỉ xử lý trường hợp có mechanic từng bị rider từ chối tiền công; không giải quyết mọi đơn hết thợ/hết round.

## Những luồng đã kiểm tra xuyên tầng service

Bốn test mới đi từ bootstrap rider/mechanic → admin approve → mechanic skills/location/availability → rider tạo xe/request → dispatch → accept → diagnosis/quote → payment → completed → rider review và kiểm tra inbox.

| Luồng | Các bước đặc thù | Kết quả |
|---|---|---|
| Mobile repair standard | Đến nơi → diagnosis → quote → rider approve → provider xác minh payment → sửa → completed → review | PASS ở tầng service |
| Rescue trả sau | Duyệt công `after_repair` → đi → duyệt phụ tùng → sửa → thu tổng → completed → review | PASS ở tầng service |
| Rescue trả công trước | Duyệt công `labor_upfront` → thu công → đi → duyệt phụ tùng → sửa → thu phần còn lại → completed → review | PASS ở tầng service |
| Periodic maintenance | Lịch trong cửa sổ chuẩn bị → công cố định → đến nơi → duyệt vật tư → sửa → checklist gắn quote → thu sau → completed → review | PASS ở tầng service |

Các test dùng identity fixture, repository trong bộ nhớ và provider giả trả event đã xác minh. Maintenance gọi dispatch chủ động trong test. Chưa kiểm chứng bằng các test này: JWT Supabase thật, SQL constraints/locks, matching tự động qua outbox, chữ ký webhook HTTP thực tế, provider/network thật hoặc push đến thiết bị.

Baseline còn có test riêng cho quote versions/expiry/rejection/additions, payment signatures/reconciliation, dispatch concurrency giả, metadata, reminders, inbox, media, reviews, auth và admin. Test xanh xác nhận các scenario đã viết, không bảo đảm mọi nhánh ngoại lệ và mọi interleaving PostgreSQL.

Các báo cáo HTTP có sẵn là bằng chứng bổ trợ, không phải run mới của audit này:

- [HTTP assessment trước đó](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/tests/http/EXECUTION-NOTES.md): 726 PASS / 4 FAIL / 22 BLOCKED, payment nằm ngoài scope; một số review fixture được chuẩn bị trạng thái trực tiếp nên không chứng minh completion/payment E2E.
- [Workflow HTTP gần nhất](D:/fpt/subject/EXE101/CareOnRoad-mobile-break/tests/workflows/LATEST.md): 279 BLOCKED do setup Auth timeout; không thể tính là 279 PASS.

## Phạm vi chưa triển khai có chủ ý

Refund, settlement, payout, hóa đơn, xác nhận tiền mặt và inventory không nằm trong MVP đang mô tả. Vì vậy không đánh dấu việc thiếu chúng là bug. Tuy nhiên B03 cho thấy cần chặn nhánh tạo nhu cầu xử lý tiền đã thu khi chưa có các workflow tài chính này.

Frontend/mobile/web chưa được audit trong yêu cầu này. Việc có API không chứng minh màn hình hoặc thao tác của người dùng đã nối đúng. Live tracking hiện disabled trong cấu hình đọc được; Google Routes API key chưa có, nên chưa xác nhận ETA provider thật.

## Thứ tự hoàn thiện đề xuất

1. Đồng bộ schema 035 trên project development/test, cấu hình database test riêng, rồi kiểm tra lại các API nhận việc/worker notification.
2. Sửa B02/B03/B04/B05 và B12: trạng thái hủy, recovery có tiền, revoke role, phân quyền status, safety override.
3. Bổ sung mechanic job detail; thống nhất address-only và lịch at-home/other; sửa rollback escalation, tổng 0đ và visibility multi-role.
4. Hoàn thành admin dispatch/assignment intervention để `manual_escalation` và các đơn kẹt có đường giải quyết. Hoàn thiện các nhóm quản trị còn lại theo scope sản phẩm đã chốt.
5. Chạy HTTP + Supabase JWT + PostgreSQL trên môi trường test riêng: các luồng thuận lợi, từ chối/hết hạn báo giá, hủy từng giai đoạn, recovery trước/sau agreement, cạnh tranh accept/approve/cancel/payment, retry worker và restart. Sau đó xác minh payOS/FCM bằng bằng chứng ngoài mock nếu cần xác nhận vận hành thực tế.

**Đánh giá cuối:** nền tảng backend MVP khá đầy đủ ở các luồng thuận lợi, nhưng cả ba role chưa đạt tiêu chí hoàn chỉnh end-to-end; admin thiếu nhiều chức năng vận hành nhất, còn deployment schema và các nhánh ngoại lệ là việc cần xử lý trước.
