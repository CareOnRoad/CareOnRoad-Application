# Kế hoạch minh bạch giá, kiểm soát báo giá và xử lý hủy dịch vụ

## 1. Mục đích tài liệu

Tài liệu này là kế hoạch sản phẩm và kỹ thuật cho ba nhóm vấn đề:

1. Mỗi mechanic có bảng giá khác nhau, khiến nền tảng khó công bố một mức giá duy nhất.
2. Mechanic có thể báo giá cao bất hợp lý sau khi đã tới hiện trường.
3. Rider hủy dịch vụ sau khi mechanic đã nhận việc hoặc đang di chuyển, làm phát sinh chi phí xăng xe và tranh chấp.

Kế hoạch được thiết kế dựa trên database và workflow hiện có của CareOnRoad:

- rider tạo `service_requests`;
- hệ thống dispatch và tạo `assignments`;
- mechanic tạo chẩn đoán và quote bất biến theo phiên bản;
- rider duyệt hoặc từ chối quote;
- quote được duyệt chuyển sang `awaiting_payment`;
- payment hiện chỉ hỗ trợ payment order, webhook và reconciliation qua payOS;
- chưa có refund, settlement hoặc payout tự động.

Mục tiêu không phải ép mọi mechanic có cùng một giá. Mục tiêu là tạo một khung giá có thể giải thích, cho phép khác biệt hợp lý, khóa giá bằng quote và có quy tắc xử lý ngoại lệ rõ ràng.

## 2. Quyết định thiết kế chính

### 2.1. Giá tham chiếu, không phải một giá cứng duy nhất

Nền tảng duy trì catalog dịch vụ và khoảng giá tham chiếu. Mỗi mechanic được phép đăng ký bảng giá riêng trong biên độ cho phép.

- Giá tham chiếu giúp rider biết mức thị trường dự kiến.
- Giá của mechanic phản ánh tay nghề, khu vực, thời điểm và loại xe.
- Giá vượt biên độ phải có lý do, bằng chứng và có thể cần admin duyệt.
- Không dùng AI để quyết định giá cuối cùng.

### 2.2. Tách ba loại tiền

Mọi quote và màn hình xác nhận phải tách rõ:

- `travel/callout fee`: chi phí tiếp nhận và di chuyển;
- `labor fee`: công sửa chữa;
- `part fee`: linh kiện/vật tư.

Không gộp phí di chuyển vào tiền công. Điều này giúp xử lý hủy dịch vụ mà không thu tiền sửa chữa chưa thực hiện.

### 2.3. Quote là cam kết bất biến

Quote hiện tại đã được version hóa. Thiết kế mới tiếp tục dùng quote làm giá cuối cùng:

- server tính tổng từ từng dòng;
- mechanic không được sửa quote đã gửi;
- thay đổi phải tạo phiên bản mới;
- rider luôn thấy phiên bản đang duyệt và lịch sử phiên bản;
- payment order chỉ được tạo từ quote đã duyệt;
- không được thu thêm ngoài quote nếu rider chưa duyệt phiên bản mới.

### 2.4. Phí hủy do backend tính

Mechanic không được tự nhập "tiền xăng" sau khi rider hủy. Backend tính phí theo policy đã công bố và snapshot tại thời điểm nhận việc.

Các đầu vào hợp lệ:

- trạng thái assignment;
- thời điểm mechanic nhận việc và bắt đầu di chuyển;
- khoảng cách tuyến đường hoặc khoảng cách fallback đã được server xác minh;
- thời gian grace period;
- nguyên nhân hủy;
- bên chịu trách nhiệm;
- bằng chứng hiện có như ETA, location và media metadata.

### 2.5. Không tự động refund hoặc payout trong giai đoạn hiện tại

Backend hiện chưa có refund, settlement và payout. Vì vậy:

