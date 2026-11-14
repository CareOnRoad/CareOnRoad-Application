# apps/mobile — Agent Notes

> File này bổ sung cho `AGENTS.md` ở thư mục gốc. Mọi rule "always apply"
> trong `AGENTS.md` vẫn giữ nguyên hiệu lực. File này ghi nhận các quyết
> định wire mobile FE ↔ BE đã merge.

## 1. Tổng quan

- **Stack**: Expo SDK 57.0.28, React Native 0.86.3, React 19.2.3, Expo Router (file-based),
  TypeScript 6.0.3, NativeWind (Tailwind), `lucide-react-native`, Zod (chỉ dùng
  ở BE; FE chỉ consume typing), AsyncStorage cho token + session.
- **App ID / slug**: `com.careonroad.app`, scheme `careonroad://`
- **Mục tiêu wire**: Production-ready, BE-first, **không** mock fallback khi
  `isBackendConfigured === true`. UI phải render đúng state rỗng (EmptyState).

## 2. Cấu trúc quan trọng

```
apps/mobile/
├─ app/                         # Expo Router screens (file-based routes)
│  ├─ (auth)/                   # login, register, oauth
│  ├─ rider/
│  │  ├─ (tabs)/                # home, vehicles, schedule, profile, rescue
│  │  ├─ payments/[quoteId].tsx # payOS QR polling
│  │  ├─ notifications.tsx
│  │  └─ review.tsx
│  └─ mechanic/
│     ├─ (tabs)/                # dashboard, offers, jobs, performance, profile
│     ├─ jobs/[id].tsx          # job detail (chẩn đoán + báo giá + chia sẻ vị trí)
│     └─ notifications.tsx
├─ src/
│  ├─ contexts/                 # AuthProvider, AppProvider, MechanicAppProvider
│  ├─ hooks/                    # useServiceRequests, useNotifications
│  ├─ lib/                      # service wrappers (api.ts, *-service.ts, notification-routing.ts)
│  ├─ components/mechanic/      # cards/, forms/ (job-update, diagnosis, quote)
│  └─ ...
└─ ...
```

## 3. BE endpoints đã wire (mobile ↔ BE)

### Auth + profile
| Method | Endpoint | File wrapper |
|---|---|---|
| GET | `/api/v1/auth/me` | `lib/auth-service.ts` |
| POST | `/api/v1/auth/profile` | `lib/auth-service.ts` |
| PATCH | `/api/v1/auth/profile` | `lib/auth-service.ts` |
| POST | `/api/v1/auth/devices` | `lib/devices-service.ts` |

### Rider
| Method | Endpoint | File wrapper |
|---|---|---|
| GET/POST | `/api/v1/motorcycles` | `lib/motorcycles-service.ts` |
| GET/PATCH/DELETE | `/api/v1/motorcycles/{id}` | `lib/motorcycles-service.ts` |
| GET/POST | `/api/v1/service-requests` | `lib/service-requests-service.ts` |
| GET | `/api/v1/service-requests/{id}` | `lib/service-requests-service.ts` |
| POST | `/api/v1/service-requests/{id}/cancel` | `lib/service-requests-service.ts` |
| POST | `/api/v1/service-requests/{id}/dispatch` | `lib/service-requests-service.ts` |
| GET | `/api/v1/service-requests/{id}/quotes` | `lib/quotes-service.ts` |
| POST | `/api/v1/quotes/{id}/approve` | `lib/quotes-service.ts` |
| POST | `/api/v1/quotes/{id}/reject` | `lib/quotes-service.ts` |
| POST | `/api/v1/payments/orders` | `lib/payments-service.ts` |
| GET | `/api/v1/payments/orders/{id}` | `lib/payments-service.ts` |
| POST | `/api/v1/payments/orders/{id}/cancel` | `lib/payments-service.ts` |
| GET/POST | `/api/v1/reminders` | `lib/reminders-service.ts` |
| PATCH | `/api/v1/reminders/{id}` | `lib/reminders-service.ts` |
| POST | `/api/v1/reminders/{id}/snooze` | `lib/reminders-service.ts` |
| POST | `/api/v1/assignments/{id}/review` | `lib/reviews-service.ts` |
| POST | `/api/v1/media/upload-intents` | `lib/media-uploads-service.ts` |
| POST | `/api/v1/media/upload-intents/{id}/finalize` | `lib/media-uploads-service.ts` |

