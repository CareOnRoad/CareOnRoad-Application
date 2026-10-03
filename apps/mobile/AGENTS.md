# apps/mobile — Agent Notes

> File này bổ sung cho `AGENTS.md` ở thư mục gốc. Mọi rule "always apply"
> trong `AGENTS.md` vẫn giữ nguyên hiệu lực. File này ghi nhận các quyết
> định wire mobile FE ↔ BE đã merge.

## 1. Tổng quan

- **Stack**: Expo SDK 54, React Native 0.81, React 19, Expo Router (file-based),
  TypeScript 5.x, NativeWind (Tailwind), `lucide-react-native`, Zod (chỉ dùng
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
  - `quote` (rider) → `/rider/payments/{quoteId}?requestId=...`
  - `payment` (rider) → `/rider/(tabs)/rescue`
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
- `apps/mobile/src/lib/location-service.ts` export `watchCurrentPosition()`.
- Bật/tắt qua `useMechanicApp().toggleLiveSharing(assignmentId)`.
- BE rate-limit theo env `LIVE_TRACKING_MIN_UPDATE_INTERVAL_SECONDS` (mặc định
  ~10-15s). Client-side cũng throttle 10s + skip accuracy > 100m.
- Auto-stop khi assignment chuyển sang `completed` / `canceled` /
  `recovery_canceled` (qua `useEffect` watcher trong context).
- Cleanup watch handle khi unmount provider hoặc job rời màn hình.

### 4.9. Mechanic submit quote
- `apps/mobile/src/lib/mechanic-quotes-service.ts` export `submitQuote()`.
- `purpose` auto-fill theo `serviceType`:
  `emergency_rescue` → `rescue_final`, `periodic_maintenance` → `maintenance_work`,
  khác → `standard`.
- Optimistic placeholder quote trong context `latestQuoteMap`; rollback khi BE
  fail (đặc biệt 409 - state machine không cho phép).
- Form UI ở `components/mechanic/forms/quote-form.tsx` + `diagnosis-form.tsx`.

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
  - `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`
  - `PAYS_*` cho payOS payment

## 6. Build / verify

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
- **Không** gọi OpenRouter hoặc thanh toán trực tiếp từ FE — luôn qua BE.

## 8. Roadmap phases tiếp theo

- ASR voice chatbot (`POST /api/chatbot/sessions/[id]/transcriptions`).
- Media upload picker UI (service đã wire).
- Push notifications (FCM) backend → mobile binding.
- Admin web app (đã có plan riêng tại `PLANS/admin-web/`).
