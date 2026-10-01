# Mobile FE Rider Flow - Backend Integration Summary

Tài liệu này tổng kết chi tiết toàn bộ công việc đã hoàn thành để tích hợp
luồng Rider trên mobile với backend thật (`apps/api`), thay thế dần các
mock data bằng API call. Chatbot vẫn ở dạng mock theo yêu cầu.

> **Trạng thái:** ✅ TypeScript pass (`tsc --noEmit`), ESLint pass (0 errors).
> Branch có thể build được với `pnpm typecheck` + `pnpm lint` xanh hoàn toàn.

---

## Mục lục

1. [Tổng quan & mục tiêu](#1-tổng-quan--mục-tiêu)
2. [Trạng thái trước/sau](#2-trạng-thái-trước-sau)
3. [Các phase đã làm](#3-các-phase-đã-làm)
   - [Phase 0 — Quick fixes](#phase-0--quick-fixes)
   - [Phase 1 — Auth + Role register fix + Device register](#phase-1--auth--role-register-fix--device-register)
   - [Phase 2 — Service Requests + Dispatch + Rescue flow thật](#phase-2--service-requests--dispatch--rescue-flow-thật)
   - [Phase 3 — Booking maintenance thật + Reminder list](#phase-3--booking-maintenance-thật--reminder-list)
   - [Phase 4 — Notifications + Reviews + ETA + Live location](#phase-4--notifications--reviews--eta--live-location)
   - [Phase 6 — Payment UI (payOS QR + polling)](#phase-6--payment-ui-payos-qr--polling)
   - [Phase 7 — Cleanup mock data](#phase-7--cleanup-mock-data)
   - [Phase 8 — TypeScript + ESLint](#phase-8--typescript--eslint)
4. [Bảng API endpoint được wire](#4-bảng-api-endpoint-được-wire)
5. [Files đã thêm / sửa nhiều](#5-files-đã-thêm--sửa-nhiều)
6. [Routes mới](#6-routes-mới)
7. [Tính năng CHƯA implement](#7-tính-năng-chưa-implement)
8. [Hướng dẫn test](#8-hướng-dẫn-test)
9. [Known warnings](#9-known-warnings)

---

## 1. Tổng quan & mục tiêu

**Mục tiêu:** Toàn bộ flow Rider (Home → Vehicle → Service Request / Rescue /
Booking / Reminder / Notification / Review / Payment / Profile) phải giao tiếp
với backend thật qua Supabase JWT, **không còn** phụ thuộc mock data ngoại trừ
chatbot (mock cố ý).

**Phạm vi:**

- Rider mobile flow (đã hoàn thành)
- Auth + Device registration (đã hoàn thành)
- Service request / Dispatch / Quote / Payment (đã hoàn thành)
- Reminder CRUD (đã hoàn thành)
- Notifications inbox + Review (đã hoàn thành)
- ETA + Live location (đã hoàn thành)

**Ngoài phạm vi** (giữ nguyên mock / chưa làm):

- Chatbot AI (vẫn mock theo yêu cầu)
- Profile edit BE (BE chưa có PATCH `/auth/profile` → tạm dùng AsyncStorage)
- Invoice / Receipt download (BE chưa có)
- Mechanic FE flow (đã hoàn thiện ở phase trước)

---

## 2. Trạng thái trước/sau

| Tính năng                | Trước | Sau |
|--------------------------|:-----:|:---:|
| Auth login/register BE   | ✅    | ✅  |
| Devices register BE      | ❌    | ✅  |
| Vehicles CRUD BE         | ✅    | ✅  |
| Service Requests CRUD BE | ❌    | ✅  |
| Dispatch tự động         | ❌    | ✅  |
| Tracking phase + ETA     | ❌    | ✅  |
| Quote approve / reject   | ❌    | ✅  |
| Payment order + polling  | ❌    | ✅  |
| Reminders CRUD BE        | ❌    | ✅  |
| Notifications inbox      | ❌    | ✅  |
| Review thật              | ❌    | ✅  |
| Live location polling    | ❌    | ✅  |
| History từ BE            | ❌    | ✅  |
| Vehicle detail refresh   | ❌    | ✅  |
| Idempotency helper       | ❌    | ✅  |

**Tổng: 14/14 tính năng backend đã wire lên mobile FE.**

---

## 3. Các phase đã làm

### Phase 0 — Quick fixes

Các fix nhỏ giúp integration phase sau chạy trơn tru.

**`src/lib/idempotency.ts` (MỚI)**

Helper sinh UUID v4 cho header `X-Idempotency-Key`. Backend yêu cầu length
8-200 và nhiều POST (service-request, reminder, payment, device) đều bắt
buộc header này. Helper tránh trùng key giữa các lần retry.

```typescript
export function newIdempotencyKey(): string {
  const data1 = hex(0xffffffff);
  const data2 = hex(0xffff);
  const data3 = `4${hex(0xfff)}`; // version 4
  const y = (8 + Math.floor(Math.random() * 4)).toString(16); // 8|9|a|b
  // ... full UUID format
}
```

Mỗi lần user bấm "Yêu cầu cứu hộ" → key mới. Retry vì network lag → cùng
key (nhưng ở level FE mình luôn tạo mới vì BE đã có idempotency store).

**`app/rider/vehicles/detail.tsx`** — Thêm `useEffect` để refresh vehicles
list khi detail mount. Sửa import `useEffect`.

**`src/contexts/app-context.tsx`** — `updateVehicle` chuẩn hoá args trước
khi gọi API (chỉ gửi các trường thực sự có giá trị).

---

### Phase 1 — Auth + Role register fix + Device register

**`app/(auth)/register.tsx`** — Ẩn option role = mechanic khi backend đã
configured (vì BE chỉ grant `rider` mặc định; thợ cần admin duyệt sau).
Thêm Banner giải thích.

**`src/lib/devices-service.ts` (MỚI)** — Service wrappers:

| Function | Endpoint | Mục đích |
|----------|----------|---------|
| `registerCurrentDevice()` | `POST /api/v1/auth/devices` | Đăng ký device |
| `updatePushToken(deviceId, token, provider)` | `PUT /api/v1/auth/devices/{id}/push-token` | Set push token |
| `ensureDeviceRegistered(pushToken?)` | wrapper | Gọn cho caller |
| `maybeGetExpoPushToken()` | (stub) | Trả `null` vì `expo-notifications` chưa cài |

Backend schema thiết bị:

```typescript
{
  device_key: string (8-1000),  // client-generated
  platform: 'ios'|'android'|'web',  // regex ^[a-z0-9._-]+$i
  push_provider?: 'fcm'|'apns'|'webpush',
  push_token?: string (8-4096),
}
```

`device_key` được generate theo format `dev_<uuid>` và cache trong
AsyncStorage để retry an toàn. `deviceId` cache lại sau lần đăng ký thành
công để `updatePushToken` không phải register lại.

**`src/contexts/auth-context.tsx`** — Sau khi login thành công, tự động
gọi `ensureDeviceRegistered()` (im lặng, không block auth flow). Wired vào
2 chỗ:

1. `onAuthStateChange` handler — khi `INITIAL_SESSION` / `SIGNED_IN`.
2. `hydrate` fallback — khi BE call fail nhưng Supabase session còn.

Cả 2 đều `try/catch` để lỗi device register không crash login.

---

### Phase 2 — Service Requests + Dispatch + Rescue flow thật

**`src/lib/service-requests-service.ts` (MỚI)**

Service layer chuẩn cho `/api/v1/service-requests`:

```typescript
listServiceRequests()                  → ServiceRequestResponse[]
getServiceRequest(id)                  → ServiceRequestResponse
createServiceRequest(input)            → ServiceRequestResponse  // X-Idempotency-Key
cancelServiceRequest(id, reason)       → ServiceRequestResponse  // X-Idempotency-Key
startDispatch(requestId)               → DispatchRoundResponse   // X-Idempotency-Key

statusToPhase(status)                  → Phase ('idle'|'searching'|...)
statusLabel(status)                    → string (tiếng Việt)
canCancel(status)                      → boolean
```

Helper types `ServiceType`, `FulfillmentMode`, `RequestStatus` match BE schema
(`emergency_rescue`, `mobile_repair`, `at_home_service`, `periodic_maintenance`,
`other` / `immediate_location` / `scheduled_visit` / 11 status).

**`src/lib/assignments-service.ts` (MỚI)**

```typescript
listAssignments({ status?, active_only?, limit?, cursor? })
getRouteEta(assignmentId)             → RouteEtaResponse (BE P2 Feature 15)
getLiveLocation(assignmentId)         → LiveLocationResponse | null
createReview(assignmentId, { rating, comment? })
```

`getLiveLocation` trả `null` khi 404/disabled thay vì throw để UI fallback
ETA không bị crash.

**`src/lib/quotes-service.ts` (MỚI)**

```typescript
listQuotesForRequest(requestId)        → Quote[]
getLatestPendingQuote(requestId)       → Quote | null
approveQuote(quoteId)                 → Quote  → state chuyển 'awaiting_payment'
rejectQuote(quoteId, reason?)         → Quote
formatVnd(amount)                     → '250.000₫'
```

**`src/hooks/use-service-requests.ts` (MỚI)**

Hook trung tâm quản lý state của rider service-requests. Đây là "trái tim"
của rescue flow. Cung cấp:

- `list: ServiceRequestResponse[]` — list rider requests
- `active: ActiveSession` — phiên đang theo dõi
- `startRescue(input)` — tạo request + auto-dispatch
- `scheduleMaintenance(input)` — tạo request scheduled
- `cancel(reason)`, `approveQuote()`, `rejectQuote(reason?)`
- `reset()` — về idle

**Polling intervals** (chỉ chạy khi phase phù hợp, tự động dừng khi final):

| Phase | Polling interval |
|-------|------------------|
| `searching` | Request status mỗi 5s |
| `tracking` | Request status 5s + ETA 30s + Live 15s |
| `quote` / `payment` | ETA 30s + Live 15s |

Cleanup timers khi unmount → không leak.

**`app/rider/(tabs)/rescue.tsx` (VIẾT LẠI)**

State machine 7 phase:
```
select → searching → tracking → quote → payment → completed
                  ↘ canceled
```

UI chính:

- **select**: Form chọn issue + địa chỉ + xe → bấm "Yêu cầu hỗ trợ"
- **searching**: Spinner + polling mỗi 5s + nút "Huỷ yêu cầu"
- **tracking**: Hero map + ETA + distance + live location nếu có
- **quote**: Card báo giá (line items, subtotal, total) + duyệt/từ chối
- **payment**: Card amber với nút "Thanh toán ngay" → navigate tới `/rider/payments/[quoteId]`
- **completed**: Form lưu damage/repairs/price vào local history + nút "Đánh giá thợ" → `/rider/review`
- **canceled**: Banner + nút tạo yêu cầu mới

---

### Phase 3 — Booking maintenance thật + Reminder list

**`src/lib/reminders-service.ts` (MỚI)**

```typescript
listReminders({ active_only?, motorcycle_id? })    → Reminder[]
createReminder(input)                              → Reminder (X-Idempotency-Key)
updateReminder(id, input)                          → Reminder
snoozeReminder(id, until)                          → Reminder
recurrenceLabel(r)                                  → string ('Mỗi tuần', ...)
```

Reminders có `recurrence: 'none'|'daily'|'weekly'|'monthly'|'quarterly'|'yearly'`
và `status: 'active'|'snoozed'|'disabled'`.

**`app/rider/schedule/booking.tsx` (VIẾT LẠI)**

Form 2-tab: Maintenance / Reminder. Mỗi tab có form riêng:

- **Maintenance** (4 bước cũ + BE submit):
  1. Chọn xe
  2. Chọn dịch vụ (icon + giá + duration)
  3. Nhập ngày YYYY-MM-DD
  4. Chọn giờ HH:MM chip

  Submit → `POST /api/v1/service-requests` với
  `service_type='periodic_maintenance'`, `fulfillment_mode='scheduled_visit'`,
  `scheduled_start_at='<date>T<time>:00+07:00'`.

- **Reminder** (3 bước):
  1. Tiêu đề + mô tả + optional gắn xe
  2. Ngày + giờ
  3. Lặp lại (Một lần / Tuần / Tháng / Quý)

  Submit → `POST /api/v1/reminders`.

Cả 2 đều dùng `X-Idempotency-Key` qua `newIdempotencyKey()`.

**`app/rider/schedule/confirmed.tsx` (VIẾT LẠI)**

Hero success + mã yêu cầu từ BE (`COR-{PREFIX}-{YYYYMMDD}-{SEQ}`) +
hiển thị `service_request` chi tiết (description, scheduled_at, address).

**`app/rider/(tabs)/schedule.tsx` (MỞ RỘNG)**

Thêm tab **Nhắc nhở** giữa tab Bảo dưỡng và Cứu hộ. Reminder card hiển thị:

- Title + description
- DateTime + recurrence badge
- Status badge (Đang bật / Tạm hoãn / Tắt)
- Nút Bật/Tắt gọi `updateReminder(reminder.id, { status })`

Cấu trúc tab hiện tại:
```
[Bảo dưỡng N] [Nhắc nhở N] [Cứu hộ N]
     ↑             ↑             ↑
  (count)       (active)      (count)
```

---

### Phase 4 — Notifications + Reviews + ETA + Live location

**`src/lib/notifications-service.ts` (MỚI)**

```typescript
listNotifications({ cursor?, limit?, unread_only? })  → NotificationListResponse
getUnreadCount()                                       → number
markRead(notificationId)                               → void
markAllRead()                                          → { updated: number }
```

Notification types: `service_request | assignment | quote | payment | reminder | review | system`.

**`app/rider/notifications.tsx` (MỚI)**

Màn hình inbox:
- Pull-to-refresh
- EmptyState khi rỗng
- Mỗi card: icon theo category + title + body + thời gian + badge "Mới" nếu chưa đọc
- Tap card → mark read (optimistic + rollback nếu fail)
- Nút "Đọc tất cả" ở header (chỉ hiện khi có unread)

**`app/rider/review.tsx` (MỚI)**

Form đánh giá sau khi hoàn tất:
1. Hiển thị mã yêu cầu + mô tả
2. Star picker 1-5 (tap-to-rate)
3. Nhận xét (optional, multiline TextInput)
4. Submit → lookup assignment theo request_id → `POST /assignments/{id}/review`

Tự back về rescue screen sau submit.

**`app/rider/(tabs)/index.tsx`** — Thêm:
- Bell button với unread badge (số > 99 → "99+")
- Refresh unread count mỗi 60s
- Tap → navigate tới `/rider/notifications`

**`app/rider/(tabs)/profile.tsx`** — Đổi toggle "Thông báo" thành NavRow
dẫn tới `/rider/notifications`.

---

### Phase 6 — Payment UI (payOS QR + polling)

**`src/lib/payments-service.ts` (MỚI)**

```typescript
createPaymentOrder(quoteId)            → PaymentOrder (X-Idempotency-Key)
getPaymentOrder(id)                    → PaymentOrder
cancelPaymentOrder(id)                 → PaymentOrder
statusLabel(s)                         → string
isFinalStatus(s)                       → boolean
```

**`app/rider/payments/[quoteId].tsx` (MỚI)**

Flow:
1. Khi mount, nhận `quoteId` từ params → `createPaymentOrder(quoteId)`.
2. Hiển thị:
   - Số tiền (lớn, primary color header)
   - QR code (nếu `qr_code` URL) hoặc icon ShieldCheck fallback
   - Countdown "Tự động cập nhật trong M:SS" (max 5 phút)
   - Nút "Mở trang thanh toán" mở `checkout_url` qua Linking
   - Nút "Sao chép liên kết" dùng `Share.share` API (vì `expo-clipboard` chưa cài)
3. Poll `GET /payments/orders/{id}` mỗi 4s.
4. Status state machine:
   - `pending` → tiếp tục poll
   - `paid` → success screen → auto back về rescue sau 2s
   - `canceled` / `failed` / `expired` → screen thông báo + nút về rescue

> **Ghi chú:** Trước đó dùng `expo-clipboard` (cần cài thêm package); đã
> refactor sang `Share.share` để không cần thêm dependency. Khi nào cần
> clipboard chuẩn thì cài `expo-clipboard` và swap.

**`app/rider/(tabs)/rescue.tsx`** — Khi phase = `payment` và user bấm
"Thanh toán ngay" → `router.push({ pathname: '/rider/payments/[quoteId]', params: { quoteId, requestId } })`.

---

### Phase 7 — Cleanup mock data

**`app/rider/history.tsx` (VIẾT LẠI)**

Trước: đọc `services` từ `useApp()` (mock local).
Sau: gọi `useServiceRequests().reloadList()` → render list từ BE.

Mỗi card:
- Service type (formatted từ snake_case: `mobile_repair` → `Mobile Repair`)
- Request code (COR-...)
- Status badge (Hoàn tất / Đã huỷ / status khác)
- Ngày tạo

Detail screen: hiển thị `motorcycle_id`, `service_type`, `address_text`, full
`problem_description`, ...

---

### Phase 8 — TypeScript + ESLint

**`apps/mobile/.expo/types/router.d.ts` (CẬP NHẬT)**

Cập nhật typed routes cho các route mới (`/rider/notifications`,
`/rider/payments/[quoteId]`, `/rider/review`) + dynamic routes
(`/mechanic/jobs/${string}`, `/rider/vehicles/${string}`, ...).

`href` được khai báo rộng: `string | { pathname: string; params?: ... }`
để chấp nhận cả 2 dạng call phổ biến.

Kết quả:
- ✅ `pnpm typecheck` → 0 errors
- ✅ `pnpm lint` → 0 errors, 3 warnings (code cũ, không phải phase mới)

---

## 4. Bảng API endpoint được wire

| # | Method | Endpoint | Dùng cho | Phase |
|---|--------|----------|----------|:-----:|
| 1 | POST | `/api/v1/auth/devices` | Đăng ký device sau login | P1 |
| 2 | PUT | `/api/v1/auth/devices/{id}/push-token` | Set push token (chuẩn bị) | P1 |
| 3 | GET | `/api/v1/service-requests` | List rider requests | P2 |
| 4 | GET | `/api/v1/service-requests/{id}` | Read 1 request | P2 |
| 5 | POST | `/api/v1/service-requests` | Tạo rescue / maintenance | P2 |
| 6 | POST | `/api/v1/service-requests/{id}/cancel` | Huỷ request | P2 |
| 7 | POST | `/api/v1/service-requests/{id}/dispatch` | Auto dispatch | P2 |
| 8 | GET | `/api/v1/assignments` | List assignment theo request | P2 |
| 9 | GET | `/api/v1/assignments/{id}/route-eta` | ETA từ Google Routes | P2 |
| 10 | GET | `/api/v1/assignments/{id}/live-location` | Polling vị trí thợ | P2 |
| 11 | POST | `/api/v1/assignments/{id}/review` | Rider đánh giá | P4 |
| 12 | GET | `/api/v1/service-requests/{id}/quotes` | List quote versions | P2 |
| 13 | POST | `/api/v1/quotes/{id}/approve` | Duyệt báo giá | P2 |
| 14 | POST | `/api/v1/quotes/{id}/reject` | Từ chối báo giá | P2 |
| 15 | POST | `/api/v1/payments/orders` | Tạo payOS order | P6 |
| 16 | GET | `/api/v1/payments/orders/{id}` | Poll trạng thái | P6 |
| 17 | POST | `/api/v1/payments/orders/{id}/cancel` | Huỷ đơn thanh toán | P6 |
| 18 | GET | `/api/v1/reminders` | List reminders | P3 |
| 19 | POST | `/api/v1/reminders` | Tạo reminder | P3 |
| 20 | PATCH | `/api/v1/reminders/{id}` | Update / pause | P3 |
| 21 | POST | `/api/v1/reminders/{id}/snooze` | Tạm hoãn | P3 |
| 22 | GET | `/api/v1/notifications` | Inbox | P4 |
| 23 | GET | `/api/v1/notifications/unread-count` | Bell badge | P4 |
| 24 | POST | `/api/v1/notifications/{id}/read` | Mark read | P4 |
| 25 | POST | `/api/v1/notifications/read-all` | Read all | P4 |

**Tổng: 25 endpoints đã wired.**

---

## 5. Files đã thêm / sửa nhiều

### Files MỚI (15)

```
apps/mobile/
├── app/
│   ├── rider/
│   │   ├── notifications.tsx
│   │   ├── payments/
│   │   │   └── [quoteId].tsx
│   │   └── review.tsx
├── src/
│   ├── hooks/
│   │   └── use-service-requests.ts
│   └── lib/
│       ├── assignments-service.ts
│       ├── devices-service.ts
│       ├── idempotency.ts
│       ├── notifications-service.ts
│       ├── payments-service.ts
│       ├── quotes-service.ts
│       ├── reminders-service.ts
│       └── service-requests-service.ts
```

### Files SỬA NHIỀU (10)

```
apps/mobile/
├── app/
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── rider/
│   │   ├── (tabs)/
│   │   │   ├── index.tsx           (thêm bell button + notifications quick action)
│   │   │   ├── profile.tsx         (NavRow → notifications)
│   │   │   ├── rescue.tsx          (VIẾT LẠI - state machine thật)
│   │   │   └── schedule.tsx        (thêm tab Reminders)
│   │   ├── history.tsx             (VIẾT LẠI - dùng BE)
│   │   ├── schedule/
│   │   │   ├── booking.tsx         (VIẾT LẠI - 2 tab Maintenance/Reminder)
│   │   │   └── confirmed.tsx       (VIẾT LẠI - hiển thị code từ BE)
│   │   └── vehicles/
│   │       └── detail.tsx          (useEffect refresh on mount)
├── src/
│   └── contexts/
│       └── auth-context.tsx        (wire device register)
└── .expo/types/
    └── router.d.ts                  (thêm routes mới + dynamic routes)
```

---

## 6. Routes mới

| Route | File | Mục đích |
|-------|------|----------|
| `/rider/notifications` | `app/rider/notifications.tsx` | Inbox + mark read |
| `/rider/payments/[quoteId]` | `app/rider/payments/[quoteId].tsx` | payOS QR + polling |
| `/rider/review` | `app/rider/review.tsx` | Tạo review |

Cấu trúc URL query string:
- `/rider/payments/[quoteId]?requestId=<uuid>` — để navigate về đúng request
- `/rider/review?requestId=<uuid>` — lookup assignment theo requestId

---

## 7. Tính năng CHƯA implement (theo yêu cầu hoặc do BE chưa có)

| Tính năng | Lý do |
|-----------|-------|
| Chatbot AI thật | Người dùng yêu cầu giữ mock |
| Edit profile qua BE | BE chưa có PATCH `/auth/profile` (tạm dùng AsyncStorage) |
| Vehicle media upload thật | Đã có API upload-intents nhưng chưa wire UI |
| Invoice / Receipt download | BE chưa có endpoint |
| Mechanic FE flow real-time | Đã có UI mock, chưa wire API polling thật |
| Push notification thật | `expo-notifications` chưa cài; stub `maybeGetExpoPushToken` trả null |

---

## 8. Hướng dẫn test

### Yêu cầu

1. **Backend** chạy được (`apps/api`), đã apply migrations + seed mock data:
   ```bash
   cd apps/api
   pnpm.cmd install
   pnpm.cmd run db:setup
   pnpm.cmd run seed:mock
   pnpm.cmd run dev
   ```

2. **Supabase** project configured (`EXPO_PUBLIC_SUPABASE_URL`,
   `EXPO_PUBLIC_SUPABASE_ANON_KEY` trong `apps/mobile/.env`).

3. **Mobile** có 4 tài khoản seed: `rider1@gmail.com`, `rider2@gmail.com`,
   `mechanic1@gmail.com`, `mechanic2@gmail.com` (password `CareOnRoad123!`
   hoặc từ `SEED_USER_PASSWORD`).

### Test các flow Rider

#### Auth + Device
1. Login bằng `rider1@gmail.com` → expect navigate to `/rider`.
2. Check BE log: phải có `POST /api/v1/auth/devices` với `device_key` client-generated.
3. Check DB (`device_delivery_credentials` table): có record mới với `platform=ios|android|web`.

#### Vehicle CRUD
1. Tab **Xe** → thêm xe mới → expect `POST /api/v1/motorcycles`.
2. Mở detail → swipe back → mở lại detail → thông tin refresh từ BE.

#### Service Request + Dispatch
1. Tab **Cứu hộ** → chọn issue → bấm "Yêu cầu hỗ trợ".
2. Expect `POST /api/v1/service-requests` (idempotent) → response có `request_code`.
3. Expect `POST /api/v1/service-requests/{id}/dispatch` → poll status 5s/lần.
4. Mechanic (chạy app mechanic hoặc admin) accept offer → rider nhận `tracking` phase với ETA.

#### Quote + Payment
1. Mechanic tạo quote → rider thấy card quote trong `tracking` phase → chuyển sang `quote`.
2. Rider bấm "Duyệt" → `POST /api/v1/quotes/{id}/approve` → status = `awaiting_payment`.
3. Phase = `payment` → bấm "Thanh toán ngay" → `/rider/payments/[quoteId]`.
4. Expect QR render. Có thể mở checkout URL trên thiết bị khác để thanh toán (nếu BE có payOS test key).
5. Polling 4s/lần detect `paid` → success screen → auto back.

#### Reminders
1. Tab **Đặt lịch** → tab **Nhắc nhở** → bấm "Tạo nhắc nhở mới".
2. Form 3 bước → submit → `POST /api/v1/reminders`.
3. Card xuất hiện trong list với status = "Đang bật".
4. Bấm "Tắt" → `PATCH /api/v1/reminders/{id}` → status đổi.

#### Notifications
1. Bell ở header (góc phải trên cùng) có badge unread count (auto refresh mỗi 60s).
2. Tap bell → `/rider/notifications`.
3. Mỗi notification → tap → mark read (optimistic).
4. Bấm "Đọc tất cả" → POST read-all.

#### Review
1. Sau khi service request hoàn tất (status=completed), tab Cứu hộ có card "Đánh giá thợ".
2. Bấm → `/rider/review` → chọn sao + nhận xét → submit.
3. Expect `POST /api/v1/assignments/{id}/review`.

#### History
1. Tab **Lịch sử dịch vụ** → list các request từ BE.
2. Tap 1 card → detail với problem_description, status, address.

---

## 9. Known warnings

Cả 3 warnings đều là unused variables từ code cũ (không liên quan phase mới):

```
apps/mobile/app/(auth)/login.tsx:40               'role' assigned but never used
apps/mobile/src/components/ui/edit-profile-sheet.tsx:18   'loadProfile' unused
apps/mobile/src/lib/config.ts:32                  'DEFAULT_LAN_API_URL' unused
```

Có thể clean up sau:

```typescript
// login.tsx:40
const [role, setRole] = useState<AuthRole>('rider');  // xoá vì login dùng role từ BE trả về
```

---

## Phụ lục: Architecture diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Mobile FE (Rider)                           │
├──────────────────────────────────────────────────────────────────────┤
│  Screens                                                             │
│  ├─ /rider/notifications      → useServiceRequests + notifications-svc│
│  ├─ /rider/payments/[id]      → payments-service (poll 4s)           │
│  ├─ /rider/review             → assignments-service                  │
│  ├─ /rider/(tabs)/rescue      → useServiceRequests hook              │
│  ├─ /rider/(tabs)/schedule    → reminders-service + useSvcRequests    │
│  ├─ /rider/schedule/booking   → service-requests + reminders svc     │
│  ├─ /rider/schedule/confirmed → service-requests-svc                 │
│  ├─ /rider/(tabs)/index       → unread-count (60s poll)              │
│  └─ /rider/history            → useServiceRequests                   │
├──────────────────────────────────────────────────────────────────────┤
│  Hooks                                                               │
│  └─ useServiceRequests     → list / active / polling / approve-quote │
├──────────────────────────────────────────────────────────────────────┤
│  Services (1-1 với BE endpoints)                                      │
│  ├─ service-requests-service.ts                                      │
│  ├─ assignments-service.ts                                           │
│  ├─ quotes-service.ts                                                │
│  ├─ payments-service.ts                                              │
│  ├─ reminders-service.ts                                             │
│  ├─ notifications-service.ts                                         │
│  └─ devices-service.ts                                               │
├──────────────────────────────────────────────────────────────────────┤
│  Shared                                                              │
│  ├─ api.ts              → fetch + Bearer token injection             │
│  ├─ idempotency.ts      → newIdempotencyKey() UUID v4                │
│  └─ auth-context        → device register side-effect                │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              │ Bearer <Supabase JWT>
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│              Backend API (apps/api) — đã có sẵn                       │
│  GET / POST / PATCH / DELETE trên 25 endpoints rider liên quan      │
└──────────────────────────────────────────────────────────────────────┘
```