- giai đoạn đầu chỉ tính và lưu quyết định phí;
- payment order đang thành công không bị tự động hoàn tiền;
- các trường hợp cần hoàn tiền hoặc trả compensation cho mechanic phải qua admin/manual operation;
- tự động refund/payout là feature tài chính riêng, cần phê duyệt phạm vi và kiểm soát kế toán trước khi triển khai.

## 3. Vai trò và quyền

| Vai trò | Quyền được đề xuất | Không được phép |
|---|---|---|
| Rider | Xem khoảng giá, xem bảng giá mechanic đã duyệt, duyệt/từ chối quote, xem phí hủy dự kiến, xác nhận hủy, mở dispute | Sửa policy, sửa quote, quyết định compensation |
| Mechanic | Gửi bảng giá để duyệt, tạo quote từ catalog, khai báo lý do ngoại lệ, đính kèm evidence metadata | Tự kích hoạt bảng giá, tự đặt phí hủy, sửa payment, sửa quote đã gửi |
| Admin | Quản lý catalog/policy, duyệt bảng giá, duyệt ngoại lệ, xử lý dispute, miễn/điều chỉnh phí với reason và idempotency | Sửa lịch sử bất biến, xóa audit, thay đổi tiền không có reason |
| Worker | Kích hoạt policy theo thời gian, hết hạn version, chạy reconciliation/notification | Thực hiện quyết định nghiệp vụ không có policy hoặc admin authorization |

Tất cả mutation nhạy cảm phải có actor, reason, idempotency record, audit log và outbox event được sanitize.

## 4. Chính sách giá đề xuất

### 4.1. Catalog chuẩn

Mỗi hạng mục có:

- mã ổn định, ví dụ `TIRE_PATCH`, `BATTERY_REPLACE_LABOR`, `BRAKE_INSPECTION`;
- tên tiếng Việt;
- nhóm dịch vụ;
- đơn vị tính;
- phương pháp giá: cố định, khoảng giá hoặc cần kiểm tra;
- khoảng giá tham chiếu theo policy version;
- quy định evidence khi vượt giá.

Giá linh kiện nên tách khỏi công lắp. Hạng mục linh kiện không có trong catalog vẫn được phép dưới loại `other`, nhưng phải có mô tả rõ và có thể yêu cầu ảnh/hóa đơn khi vượt ngưỡng.

### 4.2. Bảng giá mechanic

Mechanic có bảng giá riêng theo phiên bản:

1. `draft`: mechanic đang chỉnh sửa.
2. `submitted`: gửi admin duyệt.
3. `approved`: được dùng để tạo quote.
4. `rejected`: bị từ chối kèm reason.
5. `retired`: phiên bản cũ, chỉ còn dùng để đối chiếu lịch sử.

Mỗi mechanic chỉ có tối đa một phiên bản `approved` đang hiệu lực. Khi phiên bản mới được duyệt, phiên bản cũ chuyển sang `retired` trong cùng transaction.

### 4.3. Kiểm soát chặt chém

Khi mechanic gửi quote, backend phải:

1. Khóa assignment và xác nhận mechanic sở hữu assignment.
2. Chỉ chấp nhận trạng thái cho phép tạo quote.
3. Lấy pricing context đã snapshot cho assignment.
4. Kiểm tra từng dòng quote với catalog và bảng giá mechanic đã duyệt.
5. Tính `line_total_amount` và tổng quote ở server.
6. Tính độ lệch so với giá tham chiếu.
7. Yêu cầu reason/evidence nếu vượt ngưỡng.
8. Chuyển quote sang review nếu vượt hard limit.
9. Chỉ cho rider duyệt quote đã qua validation/review cần thiết.

Ví dụ policy, số cụ thể phải do nhóm vận hành quyết định:

- trong khoảng tham chiếu: gửi rider ngay;
- vượt khoảng nhưng dưới soft limit: yêu cầu reason và hiển thị cảnh báo;
- vượt hard limit: bắt buộc admin duyệt trước;
- không có catalog item: cho phép dòng `other`, nhưng bắt buộc mô tả và review nếu giá lớn.

