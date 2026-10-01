# Hiện trạng database và kế hoạch tối ưu CareOnRoad

## 1. Phạm vi kiểm tra

Tài liệu mô tả database tại thời điểm kiểm tra trên Supabase project đang được repo liên kết.

Thông tin nền tảng:

- Supabase hosted PostgreSQL 17;
- schema được quản lý bằng Supabase CLI và migration SQL trong `supabase/migrations`;
- API dùng `postgres`/Postgres.js `3.4.9` cho repository adapters;
- Supabase CLI là dependency development `2.108.0`;
- backend API truy cập qua repository layer trong `apps/api/src/server/repositories/postgres`.

Tài khoản Supabase được kiểm tra chỉ hiển thị một project hoạt động tên `exe101`. Repo không có metadata phân loại rõ `development`, `staging` hay `production`, vì vậy tên môi trường cần được nhóm xác nhận và ghi thành quy ước vận hành.

Không có seed, migration, lệnh xóa schema hoặc thay đổi index nào được thực hiện trong quá trình kiểm tra.

## 2. Migration state thực tế

`supabase migration list` cho thấy local và remote khớp hoàn toàn:

- migration đầu: `202606250001`;
- migration cuối: `202606250032`;
- tổng cộng: 32 migration;
- không có local-only migration;
- không có remote-only migration.

`supabase db push --dry-run` trả về:

```text
upToDate: true
migrations: []
```

Kết luận: remote schema đã được apply đầy đủ đến migration live-location `032`.

`specs/021-live-location-tracking/validation.md` hiện còn ghi migration `032` chưa được push. Đây là documentation drift và nên được cập nhật ở một thay đổi tài liệu riêng.

## 3. Mô hình dữ liệu hiện tại

### Identity và authorization

- `app_users`
- `user_roles`
- `user_devices`
- `device_delivery_credentials`
- mechanic profile/skills/status
- RLS và backend-owned mutations

Role chính gồm rider, mechanic và admin. Backend bootstrap user từ Supabase JWT và enforce RBAC/object ownership trong service layer.

### Service workflow

- `motorcycles`
- `service_requests`
- `request_media_metadata`
- `request_status_history`
- `dispatch_rounds`
- `dispatch_candidates`
- `assignments`
- `assignment_status_history`

Database đã có active-assignment uniqueness, candidate identity checks và state history.

### Mechanic operations

- ETA/delay metadata;
- field media metadata;
- completion checklist revisions;
- advisory route ETA;
- opt-in latest live location.

### Diagnosis, quote và payment

- `mechanic_diagnoses`
- `quotes`
- `quote_lines`
- `payment_orders`
- `payment_events`

Quote được version hóa và tổng tiền do server tính. Payment order gắn với quote/request/assignment/rider, webhook có dedupe và signature verification. Database chưa có refund, mechanic payout hoặc settlement ledger.

### Reliability và operations

- `idempotency_records`
- `audit_logs`
- `outbox_events`
- `notifications`
- `notification_delivery_receipts`
- reminder rules/occurrences
- worker run records
- retention worker leases
- runtime rate-limit buckets/provider circuit states

## 4. Điểm mạnh hiện tại

### 4.1. Tính toàn vẹn identity

Schema dùng composite foreign keys và trigger cho các quan hệ nhạy cảm. Ví dụ diagnosis, quote và payment không chỉ trỏ bằng một UUID rời rạc mà còn kiểm tra request/assignment/mechanic tương ứng.

### 4.2. Concurrency và idempotency

- Partial unique index ngăn nhiều active assignment cho cùng request/mechanic.
- Payment order có unique provider identifiers.
- Webhook event có dedupe key.
- Các mutation quan trọng dùng idempotency repository và transaction/unit-of-work.

### 4.3. Audit và async reliability

Audit/outbox được ghi cùng transaction với mutation nghiệp vụ. Worker có lease, retry và dead-letter behavior. Đây là nền tốt để thêm pricing review và cancellation assessment.

