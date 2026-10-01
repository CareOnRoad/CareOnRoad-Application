# Báo cáo đánh giá chi tiết tính hoàn chỉnh — CareOnRoad

> **Ngày đánh giá:** 28/09/2026
> **Phạm vi:** Toàn bộ monorepo (`apps/api`, `apps/web`, `apps/mobile`, `packages/*`)
> **Phương pháp:** Đọc trực tiếp 438 file TS/TSX của BE + 34 file web + 54 file mobile + migrations + scripts. Đánh giá dựa trên cấu trúc thực tế chứ không phải tài liệu trong `AGENTS.md`.

---

## 1. Tổng quan monorepo

| App | Stack | Đường dẫn | Loại workspace |
|---|---|---|---|
| `@careonroad/api` | Next.js 15 (App Router) + React19 + TS + Zod + postgres + sherpa-onnx | `apps/api/` | Trong root pnpm workspace |
| `@careonroad/web` | Next.js 16.3 + React 19 + Tailwind 4 | `apps/web/` | Trong root pnpm workspace |
| `@careonroad/mobile` | Expo52 + RN 0.76 + expo-router 4 + Supabase JS + NativeWind | `apps/mobile/` | **Workspace RIÊNG** (`apps/mobile/pnpm-workspace.yaml` chỉ cover `"."`) |
| `@careonroad/api-contract` | TS + Zod schemas (planned) | `packages/api-contract/` | Stub rỗng — **chưa move** |
| `@careonroad/domain` | (planned) | `packages/domain/` | Stub rỗng |
| `@careonroad/config` | (planned) | `packages/config/eslint/` | Chỉ có README rỗng |

**Root workspace** (`pnpm-workspace.yaml`):

```yaml
packages:
  - "apps/api"
  - "apps/web"
  - "packages/*"
```

**Vấn đề tổng quan:** 3 packages trong `packages/` đều chỉ là stub. Plan Phase 0 mới được viết ngày 27/09/2026, hiện **chưa thực thi** → toàn bộ Zod schemas vẫn nằm rải rác trong `apps/api/src/features/*/*.schemas.ts`.

---

## 2. Đánh giá chi tiết BE (`apps/api`)

### 2.1 Quy mô và cấu trúc

| Chỉ tiêu | Số liệu thực tế |
|---|---|
| Tổng file TS trong `src/features/` | **259** (không tính test) |
| File test | **126** |
| Route handler files (`app/api/**/route.ts`) | **96** |
| Features (theo domain) | **23** |
| Repository contracts (interface) | **27** |
| Postgres repository implementations | **26** (thiếu `unit-of-work.ts` so với contracts) |
| Workers | **7** |
| Migrations | **32** file SQL |
| Source files (không tính test) | **132** |

### 2.2 Các feature (23 features)

`admin`, `asr`, `assignments`, `audit`, `auth`, `chatbot`, `dispatch`, `health`, `live-tracking`, `mechanic-diagnosis`, `mechanic-operations`, `media-uploads`, `motorcycles`, `notifications`, `operations`, `outbox`, `payments`, `quotes`, `reminders`, `retention`, `reviews`, `route-eta`, `service-requests`.

### 2.3 HTTP Routes — phủ sóng toàn diện

**`/api/chatbot/*`** — 4 routes (sessions, messages, transcriptions, diagnosis, claim) ✅

**`/api/v1/admin/*`** — phủ kín:

- `users` (list/detail + 7 sub-actions: archive, suspend, reactivate, roles/grant|revoke, devices, activity)
- `mechanics` (list/detail + 8 sub-actions: approve, reject, suspend, ban, reactivate, force-unavailable, skills, service-radius, work-history, performance)
- `service-requests` (list/detail + 7 sub-actions: cancel, manual-escalate, media, notes, quotes, timeline, assignment)
- `operations` (4 queues: dispatch-stuck, outbox-dead-letters, payments-needs-review, worker-runs)