### 4.4. Hiển thị cho rider

Trước khi dispatch:

- khoảng giá dịch vụ;
- công thức phí di chuyển;
- mức phí hủy tối đa;
- các trường hợp được miễn phí.

Trong quote:

- từng hạng mục;
- giá tham chiếu;
- giá mechanic;
- lý do chênh lệch;
- tổng tiền;
- thời hạn quote;
- thông báo "không trả thêm ngoài quote nếu chưa duyệt phiên bản mới".

## 5. Chính sách hủy và tiền di chuyển

### 5.1. Ma trận quyết định mặc định

| Thời điểm hủy | Rider trả | Mechanic được ghi nhận compensation | Ghi chú |
|---|---:|---:|---|
| Trước khi mechanic accept | 0 | 0 | Hủy miễn phí |
| Đã accept nhưng chưa `en_route` | 0 | 0 | Không có bằng chứng di chuyển |
| `en_route` nhưng còn trong grace period | 0 | Policy có thể cho platform stipend | Không thu rider |
| `en_route`, hết grace period, di chuyển được xác minh | Phí di chuyển theo công thức, không vượt cap | Tỷ lệ policy trên eligible fee | Không có tiền công/linh kiện |
| `on_site`, chưa chẩn đoán | Callout fee đã công bố | Tỷ lệ policy | Không có tiền sửa chữa |
| Đã chẩn đoán, chưa duyệt quote | Callout fee và diagnostic fee nếu đã công bố trước | Theo policy | Không có part/labor chưa thực hiện |
| Đã duyệt quote nhưng chưa thanh toán | Phí theo phần công việc thực tế và policy | Cần admin review | Hủy payment order còn pending nếu hợp lệ |
| Đã thanh toán hoặc đã `in_progress` | Không tự động tính/hoàn | Admin review bắt buộc | Thuộc feature refund/settlement tương lai |

### 5.2. Công thức phí di chuyển

Một công thức kiểm soát được:

```text
eligible_fee = min(base_callout_fee + eligible_distance_km * per_km_rate, cancellation_fee_cap)
rider_charge = eligible_fee hoặc 0 theo fault/reason policy
mechanic_compensation = eligible_fee * mechanic_share_bps / 10_000
platform_absorbed = mechanic_compensation - rider_charge, tối thiểu 0
```

`eligible_distance_km` phải do server xác định. Không dùng số do mechanic nhập trực tiếp.

### 5.3. Các trường hợp miễn phí cho rider

- mechanic hủy, không tới, đi sai hướng hoặc trễ quá SLA;
- mechanic yêu cầu khoản ngoài quote hoặc có dấu hiệu ép giá;
- hệ thống dispatch sai;
- rider hủy vì sự cố an toàn, thời tiết nguy hiểm hoặc yêu cầu của cơ quan chức năng;
- dữ liệu location/ETA không đủ để chứng minh di chuyển;
- mechanic đã tới nhưng từ chối cung cấp chẩn đoán/báo giá hợp lệ.

Khi bằng chứng không đủ, mặc định có lợi cho rider và chuyển sang admin review thay vì tự động thu phí.

## 6. Thiết kế database

### 6.1. Bảng hiện có được tái sử dụng

| Bảng | Cách sử dụng |
|---|---|
| `service_requests` | Request, rider, vị trí, trạng thái và lý do hủy |
| `assignments` | Mechanic, trạng thái thực địa và thời điểm nhận việc |
| `assignment_status_history` | Chứng minh assignment đã ở giai đoạn nào |
| `assignment_eta_metadata` | ETA/delay do mechanic gửi |
| `assignment_live_locations` | Latest location khi feature được bật |
| `mechanic_diagnoses` | Chẩn đoán trước quote |
| `quotes`, `quote_lines` | Quote bất biến, version hóa và server-side total |
| `payment_orders`, `payment_events` | Thanh toán quote đã duyệt; chưa dùng cho payout/refund |
| `assignment_media_metadata` | Reference tới evidence, không lưu raw media |
| `audit_logs`, `outbox_events`, `idempotency_records` | Audit, delivery và replay protection |

