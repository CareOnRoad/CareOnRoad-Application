# Mobile FE Mechanic Flow — Backend API Catalog

Tài liệu liệt kê **toàn bộ API backend đã sẵn sàng** để implement luồng **Mechanic FE**
trên mobile (`apps/mobile`), kèm method, auth, input/output shape, header bắt buộc
và gợi ý phase triển khai.

> **Trạng thái backend:** Đã implement qua Patch 5 (mechanic diagnosis + quote),
> Feature 004 (mechanic operations) và P1/P2 Feature 9/15/16 (assignment recovery,
> route ETA, live tracking). Tất cả các endpoint dưới đây đều đã có route handler,
> service layer, repository PostgreSQL và unit/integration tests.
>
> **Lưu ý:** AGENTS.md chỉ rõ không tự ý làm FE mechanic UI; file này **chỉ
> liệt kê + mô tả** các API sẵn sàng, chưa tạo screen / service layer nào.

---

## Mục lục

1. [Auth & Authorization chung](#1-auth--authorization-chung)
2. [Mechanic Profile & Availability](#2-mechanic-profile--availability)
3. [Mechanic Operations — Dashboard / Jobs / Performance](#3-mechanic-operations--dashboard--jobs--performance)
4. [Dispatch Offers (xem & accept/decline)](#4-dispatch-offers-xem--acceptdecline)
5. [Assignment Workflow (state machine)](#5-assignment-workflow-state-machine)
6. [Assignment Metadata (ETA / Media / Checklist)](#6-assignment-metadata-eta--media--checklist)
7. [Mechanic Diagnosis & Quote](#7-mechanic-diagnosis--quote)
8. [Assignment Recovery](#8-assignment-recovery)
9. [Route ETA & Live Tracking](#9-route-eta--live-tracking)
10. [Cross-cutting (notifications, reviews)](#10-cross-cutting-notifications-reviews)
11. [Đề xuất phase triển khai FE](#11-đề-xuất-phase-triển-khai-fe)
12. [Lưu ý quan trọng](#12-lưu-ý-quan-trọng)

---

## 1. Auth & Authorization chung

Tất cả endpoint dưới đây **yêu cầu**:

- Header `Authorization: Bearer <supabase_jwt>` (JWT của mechanic user).
- Identity phải có role `mechanic` (một số endpoint cho phép `admin` đi kèm).
- Một số endpoint mutation POST yêu cầu thêm `X-Idempotency-Key` (UUID v4, 8–200 ký tự).
- `Content-Type: application/json` (trừ khi ghi chú khác).
- Base URL: `EXPO_PUBLIC_API_BASE_URL` trong mobile, ví dụ `http://192.168.x.x:3000/api/v1`.

Mọi response lỗi trả về shape:

```json
{ "error": { "code": "STRING_CODE", "message": "...", "details": { } } }
```

Các `code` hay gặp: `INVALID_INPUT` (400), `UNAUTHENTICATED` (401),
`FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `IDEMPOTENCY_CONFLICT` (409),
`INTERNAL_ERROR` (500).

---

## 2. Mechanic Profile & Availability

### 2.1 `GET /api/v1/mechanics/me/profile`

- **Mục đích:** Lấy profile mechanic hiện tại (skills, radius, rating read-only, location freshness).
- **Auth:** mechanic (bắt buộc).
- **Idempotency:** không.
- **Response 200:**

```json
{
  "service_radius_km": 10,
  "service_types": ["emergency_rescue", "mobile_repair"],
  "profile_status": "approved",
  "is_available": true,
  "availability_updated_at": "2026-09-21T08:00:00.000Z",
  "rating_avg": 4.7,
  "rating_count": 23,
  "location": { "latitude": 10.75, "longitude": 106.67, "updated_at": "..." },
  "user": { "id": "...", "full_name": "...", "phone": "...", "avatar_url": null }
}
```

Lưu ý: `rating_avg` / `rating_count` là **read-only** từ review aggregate,
PATCH sẽ bị backend reject.

### 2.2 `PATCH /api/v1/mechanics/me/profile`

- **Mục đích:** Cập nhật `service_radius_km` và/hoặc `service_types`.
- **Auth:** mechanic.
- **Idempotency:** không.
- **Body:**

```json
{
  "service_radius_km": 15,                       // optional, 0 < x ≤ 100
  "service_types": ["emergency_rescue", "mobile_repair"]  // optional, ≥1
}
```

- **`service_types` enum:** `emergency_rescue | mobile_repair | at_home_service | periodic_maintenance | other`.
- **Response 200:** trả về profile object giống GET (server sort lại).

### 2.3 `PUT /api/v1/mechanics/me/availability`

- **Mục đích:** Bật/tắt trạng thái nhận job.
- **Auth:** mechanic.
- **Idempotency:** không.
- **Body:**

```json
{ "is_available": true }
```

- **Response 200:**

```json
{ "is_available": true, "availability_updated_at": "2026-09-21T08:00:00.000Z" }
```

### 2.4 `PUT /api/v1/mechanics/me/location`

- **Mục đích:** Cập nhật vị trí mới nhất (chỉ lưu điểm cuối, không phải tracking stream).
- **Auth:** mechanic.
- **Idempotency:** không.
- **Body:**

```json
{ "latitude": 10.75, "longitude": 106.67 }
```

- **Response:** `204 No Content`.
- **Điều kiện BE:** Vị trí cũ phải < 300s (freshness window) để dispatch eligible.
  Nên gọi định kỳ 60–120s khi mechanic đang available.

---

## 3. Mechanic Operations — Dashboard / Jobs / Performance

Đường dẫn: `/api/v1/mechanics/me/...`. Tất cả đều yêu cầu role `mechanic`.

### 3.1 `GET /api/v1/mechanics/me/dashboard`

- **Mục đích:** Trang chủ mechanic — availability + location freshness + open offers + active job + today counts + 7-day metrics + rating + `next_action_codes`.
- **Auth:** mechanic.
- **Query:** không.
- **Idempotency:** không.
- **Response 200:** xem `MechanicDashboardResponse` (mappers).
- **Gợi ý UI:** dùng `next_action_codes` để render CTA card tương ứng:
  - `go_available` → bật availability.
  - `update_location` → nhắc cập nhật vị trí.
  - `review_offer` → mở tab Offers.
  - `continue_active_job` → mở chi tiết assignment active.
  - `no_action` → idle state.

### 3.2 `GET /api/v1/mechanics/me/jobs`

- **Mục đích:** Danh sách assignment (history + active) của mechanic.
- **Auth:** mechanic.
- **Query params (tất cả optional):**

| Param | Type | Mô tả |
|-------|------|-------|
| `status` | enum | Lọc theo `assignment.status` (xem §5). |
| `active_only` | bool | Chỉ trả active statuses (`accepted → in_progress`). |
| `date_from` | ISO datetime | Lọc theo `accepted_at >= date_from`. |
| `date_to` | ISO datetime | Lọc theo `accepted_at <= date_to`. |
| `cursor` | string (base64url) | Cursor phân trang. |
| `limit` | int (1–100) | Mặc định 50. |

- **Response 200:**

```json
{
  "items": [
    {
      "assignment_id": "uuid",
      "request_id": "uuid",
      "status": "accepted",
      "accepted_at": "...",
      "created_at": "...",
      "updated_at": "...",
      "request": {
        "request_code": "COR-RESC-20260921-0007",
        "service_type": "emergency_rescue",
        "status": "dispatching",
        "priority": "high",
        "created_at": "...",
        "scheduled_start_at": null
      },
      "latest_quote_status": null,
      "next_action_code": "continue_active_job"
    }
  ],
  "page": { "limit": 50, "has_more": true, "next_cursor": "..." }
}
```

### 3.3 `GET /api/v1/mechanics/me/performance`

- **Mục đích:** Thống kê hiệu suất trong khoảng ngày.
- **Auth:** mechanic.
- **Query:** `date_from?`, `date_to?` (ISO datetime).
- **Response 200:**

```json
{
  "completed_jobs": 12,
  "canceled_jobs": 1,
  "acceptance_rate": 0.83,
  "decline_rate": 0.17,
  "average_accept_time_seconds": 42,
  "average_workflow_duration_seconds": 2400,
  "quote_approval_rate": 0.91,
  "rating": { "average": 4.7, "count": 23 }
}
```

- **Lưu ý AGENTS.md:** Không trả earnings / payout / settlement.

---

## 4. Dispatch Offers (xem & accept/decline)

### 4.1 `GET /api/v1/dispatch/offers`

- **Mục đích:** Danh sách offer (round candidate) hiện đang `offered` cho mechanic.
- **Auth:** mechanic.
- **Response 200:** `{ "items": DispatchCandidateResponse[] }`.

```json
{
  "items": [
    {
      "id": "uuid",
      "round_id": "uuid",
      "request_id": "uuid",
      "mechanic_id": "uuid",
      "rank": 1,
      "distance_m": 1450,
      "status": "offered",
      "expires_at": "2026-09-21T08:05:00.000Z"
    }
  ]
}
```

### 4.2 `POST /api/v1/dispatch/offers/{offerId}/accept`

- **Mục đích:** Atomic accept — tạo assignment, set candidate = `accepted`, round = `accepted`.
- **Auth:** mechanic.
- **Idempotency:** không bắt buộc ở route này, nhưng backend đảm bảo atomic qua row lock.
- **Body:** rỗng / `{}`.
- **Response 201:** trả `AssignmentResponse`.

```json
{
  "id": "uuid",
  "request_id": "uuid",
  "mechanic_id": "uuid",
  "accepted_candidate_id": "uuid",
  "status": "accepted",
  "accepted_at": "...",
  "created_at": "...",
  "updated_at": "..."
}
```

### 4.3 `POST /api/v1/dispatch/offers/{offerId}/decline`

- **Auth:** mechanic.
- **Body:** rỗng / `{}`.
- **Response:** `204 No Content`. Round sẽ tiếp tục offer candidate kế tiếp hoặc escalate.

---

## 5. Assignment Workflow (state machine)

### 5.0 State machine

```
accepted ─┬─► en_route ─┬─► on_site ─► diagnosis ─► quoted ─► awaiting_payment ─► in_progress ─► completed
          │             │
          ▼             ▼
       canceled      canceled
```

Trạng thái terminal: `completed`, `canceled`, `recovery_canceled`.

### 5.1 `GET /api/v1/assignments`

- **Mục đích:** Liệt kê assignment của mechanic (hoặc admin).
- **Auth:** mechanic (chỉ thấy của mình) hoặc admin (tất cả).
- **Response 200:** `{ "items": AssignmentResponse[] }`.

### 5.2 `POST /api/v1/assignments/{assignmentId}/status`

- **Mục đích:** Transition trạng thái hợp lệ (theo state machine ở §5.0).
- **Auth:** mechanic được assign hoặc admin.
- **Idempotency:** không bắt buộc, nhưng nên dùng để tránh double-submit.
- **Body:**

```json
{
  "status": "en_route",            // một trong enum §5.0
  "reason": "Đang tới hiện trường" // optional, 1–500 ký tự
}
```

- **Response 200:** `AssignmentResponse` với status mới + `started_at` / `completed_at` / `canceled_at` nếu áp dụng.
- **Gợi ý UI mechanic:** render nút CTA theo `status` hiện tại, ví dụ:
  - `accepted` → "Bắt đầu di chuyển" (→ `en_route`).
  - `en_route` → "Đã tới nơi" (→ `on_site`).
  - `on_site` → "Bắt đầu chẩn đoán" (→ `diagnosis`).
  - `diagnosis` → "Đã có báo giá" (→ `quoted`) — nhưng FE nên gọi tạo Quote trước, BE auto-update.
  - `awaiting_payment` → "Đã nhận thanh toán" (→ `in_progress`).
  - `in_progress` → "Hoàn tất" (→ `completed`).
  - Mọi state active đều có nút "Huỷ job" (→ `canceled`, kèm `reason`).

### 5.3 `POST /api/v1/assignments/{assignmentId}/recover`

Xem §8 — dành cho recovery pre-quote.

---

## 6. Assignment Metadata (ETA / Media / Checklist)

Cả 3 endpoint POST này **bắt buộc** `X-Idempotency-Key` header (UUID v4, 8–200 ký tự).
Tất cả **chỉ append metadata** — KHÔNG thay đổi assignment state.

### 6.1 `POST /api/v1/assignments/{assignmentId}/eta`

- **Mục đích:** Cập nhật ETA hoặc thông báo delay (lưu metadata cho rider xem).
- **Auth:** mechanic được assign.
- **Body (chọn 1 trong 2, ít nhất một):**

```json
{ "eta_at": "2026-09-21T08:30:00.000Z" }
```
hoặc
```json
{ "delay_reason": "Kẹt xe trên đường tới điểm hẹn" }
```

- **Response 201:** `AssignmentEtaResponse` — FE có thể hiển thị như activity log.

### 6.2 `POST /api/v1/assignments/{assignmentId}/media`

- **Mục đích:** Submit metadata của ảnh đã upload qua `/media/upload-intents`.
- **Auth:** mechanic được assign.
- **Body:**

```json
{
  "media_reference": "service-requests/{requestId}/{fileId}",
  "purpose": "diagnosis",        // diagnosis | work_proof | safety | other
  "content_type": "image/jpeg",
  "size_bytes": 184320,
  "checksum": "sha256-hex"        // optional
}
```

- **Từ chối:** raw media / base64 / data URI / `provider_payload` (sẽ trả 400).
- **Quy trình FE khuyến nghị:**
  1. Gọi `POST /api/v1/media/upload-intents` (rider-side reuse được) → nhận `uploadUrl` + `mediaReference`.
  2. PUT file lên Supabase Storage.
  3. Gọi `POST /media/upload-intents/{intentId}/finalize` để BE verify MIME/size/SHA-256.
  4. Gọi endpoint này với `media_reference` trả về từ bước 3.

### 6.3 `POST /api/v1/assignments/{assignmentId}/completion-checklist`

- **Mục đích:** Append work summary + safety checklist (log only).
- **Auth:** mechanic được assign.
- **Body:**

```json
{
  "work_summary": "Đã thay bộ ly hợp và kiểm tra hệ thống phanh.",
  "safety_checklist": {
    "test_ride_completed": true,
    "tools_removed": true,
    "area_safe": true,
    "rider_briefed": true,
    "no_fluid_leak": true
  },
  "notes": "Khách hàng nên quay lại kiểm tra sau 500 km."
}
```

- **Response 201:** `AssignmentCompletionChecklistResponse`.
- **Lưu ý:** Endpoint **không complete assignment**. Mechanic vẫn phải gọi
  `POST /assignments/{id}/status` với `status: "completed"`.

---

## 7. Mechanic Diagnosis & Quote

### 7.1 `POST /api/v1/assignments/{assignmentId}/diagnoses`

- **Mục đích:** Tạo / cập nhật diagnosis text cho assignment (nhiều revision, latest wins).
- **Auth:** mechanic được assign.
- **Idempotency:** không bắt buộc.
- **Body:**

```json
{
  "diagnosis_text": "Bộ ly hợp mòn, đề xuất thay mới.",
  "recommended_work_text": "Thay bộ ly hợp + kiểm tra dây curoa.",
  "safety_notes": "Không nên chạy xe quá 30 km/h cho tới khi thay xong."
}
```

- **Response 201:**

```json
{
  "id": "uuid",
  "assignment_id": "uuid",
  "request_id": "uuid",
  "mechanic_id": "uuid",
  "diagnosis_text": "...",
  "recommended_work_text": "...",
  "safety_notes": "...",
  "created_at": "...",
  "updated_at": "..."
}
```

### 7.2 `POST /api/v1/service-requests/{requestId}/quotes`

- **Mục đích:** Tạo báo giá (immutable version). Mỗi lần gọi = version mới.
- **Auth:** mechanic được assign cho request.
- **Body:**

```json
{
  "assignment_id": "uuid",
  "diagnosis_id": "uuid",        // optional
  "discount_amount": 0,
  "notes": "Báo giá đã bao gồm VAT.",
  "expires_at": "2026-09-21T12:00:00.000Z",
  "lines": [
    { "line_type": "labor", "description": "Thay bộ ly hợp", "quantity": 1, "unit_amount": 350000 },
    { "line_type": "part",  "description": "Bộ ly hợp Honda", "quantity": 1, "unit_amount": 850000 },
    { "line_type": "other", "description": "Phí đi lại",     "quantity": 1, "unit_amount": 100000 }
  ]
}
```

- **line_type enum:** `labor | part | other`. `quantity` tối đa 2 chữ số thập phân.
- **Response 201:** `QuoteResponse` (currency `VND`, BE tự tính `subtotal_amount`, `total_amount`).
- **Lưu ý:** Quote approval chỉ do **rider** gọi. Mechanic FE chỉ xem danh sách qua `GET` bên dưới.

### 7.3 `GET /api/v1/service-requests/{requestId}/quotes`

- **Mục đích:** Danh sách các version quote của request (cho mechanic xem lịch sử báo giá).
- **Auth:** mechanic được assign hoặc admin.
- **Response 200:** `{ "items": QuoteResponse[] }`.

### 7.4 `POST /api/v1/quotes/{quoteId}/approve` *(rider-only — mechanic không gọi)*

Chỉ liệt kê để mechanic hiểu: sau khi rider approve quote, assignment chuyển sang
`awaiting_payment`; chưa phải `in_progress` cho tới khi payment success.

### 7.5 `POST /api/v1/quotes/{quoteId}/reject` *(rider-only)*

Tương tự — mechanic chỉ đọc.

---

## 8. Assignment Recovery

### 8.1 `POST /api/v1/assignments/{assignmentId}/recover`

- **Mục đích:** Mechanic (được assign) hoặc admin recover một assignment **pre-quote** không tiếp tục được (no_show, lost_contact, cannot_continue). BE sẽ chuyển sang `recovery_canceled` và queue re-dispatch.
- **Auth:** mechanic được assign hoặc admin.
- **Idempotency:** **BẮT BUỘC** header `X-Idempotency-Key`.
- **Body:**

```json
{ "reason_code": "cannot_continue" }
```

- **reason_code enum:** `cannot_continue | no_show | lost_contact`.
- **Response 200:**

```json
{
  "assignment_id": "uuid",
  "request_id": "uuid",
  "status": "recovery_canceled",
  "reason_code": "cannot_continue",
  "redispatch_status": "queued",
  "recovered_at": "2026-09-21T08:45:00.000Z"
}
```

---

## 9. Route ETA & Live Tracking

### 9.1 `GET /api/v1/assignments/{assignmentId}/route-eta`

- **Mục đích:** ETA tham khảo cho assignment active (`accepted`/`en_route`/`on_site`). BE dùng Google Routes two-wheeler hoặc fallback khoảng cách đường thẳng.
- **Auth:** owning rider, mechanic được assign, hoặc admin.
- **Cache:** BE có bounded TTL + dedup.
- **Response 200:**

```json
{
  "assignment_id": "uuid",
  "distance_m": 4520,
  "duration_seconds": 720,
  "provider": "google_routes" | "distance_fallback",
  "computed_at": "..."
}
```

### 9.2 `PUT /api/v1/assignments/{assignmentId}/live-location` (mechanic ingest)

- **Mục đích:** Mechanic publish điểm vị trí mới nhất cho rider xem.
- **Auth:** mechanic được assign.
- **Body:**

```json
{
  "latitude": 10.75,
  "longitude": 106.67,
  "accuracy_m": 12,                  // optional
  "captured_at": "2026-09-21T08:30:00.000Z"
}
```

- **Response 200:** echo điểm đã lưu.
- **Điều kiện BE:** Yêu cầu `LIVE_TRACKING_ENABLED=true`, cấu hình retention/freshness hợp lệ.
  Nếu feature chưa bật, endpoint trả `404` / `disabled` — FE nên handle gracefully (ẩn nút "Bật chia sẻ vị trí").
- **Lưu ý:** BE enforce min update interval (`LIVE_TRACKING_MIN_UPDATE_INTERVAL_SECONDS`).
  Tránh spam > 1 lần / 10s.

### 9.3 `GET /api/v1/assignments/{assignmentId}/live-location` (rider/mechanic/admin poll)

- **Mục đích:** Lấy điểm mới nhất (rider để vẽ bản đồ, mechanic để debug).
- **Auth:** owning rider, mechanic được assign, hoặc admin.
- **Response 200:** điểm vị trí + `captured_at`. Trả `404` nếu chưa có hoặc feature disabled.

---

## 10. Cross-cutting (notifications, reviews)

Các endpoint dưới đây **mechanic có thể dùng** (đã có sẵn ở codebase Rider — mechanic
chỉ cần tham chiếu):

### 10.1 `GET /api/v1/notifications`

Danh sách notification cho mechanic (assignment accepted, offer received, payment success, …).

### 10.2 `GET /api/v1/notifications/unread-count`

Badge unread cho header tab bar.

### 10.3 `POST /api/v1/notifications/{notificationId}/read`

Đánh dấu đã đọc.

### 10.4 `POST /api/v1/notifications/read-all`

Đánh dấu tất cả đã đọc.

### 10.5 `GET /api/v1/assignments/{assignmentId}/route-eta`

Đã liệt kê ở §9.1.

### 10.6 Reviews

Mechanic **không gọi** review API — chỉ rider review mechanic qua
`POST /api/v1/assignments/{assignmentId}/review`. Mechanic FE chỉ đọc `rating`
qua `/mechanics/me/profile` hoặc `/mechanics/me/performance`.

---

## 11. Đề xuất phase triển khai FE

> Phạm vi giống cấu trúc `RIDER_FLOW_INTEGRATION.md`. Cần user xác nhận trước khi
> bắt đầu phase nào.

### Phase M0 — Quick foundation
- Tạo `apps/mobile/src/lib/mechanic-profile-service.ts` (GET/PATCH profile, PUT availability, PUT location).
- Tạo `apps/mobile/src/lib/mechanic-operations-service.ts` (dashboard, jobs, performance).
- Helper mới: `newIdempotencyKey()` đã có sẵn ở `apps/mobile/src/lib/idempotency.ts`.

### Phase M1 — Auth, Role, Tab shell
- Hoàn thiện bypass login mechanic (đã có sẵn ở login.tsx).
- Routing nhóm `(mechanic)`: Home / Jobs / Offers / Profile (4 tabs).

### Phase M2 — Home / Dashboard
- Gọi `/mechanics/me/dashboard` (refresh mỗi 30–60s).
- Render CTA theo `next_action_codes`.
- Switch availability + update location (debounced).

### Phase M3 — Offers
- Tab "Offers" polling `/dispatch/offers` mỗi 15–20s.
- Accept (atomic) → điều hướng sang chi tiết assignment.
- Decline → optimistic update + refresh.

### Phase M4 — Jobs list & detail
- Tab "Jobs" dùng `/mechanics/me/jobs?active_only=true` cho tab active, full list cho "Tất cả".
- Trang chi tiết assignment hiển thị:
  - Trạng thái + nút transition theo state machine §5.0.
  - Rider info + service request code + địa chỉ.
  - Nút ETA / Delay (§6.1).
  - Nút upload ảnh (§6.2 — dùng media upload intent).
  - Nút "Hoàn tất checklist" (§6.3).
  - Nút "Hủy job" (transition → `canceled`, kèm reason).
  - Sau `awaiting_payment` → poll payment status (BE qua outbox event; mechanic chỉ cần đợi).

### Phase M5 — Diagnosis + Quote
- Form chẩn đoán (§7.1) cho assignment đang ở `diagnosis`.
- Form tạo quote (§7.2) sau khi đã lưu diagnosis — list lines động (thêm/xoá dòng).
- Hiển thị danh sách quote version (§7.3) — chỉ read-only cho mechanic.

### Phase M6 — Recovery
- Trên assignment pre-quote (`accepted` / `en_route` / `on_site` / `diagnosis`), thêm menu "Recover":
  - `cannot_continue` / `no_show` / `lost_contact`.
  - Gọi `/assignments/{id}/recover` với `X-Idempotency-Key`.
  - Sau khi thành công: hiển thị banner "Đã chuyển cho mechanic khác".

### Phase M7 — Notifications + Polishing
- Wire `GET /notifications` + `unread-count` vào tab bar bell icon (giống Rider).
- Cleanup mock data còn sót lại trong các màn mechanic.
- Pull-to-refresh + loading skeletons.

### Phase M8 — Typecheck + Lint + Build verify
- `pnpm typecheck` + `pnpm lint` xanh.
- Build thử EAS profile `development` + `preview`.

---

## 12. Lưu ý quan trọng

1. **Không tự ý triển khai FE mechanic** — AGENTS.md nêu rõ:
   > "Do not add … frontend mechanic UI … unless explicitly requested."
   File này chỉ là **catalog / checklist sẵn sàng**, chờ user chỉ thị rõ phase.

2. **Idempotency**: chỉ các endpoint POST sau mới bắt buộc `X-Idempotency-Key`:
   - `POST /assignments/{id}/eta`
   - `POST /assignments/{id}/media`
   - `POST /assignments/{id}/completion-checklist`
   - `POST /assignments/{id}/recover`
   - (PATCH profile, PUT availability/location, POST status KHÔNG yêu cầu idempotency.)

3. **State machine**: Sai transition sẽ bị BE reject 409. FE nên render CTA theo đúng
   danh sách ở §5.0.

4. **Live tracking**: Feature opt-in theo env (`LIVE_TRACKING_ENABLED`). FE nên check
   404 / disabled để ẩn nút "Chia sẻ vị trí".

5. **No payment UI cho mechanic**: payment là backend-only payOS flow. Mechanic chỉ
   chờ rider thanh toán rồi chuyển sang `in_progress`.

6. **Role check**: Một số endpoint (recover, status, force-unavailable) cho phép `admin`
   đi kèm. FE mechanic chỉ cần biết mechanic role đủ dùng.

7. **Reuse service pattern của Rider**: nên copy pattern từ
   `apps/mobile/src/lib/service-requests-service.ts` và
   `apps/mobile/src/lib/quotes-service.ts` để đảm bảo consistency.

8. **Không hardcode secrets** — Supabase JWT từ session, idempotency key dùng
   `newIdempotencyKey()` đã có sẵn.

9. **Test accounts** (theo AGENTS.md): sau khi `pnpm run seed:mock`, có thể đăng nhập
   bằng `mechanic1@gmail.com` / `mechanic2@gmail.com` để smoke-test.

10. **API base path**: nhớ dùng prefix `/api/v1` (KHÔNG `/api` như chatbot).
    Nếu backend config `BACKEND_API_PREFIX` đổi, cần cập nhật `lib/api.ts`.

---

## Phụ lục: Bảng tóm tắt nhanh

| Endpoint | Method | Auth | Idempotency | Mục đích |
|---|---|---|---|---|
| `/mechanics/me/profile` | GET / PATCH | mechanic | – | Profile + cập nhật radius/skills |
| `/mechanics/me/availability` | PUT | mechanic | – | Bật/tắt nhận job |
| `/mechanics/me/location` | PUT | mechanic | – | Cập nhật vị trí dispatch |
| `/mechanics/me/dashboard` | GET | mechanic | – | Home tổng hợp |
| `/mechanics/me/jobs` | GET | mechanic | – | Danh sách assignment |
| `/mechanics/me/performance` | GET | mechanic | – | Thống kê hiệu suất |
| `/dispatch/offers` | GET | mechanic | – | Danh sách offer |
| `/dispatch/offers/{id}/accept` | POST | mechanic | – | Atomic accept |
| `/dispatch/offers/{id}/decline` | POST | mechanic | – | Decline offer |
| `/assignments` | GET | mechanic/admin | – | Liệt kê assignment |
| `/assignments/{id}/status` | POST | mechanic/admin | – | Transition state |
| `/assignments/{id}/eta` | POST | mechanic | **Có** | ETA / delay |
| `/assignments/{id}/media` | POST | mechanic | **Có** | Field media metadata |
| `/assignments/{id}/completion-checklist` | POST | mechanic | **Có** | Work summary + safety |
| `/assignments/{id}/recover` | POST | mechanic/admin | **Có** | Recovery pre-quote |
| `/assignments/{id}/route-eta` | GET | rider/mechanic/admin | – | ETA tham khảo |
| `/assignments/{id}/live-location` | PUT / GET | mechanic / poller | – | Live location |
| `/assignments/{id}/diagnoses` | POST | mechanic | – | Diagnosis text |
| `/service-requests/{id}/quotes` | POST / GET | mechanic | – | Tạo + list quote |
| `/notifications` | GET | owner | – | Inbox |
| `/notifications/unread-count` | GET | owner | – | Badge unread |
| `/notifications/{id}/read` | POST | owner | – | Mark read |
| `/notifications/read-all` | POST | owner | – | Mark all read |

---

> **Trạng thái tài liệu:** Catalog đầy đủ. Chờ user xác nhận phase M0 → M8 trước khi
> bắt đầu code FE mechanic.