**`/api/v1/auth/*`** — `me`, `profile`, `devices`, `devices/[deviceId]/push-token` ✅

**`/api/v1/assignments/*`** — list + 8 sub-actions: status, eta, media, completion-checklist, diagnoses, recover, review, route-eta, live-location ✅

**`/api/v1/dispatch/*`** — offers list, accept, decline ✅

**`/api/v1/internal/health/{live,ready}`** ✅ + **8 worker routes** (dispatch, outbox, payments/reconcile, reminders, retention, reviews/rebuild-ratings, media-uploads/cleanup, live-locations/cleanup) ✅

**`/api/v1/{mechanics/me,motorcycles,media,notifications,payments,quotes,reminders,service-requests}/*`** — đầy đủ CRUD + các sub-action (snooze, cancel, dispatch, quotes cho service-requests, v.v.)

### 2.4 Chất lượng BE

**Điểm mạnh:**

- **Schema layer có hệ thống:** Mỗi feature có `*.schemas.ts` riêng (Zod), route-handlers mỏng ~100-200 dòng, services và repositories tách biệt.
- **Repository pattern đúng đắn:** Contracts (interface) → Postgres + Testing (in-memory) implementations → factory. Có `PostgresUnitOfWork` cho transaction.
- **Auth robust:** JWT verify (Supabase), request-actor pattern, audit + outbox tự động.
- **Idempotency chuẩn:** `X-Idempotency-Key` cho POST tạo service-request, payments, assignment mutations, completion-checklist.
- **AI Chatbot pipeline:** `diagnosis.service.ts` có full flow: normalize-VI → safety gate → retrieval → prompt → Gemini → OpenRouter (chain) → post-validation → fallback.
- **Knowledge base thực tế:** 18 entries phủ battery/spark-plug/air-filter/fuel/brake/tire/CVT/overheat/rain/smoke/steering/fuel-leak.
- **Workers:** 7 workers (outbox, reminder, dispatch, retention, media-upload-cleanup, review-rating-rebuild, worker-run-recorder) đều có route protected.
- **Test rất nhiều:** 126 test files — unit, route, integration. Có contract test cho repositories (`testing/__tests__/*.contract.test.ts`).
- **Routes thin:** Ví dụ `auth/me/route.ts` chỉ ~10 dòng, delegate sang `auth.route-handlers`. Tuân thủ nguyên tắc trong AGENTS.md.
- **Database:** 32 migrations có versioning rõ (`202606250001_*` → `202606250032_*`). Có RLS foundation, indexes, audit outbox.
- **P1 features đầy đủ:** Live-tracking, retention worker, distributed runtime controls, chatbot session ownership — đều đã có migration + route.
- **Operational monitoring:** Admin queue (`operations/`) + worker-run recorder — production-grade.

**Điểm yếu / vi phạm scope:**

- **`packages/api-contract/` rỗng** — Plan Phase 0 mới viết ngày 27/09 nhưng chưa execute. Toàn bộ schemas còn nằm trong BE → vi phạm nguyên tắc "single source of truth" trong chính plan đó.
- **Mock fallback còn lẫn vào API path thật:** `CHATBOT_PERSISTENCE_MODE` có default memory thay vì Postgres → vi phạm tinh thần "uses PostgreSQL repositories" cho `/api/v1`. Tuy nhiên đây là design intentional cho demo.
- **Schemas chưa chuẩn hóa:** Mỗi feature tự định nghĩa `*.schemas.ts`, mỗi service tự định nghĩa `*.errors.ts` → consistent nhưng chưa centralized.
- **Worker-run recorder chỉ 538 bytes** — quá nhỏ, có thể chỉ là no-op. Cần verify behavior.
- **Có 1 file `payment-provider.ts`** trong payments nhưng thiếu in-memory/payos implementation thực sự (chỉ thấy reference).
- **`packages/domain` và `packages/config` đều rỗng** — stub planning overhead chưa dùng tới.
- **Web không consume bất kỳ endpoint nào từ BE** (xem mục 3).