Không tạo bảng ledger tổng quát trong giai đoạn đầu vì hệ thống chưa có settlement/payout và khối lượng nghiệp vụ chưa đủ để biện minh cho độ phức tạp đó.

### 6.2. Entity mới

#### `pricing_policy_versions`

Lưu phiên bản chính sách giá toàn hệ thống.

| Cột | Kiểu đề xuất | Quy tắc |
|---|---|---|
| `id` | `uuid` | PK |
| `version` | `integer` | Unique, tăng dần |
| `status` | enum | `draft`, `scheduled`, `active`, `retired` |
| `currency` | `text` | Chỉ `VND` |
| `soft_variance_bps` | `integer` | 0..10000 |
| `hard_variance_bps` | `integer` | >= soft limit |
| `effective_from`, `effective_to` | `timestamptz` | Khoảng hiệu lực |
| `created_by`, `activated_by` | `uuid` | Admin actor |
| `created_at`, `activated_at` | `timestamptz` | Audit time |

Chỉ một policy được `active`. Policy đã active là bất biến; thay đổi phải tạo version mới.

#### `service_catalog_items`

Định danh ổn định của hạng mục dịch vụ.

| Cột | Kiểu đề xuất | Quy tắc |
|---|---|---|
| `id` | `uuid` | PK |
| `code` | `text` | Unique, dạng uppercase code |
| `service_type` | enum hiện có | Phân nhóm |
| `display_name_vi` | `text` | Tên cho rider |
| `unit_code` | `text` | `job`, `item`, `hour`, ... |
| `pricing_method` | enum | `fixed`, `range`, `inspection_required` |
| `is_active` | `boolean` | Soft disable |
| `created_at`, `updated_at` | `timestamptz` | Timestamp |

Không lưu giá hiện hành trực tiếp ở bảng này để tránh mất lịch sử khi policy đổi.

#### `pricing_policy_items`

Giá tham chiếu của mỗi catalog item trong một policy version.

| Cột | Kiểu đề xuất | Quy tắc |
|---|---|---|
| `policy_version_id` | `uuid` | FK policy |
| `catalog_item_id` | `uuid` | FK catalog |
| `reference_min_amount` | `bigint` | >= 0 |
| `reference_max_amount` | `bigint` | >= min |
| `evidence_threshold_amount` | `bigint` | Ngưỡng yêu cầu evidence |
| `sort_order` | `smallint` | Hiển thị ổn định |

PK/unique: `(policy_version_id, catalog_item_id)`.

#### `pricing_cancellation_rules`

Lưu quy tắc hủy theo giai đoạn assignment.

| Cột | Kiểu đề xuất | Quy tắc |
|---|---|---|
| `policy_version_id` | `uuid` | FK policy |
| `stage_code` | enum | `pre_accept`, `accepted`, `en_route`, `on_site`, `diagnosed`, `post_approval` |
| `grace_seconds` | `integer` | >= 0 |
| `base_fee_amount` | `bigint` | >= 0 |
| `per_km_amount` | `bigint` | >= 0 |
| `fee_cap_amount` | `bigint` | >= base fee |
| `mechanic_share_bps` | `integer` | 0..10000 |
| `requires_verified_travel` | `boolean` | Mặc định true cho `en_route` |

Unique: `(policy_version_id, stage_code)`.

#### `mechanic_price_versions`

Header của bảng giá mechanic.