### Mechanic
| Method | Endpoint | File wrapper |
|---|---|---|
| GET | `/api/v1/mechanics/me/profile` | `lib/mechanics-service.ts` |
| PATCH | `/api/v1/mechanics/me/profile` | `lib/mechanics-service.ts` |
| PUT | `/api/v1/mechanics/me/availability` | `lib/mechanics-service.ts` |
| PUT | `/api/v1/mechanics/me/location` | `lib/mechanics-service.ts` |
| GET | `/api/v1/mechanics/me/dashboard` | `lib/mechanics-service.ts` |
| GET | `/api/v1/mechanics/me/jobs` | `lib/mechanics-service.ts` |
| GET | `/api/v1/mechanics/me/performance` | `lib/mechanics-service.ts` |
| GET | `/api/v1/dispatch/offers` | `lib/dispatch-service.ts` |
| POST | `/api/v1/dispatch/offers/{id}/accept` | `lib/dispatch-service.ts` |
| POST | `/api/v1/dispatch/offers/{id}/decline` | `lib/dispatch-service.ts` |
| GET | `/api/v1/assignments` | `lib/mechanic-jobs-service.ts` |
| POST | `/api/v1/assignments/{id}/status` | `lib/mechanic-jobs-service.ts` |
| POST | `/api/v1/assignments/{id}/eta` | `lib/mechanic-jobs-service.ts` |
| POST | `/api/v1/assignments/{id}/completion-checklist` | `lib/mechanic-jobs-service.ts` |
| POST | `/api/v1/assignments/{id}/media` | `lib/mechanic-jobs-service.ts` |
| POST | `/api/v1/assignments/{id}/diagnoses` | `lib/mechanic-jobs-service.ts` |
| GET | `/api/v1/assignments/{id}/diagnoses` | `lib/mechanic-jobs-service.ts` |
| GET | `/api/v1/assignments/{id}/route-eta` | `lib/assignments-service.ts` |
| PUT | `/api/v1/assignments/{id}/live-location` | `lib/mechanic-jobs-service.ts` |
| GET | `/api/v1/assignments/{id}/live-location` | `lib/assignments-service.ts` |
| POST | `/api/v1/assignments/{id}/recover` | `lib/mechanic-jobs-service.ts` |
| POST | `/api/v1/service-requests/{id}/quotes` | `lib/mechanic-quotes-service.ts` |

### Plan subscriptions (rider)
| Method | Endpoint | File wrapper |
|---|---|---|
| GET | `/api/v1/plans` | `lib/subscriptions-service.ts` |
| GET | `/api/v1/subscription` | `lib/subscriptions-service.ts` |
| POST | `/api/v1/subscription/orders` | `lib/subscriptions-service.ts` |
| GET | `/api/v1/subscription/orders/{id}` | `lib/subscriptions-service.ts` |
| POST | `/api/v1/subscription/orders/{id}/cancel` | `lib/subscriptions-service.ts` |

### Notifications (cả 2 role)
| Method | Endpoint | File wrapper |
|---|---|---|
| GET | `/api/v1/notifications` | `lib/notifications-service.ts` |
| GET | `/api/v1/notifications/unread-count` | `lib/notifications-service.ts` |
| POST | `/api/v1/notifications/{id}/read` | `lib/notifications-service.ts` |
| POST | `/api/v1/notifications/read-all` | `lib/notifications-service.ts` |

## 4. Conventions

### 4.1. Auth + token injection
- `setAccessTokenProvider()` được wire trong `lib/auth-service.ts` ngay khi
  Supabase session thay đổi; tất cả request BE tự động có `Authorization: Bearer ...`.
- Token refresh diễn ra trong `auth-context.tsx` (Supabase). Khi token đổi giữa
  polling, `setAccessTokenProvider` callback sẽ được gọi lại.

### 4.2. Idempotency
- Mọi POST tạo resource đều gửi `X-Idempotency-Key` qua helper `newIdempotencyKey()`.
- BE không yêu cầu header này cho motorcycle CRUD — vẫn gửi để an toàn.

### 4.3. Mock fallback
- Mock fallback chỉ active khi `isBackendConfigured === false` (không có
  `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_API_BASE_URL_OVERRIDE`).
- Khi BE lên: vehicles/services/reminders/notifications/payments đều trả
  rỗng thay vì mock — UI render `EmptyState` hướng dẫn user.

### 4.4. Polling strategy
- `useServiceRequests`: request 5s, ETA 30s, live-location 15s.
- `useNotifications`: unread count + recent list mỗi 30s (configurable qua
  `pollIntervalMs`). Hook tự cleanup khi unmount hoặc auth status thay đổi.
- Cleanup luôn chạy trong `useEffect` return.

### 4.5. State machine
- Service request status BE → UI phase:
  - `submitted|dispatching|offered|manual_escalation` → `searching`
  - `assigned|mechanic_en_route|in_service` → `tracking`
  - `awaiting_quote_approval` → `quote`
  - `awaiting_payment` → `payment`
  - `completed` → `completed`
  - `canceled` → `canceled`
- Mechanic assignment status BE → UI MechanicJobStatus:
  - `accepted|en_route|on_site|diagnosis|quoted` → `pending`
  - `awaiting_payment|in_progress` → `in_progress`
  - `completed` → `completed`
  - `canceled|recovery_canceled` → `completed` (best-effort cho UI)

### 4.6. Notification type → category + deep-link
- BE trả `type` dạng dot-separated (`"assignment.en_route"`, `"quote.created"`, ...).
  Mobile map về `NotificationCategory` qua `normalizeNotificationType()` ở
  `lib/notifications-service.ts` để UI render đúng icon/tone/label.
- Bảng map:
  - `rescue.*` / `maintenance.booking*` → `service_request`
  - `assignment.*` → `assignment`
  - `quote.*` → `quote`
  - `payment.*` → `payment`
  - `maintenance.reminder` / `reminder.*` → `reminder`
  - `review.*` → `review`
  - khác → `system`