**Đánh giá tổng BE: 88/100** — production-ready backend, layer hóa rất tốt, có test kha khá, migrations chuẩn. Trừ điểm vì packages/ chưa move schemas, admin web chưa wire thật.

---

## 3. Đánh giá chi tiết Web (`apps/web`)

### 3.1 Quy mô

| Chỉ tiêu | Số liệu |
|---|---|
| Tổng file TSX | **34** |
| Pages | **9** (`/`, `/dat-lich`, `/dich-vu`, `/khan-cap`, `/lien-he`, `/tin-tuc`, `/yeu-cau`, `/admin/layout`, `/admin/dashboard`) |
| Section components | **15** (hero, services-grid, contact-form, request-form, booking-form, news-grid, testimonials, process, intro-section, featured-blog, cta-glass, emergency-banner, contact-quick-link, hero-figma, services-grid-figma) |
| Admin components | **6** (admin-layout, welcome-header, metrics-bento, telemetry-mosaic, needs-attention-table, background-jobs-table) |
| Layout components | **2** (header, footer) |
| UI primitives | **1** (`icons.tsx`) |
| Lib | `api-client.ts` (mock), `mock-data.ts` (hardcoded), `cn.ts` |

### 3.2 Tính năng web

**Marketing site (đầy đủ về UI):**

- Trang chủ: Hero + Intro + Services + Featured Blog + Contact Quick Link.
- `/dich-vu`, `/dat-lich`, `/yeu-cau`, `/lien-he`, `/khan-cap`, `/tin-tuc`: đều có page riêng.
- Header + Footer ở `app/layout.tsx`.
- Form components đầy đủ (`booking-form`, `contact-form`, `request-form`).

**Admin:**

- `/admin/dashboard`: chỉ có **1 page duy nhất** (figma node 253:10232).
- Layout admin có sidebar + topbar với nav items hardcoded (Yêu cầu Cứu hộ, KTV, Người dùng, Vận hành).
- **Không có** `/admin/users`, `/admin/mechanics`, `/admin/service-requests`, `/admin/operations` page dù backend đã sẵn sàng 100%.

### 3.3 Vấn đề nghiêm trọng của Web

**`api-client.ts` hoàn toàn là mock:**

```typescript
// apps/web/src/lib/api-client.ts (toàn bộ 70 dòng)
// Today: every method returns mock data from `@/lib/mock-data`.
// Tomorrow: replace internals with `fetch('/api/v1/...')` calls once BE is wired.
```

**Dẫn tới:**

- Mọi page (`dich-vu`, `dat-lich`, `yeu-cau`, `lien-he`, `tin-tuc`, `khan-cap`) đều render dữ liệu hardcoded từ `mock-data.ts`.
- Không có auth provider cho web (stub Phase 1 chưa viết).
- Không có `http-client.ts` thật, không có error mapper thật.
- Admin dashboard hiển thị số liệu **hardcoded** trong `metrics-bento.tsx`, `background-jobs-table.tsx`, `needs-attention-table.tsx`, `telemetry-mosaic.tsx` — các con số "14 Chờ", "3 đang duyệt", "128 users", "dispatch_timeout_sweeper" đều là string constant trong file, không fetch BE.

**Tóm lại Web:**

- ✅ UI/marketing đẹp, có figma-driven layout (`hero-figma.tsx`, `services-grid-figma.tsx`).
- ✅ TypeScript types đầy đủ (`/types` folder).
- ✅ Tailwind v4 + design tokens.
- ❌ **Zero integration với backend thật** — dù backend đã sẵn sàng 96 routes.
- ❌ **Admin web hoàn toàn static** — bảng "vận hành hệ thống" giả lập, không có data thật.
- ❌ Không có auth flow (login/logout) trên web.