| Cột | Kiểu đề xuất | Quy tắc |
|---|---|---|
| `id` | `uuid` | PK |
| `mechanic_id` | `uuid` | FK `mechanic_profiles(user_id)` |
| `version` | `integer` | Unique theo mechanic |
| `status` | enum | `draft`, `submitted`, `approved`, `rejected`, `retired` |
| `submitted_at`, `reviewed_at` | `timestamptz` | Nullable theo trạng thái |
| `reviewed_by` | `uuid` | Admin |
| `review_reason_code` | `text` | Mã reason được kiểm soát |
| `effective_from`, `effective_to` | `timestamptz` | Thời gian áp dụng |
| `created_at` | `timestamptz` | Timestamp |

Unique: `(mechanic_id, version)`. Partial unique: một version `approved` đang hiệu lực cho mỗi mechanic.

#### `mechanic_price_items`

Các dòng giá mechanic đã đăng ký.

| Cột | Kiểu đề xuất | Quy tắc |
|---|---|---|
| `mechanic_price_version_id` | `uuid` | FK version |
| `catalog_item_id` | `uuid` | FK catalog |
| `min_amount`, `max_amount` | `bigint` | >= 0, max >= min |
| `notes` | `text` | Giới hạn độ dài |

Unique: `(mechanic_price_version_id, catalog_item_id)`.

#### `assignment_pricing_contexts`

Snapshot policy áp dụng cho assignment, tạo trong transaction khi mechanic accept.

| Cột | Kiểu đề xuất | Quy tắc |
|---|---|---|
| `assignment_id` | `uuid` | PK/FK assignment |
| `policy_version_id` | `uuid` | Policy được khóa |
| `mechanic_price_version_id` | `uuid` | Bảng giá mechanic được khóa |
| `estimated_distance_meters` | `integer` | Nullable nếu chưa đủ dữ liệu |
| `estimated_callout_min_amount` | `bigint` | >= 0 |
| `estimated_callout_max_amount` | `bigint` | >= min |
| `snapshot` | `jsonb` | Bản sao dữ liệu cần giải thích về sau |
| `created_at` | `timestamptz` | Timestamp |

JSONB chỉ lưu snapshot bất biến phục vụ giải thích. Các trường cần lọc/join vẫn phải là cột typed, không nhét toàn bộ model vào JSONB.

#### `quote_price_reviews`

Review trước khi quote bất thường được hiển thị cho rider.

| Cột | Kiểu đề xuất | Quy tắc |
|---|---|---|
| `id` | `uuid` | PK |
| `quote_id` | `uuid` | Unique/FK quote |
| `status` | enum | `required`, `approved`, `rejected` |
| `variance_bps` | `integer` | Độ lệch lớn nhất |
| `reason_code`, `reason_text` | `text` | Sanitized, bounded |
| `reviewed_by`, `reviewed_at` | nullable | Admin decision |
| `created_at` | `timestamptz` | Timestamp |

#### `quote_line_evidence`

Liên kết quote line với media metadata hiện có, không lưu raw file.

| Cột | Kiểu đề xuất | Quy tắc |
|---|---|---|
| `quote_line_id` | `uuid` | FK quote line |
| `assignment_media_metadata_id` | `uuid` | FK evidence metadata |
| `evidence_type` | enum | `part_photo`, `invoice`, `damage_photo`, `other` |
| `created_at` | `timestamptz` | Timestamp |

Unique: `(quote_line_id, assignment_media_metadata_id)`.

#### `cancellation_assessments`

Lưu kết quả tính phí hủy và compensation theo policy. Đây là quyết định nghiệp vụ, chưa phải payout/refund ledger.