- Tap notification từ inbox (`/rider/notifications`, `/mechanic/notifications`)
  sẽ gọi `hrefForNotification(notification, role)` ở
  `lib/notification-routing.ts` để navigate in-app:
  - `quote` (rider) → `/rider/rescue/{requestId}` — **KHÔNG** mở thẳng
    `/rider/payments/{quoteId}`. Lúc thông báo quote được gửi, quote còn
    `pending` nên BE từ chối tạo payment order (`409 Quote is not payable`).
    Màn chi tiết tự hiển thị card báo giá + nút Duyệt/Từ chối, và chỉ hiện
    nút "Thanh toán ngay" sau khi quote đã được duyệt.
  - `payment` (rider) → `/rider/rescue/{requestId}`
  - `review` (rider) → `/rider/review?requestId=...`
  - `reminder` (rider) → `/rider/(tabs)/schedule?reminderId=...`
  - `service_request` (mechanic) → `/mechanic/(tabs)/offers`
  - `assignment` (mechanic) → `/mechanic/jobs/detail?id=...`
- Notification không match target → không navigate (chỉ mark read).

### 4.7. Mechanic performance tab
- Tab mới ở `app/mechanic/(tabs)/performance.tsx` (thêm vào `(tabs)/_layout.tsx`
  với icon `TrendingUp`).
- Dùng `useMechanicApp().performance` + `reloadPerformance({ date_from? })`.
- BE trả `GET /api/v1/mechanics/me/performance` (xem `mechanics-service.ts`).
- Không hiển thị earnings/payout/payment — chỉ rating + completed/canceled
  + quote approval/acceptance/decline rate + thời gian trung bình.

### 4.8. Mechanic live-location sharing
- `apps/mobile/src/lib/location-service.ts` export `watchCurrentPosition()` (manual),
  `startAutoTracking()` (idempotent foreground-permission + watch với rate-limit
  + accuracy filter), `isLocationPermissionGranted()` (read-only check),
  `requestLocationPermissionOnce()` (idempotent request, không hỏi 2 lần),
  và `openLocationSettings()` (mở Settings OS).
- `MechanicAppProvider` tự xin permission foreground ngay khi `auth.role === 'mechanic'`
  (qua `useEffect` trong `auth-context.tsx`) và auto-start `PUT
  /api/v1/assignments/{id}/live-location` cho assignment mới chuyển sang
  `accepted`/`en_route`. Auto dừng khi status rời travel state, khi user
  logout, hoặc khi permission bị deny.
- Auto-tracking có thể tắt qua `useMechanicApp().setAutoTrackingEnabled(false)`
  hoặc trong tab Profile → Settings → "Tự động chia sẻ vị trí".
- UI toggle thủ công giữ nguyên (`LiveSharingCard`) — card sẽ hiển thị
  pill "Tự động" khi provider đang watch ngầm, và banner "Mở cài đặt vị trí"
  khi user đã deny permission.
- Client-side rate-limit 10s/lần (BE cũng rate-limit theo
  `LIVE_TRACKING_MIN_UPDATE_INTERVAL_SECONDS`).

### 4.9. Mechanic submit quote
- `apps/mobile/src/lib/mechanic-quotes-service.ts` export `submitQuote()`.
- **`quotePurposePlanFor(serviceType, assignmentStatus, hasApprovedWorkQuote)`**
  quyết định bước báo giá hiện tại (thay cho `suggestPurposeForServiceType`):
  - `emergency_rescue`: `accepted` → `rescue_labor` (bắt buộc `labor_pricing`),
    sau đó → `rescue_final` (chỉ parts).
  - `periodic_maintenance`: `accepted` → `maintenance_labor`,
    `diagnosis` → `maintenance_work` (chỉ parts),
    `in_progress` → `maintenance_work` addition (bắt buộc `basis_quote_id` =
    quote `maintenance_work` đã approved).
  - còn lại → `standard`.
  - Tham số `hasApprovedWorkQuote` KHÔNG còn dùng để chọn plan — BE chỉ cho
    báo giá phát sinh thêm khi assignment = `in_progress`
    (`quote.service.ts` → `maintenanceAddition`).
- Form UI ở `components/mechanic/forms/quote-form.tsx` + `diagnosis-form.tsx`.
  `quote-form.tsx` nhận `plan: QuotePurposePlan` để tự ẩn/hiện field theo bước
  (`labor_pricing` cho `rescue_labor`, chỉ line `part` cho `rescue_final` /
  `maintenance_work`).

### 4.10. Gói của tôi (plan subscription)
- `apps/mobile/src/lib/subscriptions-service.ts` export `getPlanCatalog()`,
  `getMySubscription()`, `createSubscriptionOrder()`, `getSubscriptionOrder()`,
  `cancelSubscriptionOrder()` cùng helper `planLabel`, `planPriceLabel`,
  `planStatusLabel`, `formatPlanExpiry`.
- Màn hình `app/rider/plans/index.tsx` (catalog 3 gói + modal xác nhận) và
  `app/rider/plans/[orderId].tsx` (QR payOS + polling 4s, timeout 5 phút).
- `PlanConfirmModal` bắt buộc tick "không được hoàn tiền" trước khi gọi
  `createSubscriptionOrder` (BE cũng từ chối khi thiếu xác nhận).
- Gói hiện tại đọc từ `useAuth().user.planCode` / `planExpiresAt`;
  `refreshActor()` được gọi sau khi thanh toán thành công để cập nhật badge.