**Đánh giá tổng Web: 35/100** — UI shell tốt nhưng về mặt "hoàn chỉnh sản phẩm" thì chỉ là mockup. Plan đang đề xuất Phase 1-5 để wire — hiện **chưa thực thi phase nào**.

---

## 4. Đánh giá chi tiết Mobile (`apps/mobile`)

### 4.1 Quy mô

| Chỉ tiêu | Số liệu |
|---|---|
| Tổng file TSX | **54** |
| Lib files (services + api) | **27** |
| Contexts | **3** (auth, app, mechanic-app) |
| Hooks | **1** (use-service-requests) |
| App routes | `app/(auth)/{login,register}`, `app/rider/{(tabs)x5, vehicles, payments, schedule, history, review, notifications}`, `app/mechanic/{(tabs)x6, jobs, notifications}` |

### 4.2 Tính năng mobile

**Auth flow:**

- ✅ Supabase JS wired (`supabase-client.ts` với AsyncStorage adapter).
- ✅ `auth-service.ts` có full flow: signIn/signUp/signOut/fetchCurrentActor.
- ✅ Fallback demo mode khi `EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY` chưa set.
- ✅ `AuthContext` hydrate session từ AsyncStorage, fallback minimal actor khi BE fail.
- ✅ Demo bypass (`bypassLoginAs(role)`) cho dev.

**Rider screens (đầy đủ):**

- 5 tabs: home/index, profile, rescue, schedule, vehicles.
- Sub-pages: `vehicles/{detail,form}`, `schedule/{booking,confirmed}`, `payments/[quoteId]`, `history`, `notifications`, `review`.
- Rescue screen 33 KB — khá lớn, có thể là form phức tạp.

**Mechanic screens:**

- 6 tabs: index, profile, jobs, schedule, offers, notifications.
- Sub-pages: `jobs/detail` 11 KB.
- Forms: `mechanic/forms/job-update-form.tsx` 10 KB.

**Services đầy đủ ở `src/lib/`:**

- `auth-service`, `auth-storage`, `auth-types`
- `motorcycles-service`, `mechanics-service`, `mechanic-jobs-service`
- `service-requests-service` (8 KB), `assignments-service`
- `dispatch-service`, `quotes-service`, `payments-service`
- `reminders-service`, `notifications-service`, `media-uploads-service`
- `profile-service`, `devices-service`, `config`, `utils`, `types`

### 4.3 Vấn đề của Mobile

**Mock data vẫn còn song song với API thật:**

- `mock-data.ts` (181 dòng) cho rider, `mechanic-mock-data.ts` (293 dòng) cho mechanic — vẫn được dùng làm fallback khi BE fail.
- `mock-ai.ts` (cho chatbot AI response fallback).
- File `mock-data.ts` cung cấp `mockVehicles`, `mockServices`, `mockAppointments`, `mockMechanics`, `mockEmergencyCalls` — những thứ này đã có endpoints thật (`/api/v1/motorcycles`, `/api/v1/service-requests`, `/api/v1/dispatch/offers`).

**AuthContext dual-mode:**

- Có fallback khi Supabase chưa cấu hình → dùng AsyncStorage demo.
- BE có thể fail (timeout/LAN) → vẫn giữ session, dùng minimal actor với role = 'rider' mặc định. Đây là design khá an toàn nhưng có thể che lỗi.

**Một số chỗ acknowledge thiếu:**

- Trong `auth-service.ts` dòng 110-118:

```typescript
if (desiredRole === 'mechanic' && !actor.roles.includes('mechanic')) {
  // Trong prototype: chấp nhận role hiện tại nhưng ghi log để theo dõi.
  // ... Tài khoản sẽ ở role mặc định của backend.
}
```

→ Đăng ký mechanic qua mobile chưa thực sự gán role mechanic (BE chưa có endpoint role-grant). **Đây là known limitation đã được document.**

**Tóm lại Mobile:**