| Cột | Kiểu đề xuất | Quy tắc |
|---|---|---|
| `id` | `uuid` | PK |
| `request_id`, `assignment_id` | `uuid` | Composite identity với assignment |
| `policy_version_id` | `uuid` | Policy snapshot |
| `initiated_by`, `initiator_role` | actor | Người yêu cầu hủy |
| `stage_code` | enum | Giai đoạn tại lúc khóa row |
| `reason_code` | enum/text | Danh sách reason đóng |
| `fault_party` | enum | `rider`, `mechanic`, `platform`, `external`, `undetermined` |
| `verified_distance_meters` | `integer` | Nullable |
| `base_fee_amount`, `distance_fee_amount` | `bigint` | >= 0 |
| `rider_charge_amount` | `bigint` | >= 0 |
| `mechanic_compensation_amount` | `bigint` | >= 0 |
| `platform_absorbed_amount` | `bigint` | >= 0 |
| `status` | enum | `calculated`, `confirmed`, `waived`, `disputed`, `superseded` |
| `calculation_snapshot` | `jsonb` | Input và công thức đã sanitize |
| `decided_by`, `decided_at` | nullable | Admin override |
| `created_at` | `timestamptz` | Timestamp |

Chỉ một assessment chưa `superseded` cho mỗi lần hủy. Mọi override tạo revision mới hoặc ghi audit append-only; không sửa âm thầm số tiền cũ.

#### `pricing_disputes`

| Cột | Kiểu đề xuất | Quy tắc |
|---|---|---|
| `id` | `uuid` | PK |
| `request_id`, `assignment_id` | `uuid` | Identity |
| `quote_id` | `uuid` | Nullable |
| `cancellation_assessment_id` | `uuid` | Nullable |
| `opened_by` | `uuid` | Rider hoặc mechanic |
| `reason_code` | enum/text | `overcharge`, `unexpected_fee`, `travel_not_verified`, ... |
| `description` | `text` | Bounded, sanitized |
| `status` | enum | `open`, `under_review`, `resolved`, `rejected` |
| `resolution_code`, `resolution_note` | nullable | Admin result |
| `resolved_by`, `resolved_at` | nullable | Admin |
| `created_at`, `updated_at` | timestamp | Workflow time |

Partial unique: tối đa một dispute mở cho cùng quote hoặc cancellation assessment.

### 6.3. Thay đổi bảng hiện có

#### `quotes`

Thêm:

- `pricing_policy_version_id`;
- `mechanic_price_version_id`;
- `max_variance_bps`;
- `requires_price_review`;
- `pricing_context_snapshot` nếu cần giữ bản giải thích độc lập.

#### `quote_lines`

Thêm:

- `catalog_item_id` nullable cho dòng ngoại lệ;
- `price_source`: `catalog`, `mechanic_approved`, `manual_exception`;
- `reference_min_amount`, `reference_max_amount`;
- `variance_bps`;
- `exception_reason_code`.

Các giá trị reference được snapshot vào quote line để lịch sử không thay đổi khi policy mới được kích hoạt.

Không thay đổi enum trạng thái request/assignment chỉ để biểu diễn "không sửa xe". Tiếp tục dùng `canceled` và lưu kết quả chi tiết trong `cancellation_assessments`; cách này tránh làm phình state machine hiện tại.

### 6.4. Index đề xuất

Chỉ thêm index phục vụ query cụ thể:

- `pricing_policy_versions(status, effective_from desc)`;
- partial unique policy `active`;
- `pricing_policy_items(policy_version_id, catalog_item_id)` unique;
- `mechanic_price_versions(mechanic_id, version desc)`;
- partial index bảng giá đang `approved`;
- `mechanic_price_items(mechanic_price_version_id, catalog_item_id)` unique;
- `quote_price_reviews(status, created_at, id)` với partial predicate cho `required`;
- `cancellation_assessments(request_id, created_at desc, id desc)`;
- partial index dispute đang mở cho admin queue.

Không tạo index cho mọi foreign key một cách máy móc. Mỗi index phải gắn với query route, worker hoặc constraint cụ thể và được kiểm tra bằng `EXPLAIN (ANALYZE, BUFFERS)` trên dữ liệu đại diện.

### 6.5. RLS và quyền trực tiếp