- **Đồng bộ gói giữa các màn hình**: `useAuth().user.planCode` là snapshot
  client, nên có thể lệch với backend (gói đổi do admin cấp, thanh toán payOS
  hoàn tất ở trình duyệt, webhook tới muộn). Vì vậy:
   - `AuthProvider` tự gọi lại `GET /api/v1/auth/me` mỗi lần app quay lại
     foreground (`AppState` → `active`), giới hạn 1 lần / 5 giây.
   - Tab Home và tab Profile gọi `refreshActor()` trong `useFocusEffect` để
     badge gói luôn khớp backend khi vào tab.
   - `refreshActor` đọc gói từ `GET /api/v1/subscription` (endpoint có
     lazy-sync payOS, nên phản ánh đơn vừa trả tiền dù webhook chưa tới
     backend) và chỉ fallback về `plan_code` của actor. Nguồn từ
     `/auth/me` là DB snapshot nên không tự thấy gói mới.
   - `refreshActor` dùng `userEmailRef` (ref) chứ không phụ thuộc `user` —
     nếu phụ thuộc `user` thì mỗi lần `setUser` sẽ tạo callback mới và
     `useFocusEffect` chạy lại vô hạn. `setUser` cũng so sánh trước/sau để
     không re-render khi không có gì đổi.
  Màn "Gói của tôi" (`plans/index.tsx`) không dùng cache này — nó đọc
  `GET /api/v1/subscription` nên luôn mới.
- **Đồng bộ gói giữa các màn hình**: `useAuth().user.planCode` là snapshot
  client, nên có thể lệch với backend (gói đổi do admin cấp, thanh toán payOS
  hoàn tất ở trình duyệt, webhook tới muộn). Vì vậy:
   - `AuthProvider` tự gọi lại `GET /api/v1/auth/me` mỗi lần app quay lại
     foreground (`AppState` → `active`), giới hạn 1 lần / 5 giây.
   - Tab Home và tab Profile gọi `refreshActor()` trong `useFocusEffect` để
     badge gói luôn khớp backend khi vào tab.
   - `refreshActor` dùng `userEmailRef` (ref) chứ không phụ thuộc `user` —
     nếu phụ thuộc `user` thì mỗi lần `setUser` sẽ tạo callback mới và
     `useFocusEffect` chạy lại vô hạn. `setUser` cũng so sánh trước/sau để
     không re-render khi không có gì đổi.
  Màn "Gói của tôi" (`plans/index.tsx`) không dùng cache này — nó đọc
  `GET /api/v1/subscription` nên luôn mới.
- Lỗi 409 `downgrade_blocked` hiển thị bằng `Banner` thân thiện, không crash.
- Route đăng ký trong `app/rider/_layout.tsx`: `plans/index`, `plans/[orderId]`.
- Typed routes: sau khi thêm/trừ file route, chạy
  `node scripts/regen-typed-routes.cjs` trong `apps/mobile` để
  `.expo/types/router.d.ts` khớp (file này bị git-ignore).
- **QR thanh toán**: payOS trả `qr_code` là payload EMVCo/VietQR dạng TEXT
  (vd `00020101021238570010A000000727012700069704220113VQRQANGTG...`),
  KHÔNG phải URL ảnh. `<Image source={{uri}}>` sẽ fail im lặng → trắng.
  Dùng `src/components/ui/qr-code.tsx` (`toqr` + `react-native-svg`), helper
  thuần ở `src/lib/qr-payload.ts`. Không dùng global `TextEncoder` (Hermes
  không bảo đảm) — dùng `utf8Bytes`. `toqr` là dependency trực tiếp của mobile.
  - QR gói: `app/rider/plans/[orderId].tsx`; QR sửa chữa: `app/rider/payments/[quoteId].tsx`.
  - Nếu `canRenderQrCode(value)` false → hiện banner fallback, không render `<Image>`.

### 4.11. ActionButton — layout contract (đã sửa bug chữ biến mất)
- `className` của caller phải áp lên `<Pressable>` GỐC, KHÔNG bọc View con.
  `flex-1` trên View con trong container cha (column) → `flexBasis:0%` → chiều cao
  content = 0 → chữ bị clip → chỉ còn "pill" màu.
- Không dùng `inline-flex` (RN không hỗ trợ) → dùng `flex-row` rõ ràng.
- Không dùng `style={({pressed})=>...}` cùng lúc với `className` (NativeWind
  ghi đè). Dùng variant `active:` của Tailwind cho feedback cảm ứng.
- `color` trên `<View>`/`<Pressable>` KHÔNG kế thừa xuống `<Text>` → chuỗi
  children phải tự mang class màu chữ (`variantTextStyles`).

### 4.12. Pseudo-class (`active:`/`hover:`/`focus:`) KHÔNG được đặt trên `<View>` con
- NativeWind biến class có pseudo-class thành CSS pseudo-class. Nếu class đó
  nằm trên một `<View>` (không phải `Pressable`), `react-native-css-interop` tự
  NÂNG `<View>` đó thành `Pressable`
  (`native-interop.ts` → `sharedState.pressable ||= UpgradeState.SHOULD_UPGRADE`).
- `Pressable` sâu hơn sẽ cướm responder của `Pressable` cha trong bước
  `onStartShouldSetResponder` negotiation của RN (deepest wins). `onPress` của
  cha không bao giờ chạy → **"bấm vào không hiện modal"** (bug thật đã xảy ra
  ở `DateTimePickerField`, sửa ở commit sửa lỗi picker ngày/giờ).
- Quy tắc: **mọi `className` chứa `active:`/`hover:`/`focus:` phải nằm trên
  `<Pressable>` gốc**, không bọc thêm `<View>` mang class pseudo-class bên trong.