### 4.4. Security

- RLS được bật cho các bảng nghiệp vụ.
- Direct mutation bị giới hạn.
- Backend giữ database/service-role/payment credentials.
- Raw media không được lưu trong audit/outbox.

### 4.5. Dữ liệu tài chính hiện có tương đối bất biến

Quote thay đổi bằng version mới thay vì ghi đè. Payment event được append và payment amount được ràng buộc với workflow. Cấu trúc này phù hợp để bổ sung pricing snapshot mà không thay thế hệ thống quote.

## 5. Statistics thực tế

Thống kê PostgreSQL đã tích lũy khoảng `7 ngày 4 giờ` kể từ lần reset gần nhất.

| Chỉ số | Giá trị |
|---|---:|
| Database size | 52 MB |
| Total index size | 12 MB |
| Total table size | 7,656 kB |
| Total TOAST size | 0 bytes |
| WAL size | 64 MB |
| Index hit rate | N/A |
| Table hit rate | 0.00 |

Các bảng nghiệp vụ trong `public` hiện có estimated row count bằng `0`. Vì database chưa có workload đại diện, PostgreSQL thường chọn sequential scan cho bảng nhỏ/rỗng và index scan counters không cung cấp bằng chứng đủ để xóa index.

### Kích thước một số bảng chính

| Bảng | Table | Index | Total | Estimated rows |
|---|---:|---:|---:|---:|
| `service_requests` | 48 kB | 152 kB | 200 kB | 0 |
| `assignments` | 8 kB | 184 kB | 192 kB | 0 |
| `quotes` | 16 kB | 96 kB | 112 kB | 0 |
| `payment_orders` | 8 kB | 56 kB | 64 kB | 0 |
| `outbox_events` | 48 kB | 96 kB | 144 kB | 0 |
| `notifications` | 16 kB | 112 kB | 128 kB | 0 |

Mọi index `public` được inspect đều báo `index_scans = 0` và `unused = true`. Trong trạng thái hiện tại, `unused` chỉ có nghĩa là chưa được quan sát sử dụng trong cửa sổ stats, không đồng nghĩa index không cần thiết.

## 6. Vấn đề đã phát hiện

### 6.1. Không có dữ liệu/workload đại diện

Đây là giới hạn lớn nhất. Không thể đánh giá query planner, index selectivity, cache hit hoặc write amplification khi toàn bộ bảng chính gần như rỗng.

Hệ quả:

- chưa nên xóa index chỉ vì scan count bằng 0;
- chưa nên đánh giá latency dựa trên database hiện tại;
- cần workload test có phân phối giống production trước khi chốt index.

### 6.2. Còn 11 schema integration-test

Database có 11 schema tên dạng `careonroad_test_*`.

Rủi ro:

- làm nhiễu thống kê toàn database;
- chiếm dung lượng index;
- làm khó phân biệt dữ liệu test đang hoạt động và dữ liệu bỏ sót;
- có thể chứa fixture cũ không còn được quản lý.

Chưa được phép xóa tự động. Cần xác minh không có test/session đang dùng, ghi danh sách và tuổi schema, sau đó mới cleanup có kiểm soát.

### 6.3. Một số index trùng về cấu trúc

#### `assignments_candidate_idx`

`assignments` đã có `unique (accepted_candidate_id)`, PostgreSQL tự tạo unique B-tree index. Index không unique `assignments_candidate_idx` trên cùng một cột không cung cấp khả năng lookup bổ sung.

Đánh giá: ứng viên xóa có độ tin cậy cao sau khi migration/integration tests xác nhận không tham chiếu tên index.

#### `quotes_request_version_idx`

Schema có:

- unique index từ `unique (request_id, version)`;
- index `(request_id, version desc)`.

B-tree có thể scan ngược để phục vụ `ORDER BY version DESC`, nên index thứ hai có khả năng trùng chức năng.