- Bật RLS cho toàn bộ bảng mới.
- Revoke direct mutation cho `anon` và `authenticated`.
- Rider chỉ được select dữ liệu thuộc request của mình.
- Mechanic chỉ được select pricing context/quote/assessment thuộc assignment của mình.
- Draft/submission của mechanic vẫn phải đi qua backend API để enforce validation và audit.
- Admin mutation phải qua backend, có idempotency key và reason metadata.
- Worker dùng worker secret và bounded claim/lease pattern nếu có activation job.

## 7. Luồng áp dụng

### 7.1. Admin cấu hình giá

1. Tạo catalog item.
2. Tạo `pricing_policy_versions` ở trạng thái `draft`.
3. Thêm giá tham chiếu và cancellation rules.
4. Validate không thiếu item/rule bắt buộc.
5. Schedule hoặc activate trong transaction.
6. Ghi audit và outbox.

### 7.2. Mechanic đăng ký bảng giá

1. Tạo draft version.
2. Thêm item và khoảng giá.
3. Submit.
4. Backend so với policy, đánh dấu các dòng bất thường.
5. Admin approve/reject.
6. Khi approve, retire version cũ và activate version mới atomically.

### 7.3. Tạo assignment

Khi mechanic accept offer, transaction tạo assignment đồng thời tạo `assignment_pricing_contexts` từ policy và bảng giá đang hiệu lực. Nếu không có bảng giá approved, dùng catalog policy và đánh dấu nguồn giá là catalog.

### 7.4. Tạo quote

Mechanic chọn catalog items, quantity và evidence. Backend validate, tính tổng, snapshot reference range và tạo quote version. Quote vượt hard limit nằm ở review queue, chưa hiển thị như quote có thể duyệt.

### 7.5. Rider hủy

1. Rider gọi preview cancellation.
2. Backend khóa request, assignment và payment order liên quan.
3. Backend tính assessment nhưng chưa mutate trạng thái.
4. Rider xác nhận bằng idempotency key.
5. Backend re-check state, tạo assessment, cancel request/assignment theo state machine và đóng dispatch liên quan trong cùng transaction.
6. Nếu payment order còn pending và đủ điều kiện, hủy order.
7. Nếu payment đã succeeded, chuyển admin review; không tự refund.
8. Audit/outbox/notification được ghi atomically.

## 8. API dự kiến

### Rider

- `GET /api/v1/pricing/estimate`
- `GET /api/v1/service-requests/[requestId]/pricing-context`
- `POST /api/v1/service-requests/[requestId]/cancellation-preview`
- `POST /api/v1/service-requests/[requestId]/cancel` mở rộng bằng assessment confirmation token
- `POST /api/v1/pricing-disputes`

### Mechanic

- `GET/POST /api/v1/mechanics/me/price-lists`
- `PATCH /api/v1/mechanics/me/price-lists/[versionId]`
- `POST /api/v1/mechanics/me/price-lists/[versionId]/submit`
- Quote endpoint hiện có nhận `catalog_item_id`, exception reason và evidence references.

### Admin

- `/api/v1/admin/pricing/catalog/**`
- `/api/v1/admin/pricing/policies/**`
- `/api/v1/admin/pricing/mechanic-price-reviews/**`
- `/api/v1/admin/pricing/quote-reviews/**`
- `/api/v1/admin/pricing/disputes/**`
- `/api/v1/admin/pricing/cancellation-assessments/**`

Mutation tiếp tục dùng `X-Idempotency-Key`, reason metadata, RBAC và response redaction theo pattern hiện có.

## 9. Lộ trình triển khai

### Phase 0 — Chốt nghiệp vụ

- Chốt catalog ban đầu.
- Chốt soft/hard variance.
- Chốt callout fee, grace period, cap và mechanic share.
- Chốt reason/fault matrix với vận hành và pháp lý.
- Chốt rider copy trước khi dispatch.