- Mẫu đúng:
  ```tsx
  <Pressable onPress={open} className="... active:scale-[0.99]">
    <View className="flex-row items-center gap-2.5">{/* chỉ layout, không pseudo-class */}</View>
  </Pressable>
  ```
- `DateTimePickerField` (`src/components/ui/datetime-picker-field.tsx`) là ví dụ
  chuẩn: `className` (kèm `active:`) nằm trên `<Pressable>` gốc; Android dùng
  imperative API `DateTimePickerAndroid.open()` (không dùng `<DateTimePicker>`
  khai báo vì Android không có `mode='datetime'` và `onChange` đã deprecated).

### 4.13. Payment status contract + `approvedQuote` (rider quote → payment)
- **Contract phải khớp BE 1-1.** `PaymentStatus` ở `lib/payments-service.ts`
  phải đúng bằng `PaymentOrderStatus` của BE
  (`apps/api/src/features/payments/payment.service.ts`):
  `created | pending | succeeded | failed | canceled | needs_review`.
  - BE dùng **`succeeded`** (KHÔNG phải `paid`) → màn "thanh toán thành công"
    kiểm `order.status === 'succeeded'`.
  - BE trả **`succeeded_at`** (KHÔNG phải `paid_at`).
  - BE không có status `expired` → đơn hết hạn vẫn là `canceled`.
- Dùng helper có sẵn thay vì so sánh chuỗi:
  - `isFinalStatus(s)` → `succeeded | canceled | failed` (dừng polling).
  - `isPendingStatus(s)` → `created | pending` (tiếp tục polling).
- **`ActiveSession` giữ CẢ `quote` và `approvedQuote`.** Sau khi rider duyệt,
  BE không còn quote `pending` nào; chỉ dựa vào `quote` thì nút "Thanh toán
  ngay" biến mất và tổng tiền đã chốt không hiển thị.
  - `lib/quotes-service.ts` export `getQuoteBundle(requestId)` (1 request) và
    helper thuần `selectQuoteBundle(all)` để test.
  - UI dùng `approvedQuote ?? quote` cho mọi thao tác thanh toán.
- **Chỉ tạo payment order từ quote ĐÃ DUYỆT.** BE trả `409 Quote is not
  payable.` nếu quote còn `pending` → deep-link thông báo `quote` không được
  mở thẳng màn `/rider/payments/{quoteId}` (xem 4.6).

### 4.14. Quote nhiều bước (cứu hộ / bảo dưỡng) — `purpose` + `payment_timing`
- **BE có 5 `purpose`** (`quote.schemas.ts`): `standard`, `rescue_labor`,
  `rescue_final`, `maintenance_labor`, `maintenance_work`. Mỗi purpose có
  quy tắc riêng — FE KHÔNG được tự suy luận.
- **Rider duyệt quote `rescue_labor` PHẢI chọn `payment_timing`**:
  - `labor_upfront` → trả tiền công TRƯỚC khi thợ đi.
  - `after_repair`  → trả sau khi sửa xong.
  - BE trả **400** nếu approve `rescue_labor` mà thiếu `payment_timing`, và
    **400** nếu truyền `payment_timing` cho quote khác.
  - Modal chọn: `src/components/ui/payment-timing-modal.tsx` (dùng chung cho
    tab Cứu hộ và màn chi tiết).
  - Helper thuần: `requiresPaymentTiming(quote)` trong `lib/quotes-service.ts`.
- **`maintenance_labor` KHÔNG bao giờ payable.** Tiền công bảo dưỡng được gộp
  vào báo giá vật tư `maintenance_work` (BE tự cộng). Cùng logic cho
  `rescue_labor` với `rescue_final`.
- **Helper `isQuotePayableNow(quote, { paymentTiming, assignmentStatus })`** —
  mirror điều kiện của BE `createPaymentOrder`:
  - `rescue_labor` → chỉ payable khi `paymentTiming === 'labor_upfront'` VÀ
    assignment `accepted`.
  - `maintenance_labor` → không payable.
  - còn lại → chỉ payable khi assignment `awaiting_payment`.
- **`GET /api/v1/service-requests/{id}/payment-summary`** là nguồn chính xác
  cho "đã trả / còn trả" (`lib/payments-service.ts` → `getPaymentSummary`).
  `ActiveSession.paymentSummary` được load trong `refreshActive()`.
  - Cứu hộ `labor_upfront`: request ở `assigned` (phase `tracking`) nhưng
    rider VẪN phải trả tiền công → điều kiện thanh toán dựa trên
    `payment-summary`, KHÔNG dựa trên phase.
- **Checklist hoàn tất bắt buộc cho bảo dưỡng.** BE yêu cầu checklist gắn
  quote `maintenance_work` đã approved trước khi chuyển
  `in_progress → awaiting_payment` (BE trả 409 nếu thiếu).
  - Form: `src/components/mechanic/forms/completion-checklist-form.tsx`.
  - BE tự gắn `approved_quote_id` (server-owned) → client KHÔNG chọn quote.
  - `work_summary` phải ≥ 10 ký tự (BE trả 400 nếu thiếu).
- **Kế hoạch báo giá của mechanic**: `quotePurposePlanFor(serviceType,
  assignmentStatus)` trong `lib/mechanic-quotes-service.ts` trả kế hoạch bước
  hiện tại (`rescue_labor` → `rescue_final`; `maintenance_labor` →
  `maintenance_work` → `maintenance_work` addition với `basis_quote_id`).