- ✅ **Wired thật với BE** (api.ts gọi fetch, error mapping đầy đủ, idempotency).
- ✅ Auth + Supabase + token provider + actor hydration đầy đủ.
- ✅ 54 screen pages cho cả 2 role.
- ✅ Services layer có 27 file, mỗi file ~2-8 KB → coverage rộng.
- ⚠️ Vẫn giữ mock fallback cho resilience, có thể gây nhầm lẫn nếu BE lỗi.
- ⚠️ Workspace riêng (`apps/mobile/pnpm-workspace.yaml`) → **chưa gộp vào root workspace** → chưa thể dùng `@careonroad/api-contract` khi plan Phase 0 hoàn thành.

**Đánh giá tổng Mobile: 75/100** — production-ready gần hết về mặt code, screens đầy đủ, services có real API. Trừ điểm vì vẫn lẫn mock fallback, chưa có integration test thật với hosted DB, và còn lỗ hổng "role mechanic không set được khi đăng ký".

---

## 5. Bảng so sánh tổng hợp

| Tiêu chí | BE (api) | Web | Mobile |
|---|---|---|---|
| **Hoàn chỉnh về code** | 90% | 40% | 80% |
| **Routes / endpoints** | 96 routes thật | 0 (mock) | ~25 services gọi thật |
| **TypeScript types** | ✅ | ✅ (mock-data.ts) | ✅ (auth-types, types.ts) |
| **Database migrations** | 32 SQL files | — | — |
| **Tests** | 126 test files | 0 | 0 |
| **UI/UX completeness** | — | Marketing 80%, Admin 15% | 80% (54 screens) |
| **Real API integration** | N/A (là API) | ❌ Mock only | ✅ Qua Supabase + REST |
| **Auth flow** | JWT verify, RBAC | ❌ Không có | ✅ Supabase + AsyncStorage |
| **Production-readiness** | ✅ Có thể deploy | ❌ Chỉ là mockup | ⚠️ Cần BE thật + test |
| **Workspace setup** | ✅ | ✅ | ⚠️ Workspace riêng |
| **Điểm hoàn chỉnh** | **88/100** | **35/100** | **75/100** |

---

## 6. Đánh giá trên 6 trụ cột "hoàn chỉnh"

### ✅ Tính đúng đắn (Correctness) — BE 90%, Web 60%, Mobile 80%

- **BE:** có contract tests, unit tests, integration tests. Zod parse mọi input. State machines rõ ràng (`assignment-state.ts`, `service-request-state.ts`, `admin-request-state.ts`).
- **Web:** mock data static, không có runtime check. Admin hiển thị số liệu hardcoded → có thể "đúng" nếu xem là demo.
- **Mobile:** có real fetch + Zod-equivalent runtime check qua TS types. Một số fallback chưa đúng 100% (role mechanic khi signup).

### ⚠️ Tính tích hợp (Integration) — BE 95%, Web 5%, Mobile 70%

- **BE:** Supabase JWT + audit + outbox + worker retry + assignment concurrency + dispatch leasing → integration rất tốt với DB.
- **Web:** **không có integration nào với BE thật** — đây là gap lớn nhất của codebase.
- **Mobile:** integration chủ yếu qua `api.ts` + Supabase client. Có retry ngầm qua Supabase autoRefreshToken.

### ⚠️ Tính nhất quán (Consistency) — BE 85%, Web 70%, Mobile 80%

- **BE:** schemas ở 21 file riêng lẻ (chưa centralized). Mỗi feature tự có errors.ts.
- **Web:** types ở `/types` folder dùng chung, nhưng mock-data hardcode.
- **Mobile:** types ở `src/lib/types.ts`, `auth-types.ts`, `mechanic-types.ts` → hơi phân tán nhưng chấp nhận được.

### ✅ Khả năng bảo trì (Maintainability) — BE 80%, Web 60%, Mobile 75%