### Phase 1 — Pricing foundation

- Migration cho policy, catalog và mechanic price versions.
- Admin/mechanic backend APIs.
- Read-only estimate API.
- Seed catalog development riêng; không seed production bằng script mock.
- Audit/outbox và migration integration tests.

### Phase 2 — Quote guardrails

- Assignment pricing snapshot.
- Quote line reference fields và price validation.
- Exception review và evidence links.
- Rider vẫn dùng quote approval/payment flow hiện có.

### Phase 3 — Cancellation assessment

- Preview/confirm cancellation.
- Cancellation rules và assessment storage.
- Transactional state close, pending payment cancellation và notifications.
- Admin override/dispute workflow.

### Phase 4 — Shadow enforcement

- Chạy validation nhưng chưa block quote trong thời gian ngắn.
- Đo tỷ lệ quote vượt band, false positive và item không có catalog.
- Điều chỉnh policy bằng version mới, không sửa version active.

### Phase 5 — Enforce

- Block quote vượt hard limit nếu chưa review.
- Hiển thị reference/variance cho rider.
- Theo dõi dispute và cancellation metrics.

### Phase 6 — Financial expansion, ngoài MVP hiện tại

- Refund ledger.
- Mechanic payable/payout.
- Settlement reconciliation.
- Accounting export và financial audit.

Phase này cần spec, threat model và phê duyệt riêng; không ghép ngầm vào migration pricing.

## 10. Testing và acceptance criteria

### Database

- Clean migration và sequential upgrade đều pass.
- Không có hai active policy hoặc hai approved price versions cho một mechanic.
- Policy/price version đã active hoặc approved không thể sửa nội dung.
- Composite identity ngăn quote/assessment trỏ nhầm request, assignment hoặc mechanic.
- Totals và variance được server/database kiểm tra.
- RLS và direct grants không cho client mutation.

### Service

- Quote trong band được tạo bình thường.
- Quote vượt soft limit yêu cầu reason.
- Quote vượt hard limit không thể được rider approve trước admin review.
- Rider không bị thu part/labor khi hủy trước khi thực hiện.
- Mechanic không thể tự nhập verified distance hoặc cancellation fee.
- Hai request hủy đồng thời chỉ tạo một kết quả hiệu lực.
- Payment succeeded không bị tự động refund.

### Operational

- 100% quote có nguồn giá giải thích được.
- 100% admin override có reason/audit.
- Không có payment amount khác approved quote amount.
- Theo dõi tỷ lệ quote vượt band, dispute rate, cancel-after-en-route và thời gian xử lý review.

## 11. Rủi ro và biện pháp

| Rủi ro | Biện pháp |
|---|---|
| Catalog quá chi tiết, khó vận hành | Bắt đầu với nhóm dịch vụ phổ biến, cho phép `other` có kiểm soát |
| Giá thị trường thay đổi | Version hóa policy, có effective time |
| Mechanic né catalog | Theo dõi tỷ lệ `other`, bắt buộc reason/evidence |
| Rider hủy để né phí | Preview rõ trước xác nhận, dùng state/location server-side |
| Mechanic bật location giả | Không chỉ dựa vào một điểm; dùng freshness, accuracy, ETA và admin review |
| Tranh chấp sau thanh toán | Không auto-refund; chuyển queue review cho đến khi feature refund được phê duyệt |
| Database phình vì snapshot | Chỉ snapshot dữ liệu giải thích cần thiết; giữ cột typed cho query |

## 12. Ngoài phạm vi của kế hoạch hiện tại

- UI hoàn chỉnh cho rider/mechanic/admin;
- inventory và quản lý tồn kho linh kiện;
- surge pricing tự động;
- AI quyết định giá hoặc fault party;
- escrow, wallet, payout, settlement và refund tự động;
- thu tiền ngoài payment provider hiện có;
- thay đổi chatbot hoặc ASR.