### 4.7. Form GỘP chẩn đoán + báo giá (luồng rút gọn)
- **Form**: `src/components/mechanic/forms/diagnosis-quote-form.tsx`.
- **Context**: `submitDiagnosisAndQuote(jobId, input)` trong
  `contexts/mechanic-app-context.tsx`.
- **Cơ chế**: FE gọi TUẦN TỰ 2 API:
  1. `POST /api/v1/assignments/{id}/diagnoses` (nếu thợ có nhập chẩn đoán)
  2. `POST /api/v1/service-requests/{requestId}/quotes` với `diagnosis_id`
     trỏ tới chẩn đoán vừa tạo.
- **BE KHÔNG cần thay đổi** — `quote.service.ts` đã validate `diagnosis_id`
  thuộc đúng assignment/request, và đã cho phép `diagnosis_id` cho các
  purpose sau khi tới nơi.
- **Ưu điểm**: rider nhận 1 yêu cầu duyệt duy nhất (trước đây thợ phải gửi
  chẩn đoán rồi mới gửi báo giá → 2 lần bấm, 2 lần round-trip).
- **Ràng buộc KHÔNG gộp được**:
  - `rescue_labor` / `maintenance_labor` (tiền công TRƯỚC khi đi): BE cấm
    `diagnosis_id` (`quote.schemas.ts`) và lúc đó thợ chưa tới nơi.
  - `maintenance_work` phát sinh thêm (`isAddition`): báo giá PHẢI trỏ
    `basis_quote_id` tới quote `maintenance_work` đã approved.
- **State machine**: BE yêu cầu assignment = `diagnosis` khi tạo version báo
  giá đầu tiên sau khi tới nơi → `ensureDiagnosisStage()` tự chuyển
  `on_site → diagnosis` trước khi gửi.
- **Rollback**: nếu bước 1 OK nhưng bước 2 fail → chẩn đoán ĐÃ được lưu
  (BE upsert 1 record / assignment). Form hiển thị lỗi và giữ nội dung;
  lần thử lại sẽ bỏ qua bước 1 vì đã có chẩn đoán.

### 4.15. Upload ảnh thực địa (media upload intent) — contract BE
- **BE schema là `.strict()`** (`apps/api/src/features/media-uploads/media-upload.schemas.ts`).
  Body của `POST /api/v1/media/upload-intents` PHẢI đúng các field:
  `resource_type` (`service_request` | `assignment`), `resource_id` (uuid),
  `purpose`, `content_type` (`image/jpeg` | `image/png` | `image/webp`),
  `size_bytes` (1..8MB), `sha256` (hex 64 ký tự).
  - Gửi field lạ (vd `context`, `checksum`) → BE trả **400 "Media upload intent
    input is invalid."**
  - `purpose` hợp lệ theo resource: request → `problem_photo` | `other`;
    assignment → `diagnosis` | `work_proof` | `safety` | `other`.
- **SHA-256 tính TRÊN THIẾT BỊ.** Hermes không có `globalThis.crypto.subtle`,
  nên dùng helper thuần TS `src/lib/sha256.ts` (`sha256Hex(bytes)`), đã test
  khớp `node:crypto` trên nhiều độ dài.
  - `size_bytes` phải là số byte ĐO THỰC TẾ sau khi đọc buffer, KHÔNG dùng
    `asset.fileSize` của ImagePicker (ảnh có thể bị re-encode → lệch →
    finalize fail 409 "Uploaded media does not match the upload intent.").
- **Quy trình là 3 BƯỚC, không phải 4.** Bước `finalize` đã tự tạo bản ghi
  media metadata cho assignment (`media-upload.service.ts` →
  `createAssignmentMediaMetadata`) → KHÔNG gọi thêm
  `POST /api/v1/assignments/{id}/media` (tạo bản ghi trùng + vượt giới hạn
  5 media / resource).
- **Component**: `src/components/mechanic/forms/field-photo-uploader.tsx`.

### 4.16. Trạng thái `diagnosis` — không có nút chuyển trạng thái thủ công
- Ở trạng thái `diagnosis`, BE **không** cho mechanic chuyển trạng thái thủ
  công (BE tự set `quoted` khi tạo quote version đầu tiên). Nếu UI chỉ hiện
  "Không có bước chuyển trạng thái nào khả dụng" thì mechanic tưởng app lỗi.
- **Helper `nextStepHint(status, { serviceType, hasApprovedFinalQuote })`** trong
  `lib/mechanic-jobs-service.ts` trả hướng dẫn bước tiếp theo (luôn có, trừ
  trạng thái kết thúc / không xác định). `JobUpdateForm` dùng nó để thay câu
  "không có bước chuyển trạng thái".
- **Quote đã duyệt của bước TRƯỚC không được chặn form của bước HIỆN TẠI.**
  Cứu hộ có `rescue_labor` → `rescue_final`, bảo dưỡng có `maintenance_labor`
  → `maintenance_work`. Màn chi tiết dùng:
  - `approvedQuoteForStep` (đúng `purpose` của bước hiện tại) → read-only,
    chặn form.
  - `previousApprovedQuote` (khác `purpose`) → chỉ hiển thị, KHÔNG chặn form.
  - `pendingQuoteForStep` (đúng `purpose`, đang chờ duyệt) → read-only, chặn
    form.
  - Dùng `quotePlanForPurpose(purpose)` (không phải `quotePurposePlanFor`) khi
    hiển thị quote đã tồn tại — plan theo trạng thái sẽ trỏ sai bước.