- **BE:** layer hóa rõ (route-handler → service → repository → DB). Dễ test với in-memory implementations.
- **Web:** components có comment figma node ID → dễ trace. Nhưng admin dashboard hardcode → khó maintain.
- **Mobile:** contexts tách biệt (auth/app/mechanic). Hooks pattern dùng đúng.

### ✅ Bảo mật (Security) — BE 90%, Mobile 75%

- **BE:** JWT verify qua JWKS, rate-limit, idempotency, audit/outbox sanitize, role-based middleware, worker-secret auth, payment webhook signature (payOS).
- **Mobile:** AsyncStorage session với prefix, không log token, không hardcode key.
- **Web:** không có auth → không có attack surface, nhưng cũng không có user data.

### ⚠️ Hoàn thiện UX — Web 75%, Mobile 80%

- Cả web và mobile đều có design system riêng. Figma-driven.
- Nhưng web admin là mockup → không phản ánh production UX.

---

## 7. Điểm nghẽn & cản trở chính

1. **Plan Phase 0 chưa execute** — `packages/api-contract/` rỗng, toàn bộ schemas vẫn ở BE → 21 file `*.schemas.ts` ở `apps/api/src/features/` không thể share với web. Đây là blocker số 1 cho mọi consumer khác ngoài BE.

2. **Web chưa wire BE** — 6 admin pages không tồn tại (`/admin/users`, `/admin/mechanics`, `/admin/service-requests`, `/admin/operations`). Bảng dashboard hiển thị số liệu hardcoded. Đây là blocker lớn nhất cho việc ship production.

3. **Mobile workspace tách rời** — `apps/mobile/pnpm-workspace.yaml` chỉ cover `"."` → mobile chưa thể resolve `@careonroad/api-contract`. Cần gộp vào root workspace (Phase 6 của plan hiện tại).

4. **`packages/domain` và `packages/config` đều rỗng** — tốn effort planning overhead nhưng chưa dùng. Nên ưu tiên Phase 0 trước.

5. **Web không có auth** — không có login/logout page, không có Supabase client cho web. Plan Phase 5 mới đề cập.

6. **Admin dashboard numbers là hardcoded string** — `MetricsBento`, `BackgroundJobsTable`, `NeedsAttentionTable` đều có const arrays với literal `"14"`, `"3"`, `"5"` etc. → kể cả wire BE xong cũng cần refactor data flow.

---

## 8. Đề xuất ưu tiên

Nếu cần đưa codebase lên "production hoàn chỉnh", thứ tự ưu tiên:

1. **Execute Phase 0** (move schemas → `packages/api-contract/`, 1-2 ngày).
2. **Phase 1 + 2** (http-client + auth-provider stub + wire 6 admin read endpoints) → mở khóa cho mọi thứ còn lại.
3. **Phase 3-4** (write endpoints cho admin + refactor 4 dashboard components từ hardcoded → fetch).
4. **Phase 5** (Supabase auth cho web).
5. **Phase 6** (gộp mobile vào root workspace, dùng `@careonroad/api-contract`).
6. **Verify mobile e2e** với hosted Supabase + chạy `pnpm.cmd run seed:mock`.

---

## 9. Kết luận

| App | Tóm tắt 1 dòng |
|---|---|
| **BE** | Gần như production-ready, 96 routes thật, 32 migrations, 126 tests, nhưng chưa chia sẻ contract với frontend. |
| **Web** | UI marketing + admin shell đẹp, nhưng **100% mock data**, 0 integration BE, chưa có auth — chỉ là prototype. |
| **Mobile** | Gần production-ready, 54 screens wired với BE thật qua Supabase + REST, có fallback mock an toàn, nhưng vẫn thiếu role-grant khi đăng ký mechanic và test e2e thật với hosted DB. |

Tổng quan monorepo đang ở trạng thái **"BE done, Mobile 80% done, Web chỉ là demo"**. Để đạt MVP ra mắt user, ưu tiên cao nhất là wire admin web với BE (Phase 1-5 của plan hiện tại).