Đánh giá: ứng viên xóa sau khi chạy `EXPLAIN` cho `findLatestByRequest` và `listByRequest` trên dữ liệu đại diện.

#### `service_requests_rider_created_idx`

Schema có:

- `(rider_id, created_at desc)`;
- `(rider_id, created_at desc, id desc)` cho cursor pagination.

Index dài hơn có thể phục vụ điều kiện theo hai cột đầu.

Đánh giá: ứng viên consolidate, nhưng phải kiểm tra mọi query rider list và ordering trước khi xóa.

### 6.4. Thiếu index khớp payment reconciliation query

Repository hiện tìm payment order bằng:

```sql
where provider = $provider
  and status = 'pending'
  and updated_at <= $before
order by updated_at asc, id
limit $limit
```

Các index hiện có không khớp đầy đủ predicate và ordering này.

Index đề xuất:

```sql
create index payment_orders_pending_reconcile_idx
  on payment_orders (provider, updated_at, id)
  where status = 'pending';
```

Hiện bảng rỗng nên đây chưa phải vấn đề hiệu năng khẩn cấp. Nên thêm cùng feature/migration tối ưu worker, kèm `EXPLAIN` và integration test.

### 6.5. N+1 query trong quote repository

`listByRequest()` lấy danh sách quotes, sau đó gọi `withLines()` cho từng quote. Với `N` quote, tổng số query là `1 + N`.

Tối ưu đề xuất:

1. Query quotes một lần.
2. Query toàn bộ `quote_lines` với `quote_id = any(...)` một lần.
3. Group lines theo `quote_id` trong application.

Create quote hiện cũng insert từng line theo vòng lặp. Có thể chuyển thành bulk insert trong cùng transaction để giảm round trip.

### 6.6. Documentation drift

Validation của feature live-location còn nói migration `032` chưa được push, trong khi remote đã đồng bộ đến `032`. Tài liệu vận hành sai có thể khiến người khác push nhầm hoặc chẩn đoán sai environment.

### 6.7. Environment identification chưa đủ rõ

Project hiện có tên chung `exe101`, không mang nhãn `dev`, `test` hoặc `prod`. Repo cũng không commit project ref, đây là đúng về bảo mật nhưng cần quy trình xác nhận môi trường trước các lệnh mutation.

## 7. Kế hoạch tối ưu theo ưu tiên

### P0 — An toàn vận hành

1. Xác nhận và ghi nhãn project là development/test trong runbook của nhóm.
2. Cập nhật trạng thái migration `032` trong validation document.
3. Inventory 11 test schemas: tên, thời điểm tạo, owner và session còn hoạt động.
4. Chỉ cleanup schema đã xác minh là orphaned.
5. Sửa integration-test teardown để luôn drop schema trong `finally/afterAll`.

Acceptance:

- không còn ambiguity về project;
- test run thành công không để lại schema;
- không xóa schema đang được dùng.

### P1 — Tạo baseline hiệu năng

1. Tạo dataset test đại diện trong đúng development project hoặc isolated test schema.
2. Bao gồm rider, mechanic, request, dispatch, assignment, quote, payment, notifications và outbox với phân phối trạng thái thực tế.
3. Chạy các workflow/worker tiêu biểu.
4. Chạy `ANALYZE` sau khi nạp dữ liệu.
5. Thu thập `pg_stat_statements`, table/index stats và `EXPLAIN (ANALYZE, BUFFERS)`.
6. Giữ cửa sổ quan sát tối thiểu đủ cho cả API và worker chạy.

Không dùng production secrets hoặc chạy script seed mock vào production.

### P1 — Tối ưu query đã biết

1. Loại N+1 ở quote listing.
2. Bulk insert quote lines.
3. Thêm partial index cho pending payment reconciliation nếu plan thực tế xác nhận.
4. Đo trước/sau bằng query count, latency và buffers.

### P2 — Consolidate index

Ưu tiên review ba ứng viên:

1. `assignments_candidate_idx`;
2. `quotes_request_version_idx`;
3. `service_requests_rider_created_idx`.

Quy trình:

1. Liệt kê query phụ thuộc cột/index.
2. Chạy `EXPLAIN` trước khi xóa.
3. Thêm migration forward-only để drop index.
4. Chạy migration lifecycle và repository integration tests.
5. Quan sát latency/locks trên dev trước khi đưa sang môi trường cao hơn.

Không drop trực tiếp qua dashboard để tránh schema drift.

### P2 — Retention và database hygiene

- Xác nhận retention worker có policy rõ cho audit/outbox/notification/chatbot/runtime data.
- Theo dõi dead tuples, autovacuum và table bloat khi có dữ liệu thật.
- Không VACUUM FULL định kỳ vì gây exclusive lock.
- Dùng bounded cleanup và lease pattern hiện có.

### P3 — Scale theo bằng chứng

Chỉ xem xét partitioning khi bảng lịch sử/event thật sự lớn và retention theo thời gian trở thành bottleneck. Các ứng viên tương lai có thể là:

- `audit_logs`;
- `outbox_events`;
- `payment_events`;
- location/history tables.

Hiện tại partitioning sẽ làm tăng độ phức tạp mà không có lợi ích vì bảng rỗng.

## 8. Tối ưu database cho feature pricing sắp tới

Thiết kế pricing nên tuân thủ các nguyên tắc sau:

- version hóa policy và mechanic price list, không update lịch sử;
- catalog identity tách khỏi giá theo phiên bản;
- quote line snapshot giá tham chiếu để dữ liệu cũ không đổi;
- cột quan trọng phải typed; JSONB chỉ dùng cho snapshot giải thích;
- tái sử dụng quote/payment/audit/outbox thay vì tạo ledger trùng;
- cancellation assessment tách khỏi request status;
- chưa tạo refund/payout tables khi feature tài chính chưa được phê duyệt;
- index chỉ được tạo từ query contract cụ thể.

Thiết kế chi tiết nằm trong `PRICING-TRANSPARENCY-AND-CANCELLATION-PLAN.md`.

## 9. Bộ kiểm tra đề xuất

### Migration

- local/remote list khớp;
- dry-run không có migration ngoài dự kiến;
- clean apply và sequential upgrade pass;
- rollback/cleanup của isolated test schema pass;
- index/constraint/RLS static tests pass.

### Query

- rider request pagination;
- mechanic job history/active list;
- latest quote và quote history;
- quote lines batch load;
- pending payment reconciliation;
- outbox/reminder claims;
- admin operational queues.

### Metrics

- p50/p95/p99 latency;
- query count cho một route;
- rows scanned so với rows returned;
- shared buffer hits/reads;
- lock wait;
- index size và write overhead;
- dead tuples và autovacuum activity.

## 10. Những việc không nên làm ngay

- Không xóa hàng loạt index vì `unused=true` trên database rỗng.
- Không thêm index cho mọi cột status/foreign key mà không có query cụ thể.
- Không dùng production data để tạo benchmark tùy tiện.
- Không chạy cleanup 11 test schemas khi chưa xác minh owner/active sessions.
- Không sửa trực tiếp remote schema ngoài migration.
- Không đưa toàn bộ pricing policy vào một JSONB lớn.
- Không triển khai partitioning, sharding hoặc financial ledger trước khi có nhu cầu đo được.

## 11. Thứ tự thực hiện khuyến nghị

1. Sửa runbook/environment labeling và documentation drift.
2. Audit rồi cleanup test schemas.
3. Tạo dataset/workload đại diện.
4. Sửa N+1 và bulk quote line operations.
5. Thêm payment reconciliation index nếu `EXPLAIN` xác nhận.
6. Consolidate ba index trùng bằng migration riêng.
7. Thu thập lại statistics sau thay đổi.
8. Bắt đầu migration pricing foundation theo tài liệu plan.