### 4.17. Session + payment recovery (rider)
- **Nguồn sự thật chung cho danh sách request:** `list` / `listLoading` /
  `listError` / `reloadList` nằm trong `ActiveRequestProvider`
  (`src/contexts/active-request-context.tsx`), KHÔNG phải state cục bộ của
  `useServiceRequests()`. Provider tự hydrate 1 lần lúc mount → app mở là
  có data, tab "Theo dõi" và banner "Yêu cầu đang chạy" ở Home luôn đúng
  (trước đây mỗi screen một bản riêng → trống sau restart).
  - `reloadList` dùng `useCallback` deps rỗng → identity ổn định, dùng được
    trong deps của `useEffect` / `useFocusEffect` mà không re-fire vô hạn.
  - `active` (ActiveSession) vẫn nằm trong `useServiceRequests()` vì có
    nhiều timer/polling.
- **`paymentSummary` tải KHÔNG điều kiện** theo `assignment`.
  `GET /api/v1/service-requests/{id}/payment-summary` chỉ cần `requestId` →
  gọi vô điều kiện trong `refreshActive()` (BE trả 404 nếu chưa có quote).
  Trước đây nằm trong `if (assignment)` → ở khoảng thời gian thợ vừa accept,
  phần "đã trả / còn trả" không hiện dù BE đã có dữ liệu.
- **Màn `/rider/payments/[quoteId]`:** mount → `GET` đơn đã lưu trong
  AsyncStorage trước, mới `POST` tạo mới.
  - Storage key `@careonroad/rider/payment_orders`, map `{ [quoteId]: orderId }`
    (helper `savePaymentOrderRef` / `readPaymentOrderRef` /
    `removePaymentOrderRef` trong `src/lib/payments-service.ts`).
  - Đơn `succeeded` → hiện màn success, không lỗi 409 "This quote has already
    been paid." (BE chặn tạo đơn mới khi quote đã có đơn `succeeded`).
  - `POST` mà gặp 409 already-paid → xác nhận lại bằng `getPaymentSummary`; nếu
    `paid_amount >= total_amount` → hiện màn success dựa trên summary.
  - Ref được xoá khi đơn chốt (`succeeded` / `canceled`); GIỮ ref cho
    `failed` vì nhánh retry cần `order.id` để huỷ.
- **Đơn `failed` không bị kẹt:** BE giữ đơn `failed` trong
  `findActiveByQuoteForUpdate` → `POST` tạo đơn mới sẽ trả lại chính đơn cũ.
  Nhánh `failed` có nút **"Huỷ đơn & tạo lại"**: `cancelPaymentOrder(order.id)`
  → `createPaymentOrder(quoteId)` → poll lại.
  - Nếu huỷ 409 ("Payment cancellation was not confirmed…") → DỪNG, KHÔNG tạo
    đơn mới, báo liên hệ hỗ trợ (chống double-charge).
  - Helper thuần `paymentRetryDecision(order)` trả
    `'retryable' | 'already_paid' | 'needs_support'`; `needs_review` → admin
    xem xét, rider không tự retry.

### 4.18. Tính năng theo gói (Advance / VIP) — hồ sơ xe + mẫu nhắc bảo dưỡng

BE đã implement đầy đủ, mobile gọi đúng contract:

| Endpoint BE | Client mobile |
|---|---|
| `PATCH /api/v1/motorcycles/{id}/details` | `updateMotorcycleDetails()` — `src/lib/motorcycles-service.ts` |
| `GET /api/v1/reminder-presets` | `listReminderPresets()` — `src/lib/reminders-service.ts` |
| `POST /api/v1/motorcycles/{id}/reminder-presets` | `applyReminderPresets()` |
| `POST /api/v1/reminders/{id}/done` | `markReminderDone()` |

- **Helper thuần khoá theo gói:** `src/lib/plan-gate.ts`
  (`planSatisfies`, `hasAdvancePlan`, `hasVipPlan`, `isPlanRequiredError`,
  `planRequiredOf`, `planRequiredMessageFor`). Nguồn gói: `useAuth().user.planCode`
  (đã refresh khi app foreground → khớp BE).
- **Hồ sơ xe (VIP) — 10 field** trong `src/lib/vehicle-details.ts`
  (`VEHICLE_DETAIL_FIELDS`): màu, số khung, số máy, ngày mua, giá mua, hạn
  bảo hành, nhà cung cấp BH, số hợp đồng BH, hạn BH, trung tâm bảo hành ưu tiên.
  - Ngữ nghĩa partial-update đúng BE: **không đổi → bỏ qua key** (BE giữ),
    **xoá → gửi `null`**, **sửa → gửi giá trị mới**. Chuỗi rỗng KHÔNG hợp lệ
    (`z.string().trim().min(1)`) → `formStateToDetailsPatch` tự đổi thành `null`.
  - Đọc LUÔN được phép, kể cả khi gói hết hạn (D7: không xoá, không ẩn).
  - Ghi giá trị MỚI cần gói VIP; **xoá luôn được phép** kể cả khi hết gói (D14).
    → UI: không có VIP thì field đã lưu vẫn xoá được, field chưa có thì khoá.
- **Mẫu nhắc bảo dưỡng (Advance/VIP):** 5 mẫu trong `REMINDER_ITEM_CODES`;
  4 mẫu cần `advance`, `insurance_renewal` cần `vip`. Chu kỳ do BE quy định
  theo `usage_level` (`light`/`normal`/`heavy`) — UI chỉ chọn mức, không tự tính.
  - UI: section "Mẫu nhắc bảo dưỡng" trong tab "Nhắc nhở"
    (`app/rider/(tabs)/schedule.tsx`) → `ReminderPresetSheet`
    (`src/components/reminder-preset-sheet.tsx`): chọn xe → mức sử dụng →
    chọn mẫu → tuỳ chọn "lần làm gần nhất".
  - Rule sinh từ preset có `item_code` → `ReminderCard` hiện badge + nút
    **"Đã làm"** (`POST /reminders/{id}/done`, body `{ done_on }`).
  - Sửa/snooze/tắt một lịch nhắc **đã có** vẫn luôn được phép, kể cả hết gói.
- **Lỗi 403 `plan_required`:** BE trả body phẳng
  `{ error_code, message, details: { reason: "plan_required", required_plan } }`.
  Mobile dùng `planRequiredMessageFor(err)` để hiện message tiếng Việt + CTA
  `/rider/plans`, KHÔNG crash.
- **KHÔNG có `mileage` trong `Vehicle`:** BE cố ý không lưu số km
  (design decision D1 trong `apps/api/VEHICLE-MAINTENANCE-PLANS-DESIGN.md`).
  UI đã bỏ ô "Số km" (trước đây hiện số giả `0 km`). Màu sắc nằm trong
  `details.color` → `Vehicle.color`.

## 5. Test trên thiết bị thật (Expo Go)

### 5.1. Pre-conditions
- BE đang chạy ở port 3000 (`pnpm.cmd run dev:api` ở terminal 1).
- Database đã seed (`pnpm.cmd run seed:mock`).
- Thiết bị thật: cùng LAN với máy dev, đã cài Expo Go.

### 5.2. Khởi động mobile với LAN
```powershell
cd apps/mobile
pnpm.cmd start:lan   # auto-detect IP, set OVERRIDE, start Metro
```

Quét QR bằng Expo Go. Nếu đổi WiFi/máy → chạy lại `pnpm.cmd start:lan`.

### 5.3. Smoke test (rider1@gmail.com + mechanic1@gmail.com)
| Bước | Mong đợi |
|---|---|
| Login rider1 | Home hiển thị vehicles từ BE (mock seed: 2 xe) |
| Tap Cứu hộ khẩn cấp | Phase `searching` + ETA + live-location card |
| Login mechanic1 (sang thiết bị khác) | Offers screen nhận offer trong 5-15s |
| Mechanic accept | Navigate tới job detail, status `accepted` |
| Mechanic submit ETA | ETA card update (rider thấy trong 30s) |
| Mechanic complete job | Rider thấy "Hoàn tất" + nút "Đánh giá" |
| Rider review 5★ | Mechanic rating aggregate tăng |
| NotificationBell badge | Cả 2 role thấy badge count |

### 5.4. Env checklist
- `apps/mobile/.env`:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY` (publishable key only)
  - `EXPO_PUBLIC_API_BASE_URL_OVERRIDE` (set qua `pnpm start:lan`)
- `apps/api/.env.local`:
  - `SUPABASE_URL`, `SUPABASE_JWT_ISSUER`, `SUPABASE_JWT_AUDIENCE`,
    `SUPABASE_JWKS_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - `DATABASE_URL`
  - `INTERNAL_WORKER_SECRET`
  - `GEMINI_API_KEY`, `GEMINI_MODEL`
  - `PAYS_*` cho payOS payment

## 6. Build / verify

- Mobile dùng pnpm workspace riêng; install bằng frozen lockfile.
- Android native đã commit; nâng bằng template diff, giữ `com.careonroad.app`.
- Không chạy clean prebuild. Expo 57 mặc định clean; scripts phải giữ `--no-clean`.
- `check:native-sync` là gate chỉ đọc source, không xác nhận native build.
- Xem `SDK-UPGRADE-REPORT.md` cho kết quả kiểm chứng và các bước EAS còn lại.


```powershell
cd apps/mobile
pnpm.cmd typecheck         # tsc --noEmit
pnpm.cmd lint              # expo lint → eslint .
pnpm.cmd start:lan         # Expo Metro + LAN override
```

```powershell
cd apps/api
pnpm.cmd typecheck         # tsc --noEmit
pnpm.cmd test              # unit + static + route tests
pnpm.cmd run lint          # eslint
```

## 7. Cấm

- **Không** dùng mock fallback khi BE đã configured.
- **Không** lưu raw audio / model markdown / payment keys / tokens ở FE.
- **Không** thêm motorcycle selector UI, brand/model dropdown, booking UI mới
  ngoài những gì đã có (theo `AGENTS.md` Don't section).
- **Không** wire thêm push notifications (FCM) — để phase sau.
- **Không** gọi Gemini hoặc thanh toán trực tiếp từ FE — luôn qua BE.

## 8. Roadmap phases tiếp theo

- ASR voice chatbot (`POST /api/chatbot/sessions/[id]/transcriptions`).
- Media upload picker UI (service đã wire).
- Push notifications (FCM) backend → mobile binding.
- Admin web app (đã có plan riêng tại `PLANS/admin-web/`).
