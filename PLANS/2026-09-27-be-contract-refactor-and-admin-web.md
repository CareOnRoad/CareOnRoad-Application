# Plan: Refactor BE → `@careonroad/api-contract` + Wire Admin Web

**Ngày tạo:** 2026-09-27
**Phạm vi:** Phase 0 → Phase 5 (toàn bộ chuỗi đã thống nhất)
**Liên quan:**
- `apps/api` (backend Next.js)
- `apps/web` (Next.js App Router, React 19)
- `packages/*` (workspace mới — `api-contract`)
- KHÔNG liên quan: `apps/mobile` (workspace độc lập, xem cuối file)

---

## Tổng quan & Mục tiêu

**Hiện trạng:**
- `apps/api` khai báo Zod schemas nội bộ trong từng feature (auth, motorcycles, service-requests, dispatch, assignments, quotes, payments, reminders, notifications, media-uploads, reviews, live-tracking, route-eta, retention, runtime-controls, chatbot).
- `apps/web` chưa wire BE thật: `apps/web/src/lib/api-client.ts` đang trả mock data từ `@/lib/mock-data` (xem comment trong file: *"Today: every method returns mock data... Tomorrow: replace internals with fetch('/api/v1/...')"*).
- Admin dashboard (`apps/web/src/app/admin/dashboard/page.tsx`) chỉ có UI shell, đang render static components (`MetricsBento`, `TelemetryMosaic`, `NeedsAttentionTable`, `BackgroundJobsTable`).

**Mục tiêu:**
1. **Single source of truth** cho HTTP contracts (Zod schemas + TS types) ở `packages/api-contract/`.
2. **BE tự verify** contract ở runtime qua Zod parse; FE (admin web) tái sử dụng cùng schema để typecheck trước khi gửi request và parse response.
3. **Wire admin web** với BE thật, bắt đầu từ các endpoint đã có sẵn từ `specs/003-careonroad-admin-operations` (users, mechanics, service-requests, operational queues).
4. **Giữ mock-data fallback** cho non-admin pages (landing, dich-vu, lien-he, yeu-cau, dat-lich, khan-cap, tin-tuc) để không vỡ demo khi BE chưa sẵn sàng 1 phần.

**Nguyên tắc không thay đổi:**
- Không thêm dependency mới ngoài `zod` (đã có).
- Không thay đổi wire shape (JSON, status codes, field names) — chỉ move code.
- Không touch mobile (xem phần "Phạm vi ảnh hưởng tới mobile" cuối file).
- Không viết frontend payment/settlement/UI mới (giữ nguyên scope theo AGENTS.md).

---

## Phase 0 — Tạo `@careonroad/api-contract` (foundation)

### Mục tiêu
Tách toàn bộ Zod schemas + inferred TS types hiện có ở BE ra `packages/api-contract/`. BE đổi từ `import { X } from './schemas'` → `import { X } from '@careonroad/api-contract'`. Không thay đổi behavior.

### Tasks

#### T0.1 — Tạo workspace package `packages/api-contract/`
- Tạo `packages/api-contract/package.json`:
  ```json
  {
    "name": "@careonroad/api-contract",
    "version": "0.0.0",
    "private": true,
    "type": "module",
    "main": "./src/index.ts",
    "types": "./src/index.ts",
    "exports": {
      ".": "./src/index.ts",
      "./*": "./src/*.ts"
    },
    "dependencies": {
      "zod": "^3.23.0"
    }
  }
  ```
- Tạo `packages/api-contract/tsconfig.json` (strict, extends root nếu có).
- Tạo `packages/api-contract/src/index.ts` re-export.

**Lưu ý:** Repo đã có stub `packages/api-contract/package.json` (theo grep trước) — verify trước khi viết đè.

#### T0.2 — Di chuyển schemas theo feature
Mapping hiện trạng → vị trí mới:

| Feature hiện tại (apps/api/src/features/...) | File schema nguồn | Đích mới |
|---|---|---|
| auth | `auth.schemas.ts` | `packages/api-contract/src/auth.ts` |
| motorcycles | `motorcycle.schemas.ts` | `packages/api-contract/src/motorcycles.ts` |
| mechanic-profile | `mechanic-profile.schemas.ts` | `packages/api-contract/src/mechanic-profile.ts` |
| mechanic-operations | `mechanic-operations.schemas.ts` | `packages/api-contract/src/mechanic-operations.ts` |
| service-requests | `service-request.schemas.ts` | `packages/api-contract/src/service-requests.ts` |
| dispatch | `dispatch.schemas.ts` | `packages/api-contract/src/dispatch.ts` |
| assignments | `assignment.schemas.ts` | `packages/api-contract/src/assignments.ts` |
| mechanic-diagnosis | `mechanic-diagnosis.schemas.ts` | `packages/api-contract/src/mechanic-diagnosis.ts` |
| quotes | `quote.schemas.ts` | `packages/api-contract/src/quotes.ts` |
| payments | `payment.schemas.ts` | `packages/api-contract/src/payments.ts` |
| reminders | `reminder.schemas.ts` | `packages/api-contract/src/reminders.ts` |
| notifications | `notification.schemas.ts` | `packages/api-contract/src/notifications.ts` |
| media-uploads | `media-upload.schemas.ts` | `packages/api-contract/src/media-uploads.ts` |
| reviews | `review.schemas.ts` | `packages/api-contract/src/reviews.ts` |
| live-tracking | `live-tracking.schemas.ts` | `packages/api-contract/src/live-tracking.ts` |
| route-eta | `route-eta.schemas.ts` | `packages/api-contract/src/route-eta.ts` |
| retention | `retention.schemas.ts` | `packages/api-contract/src/retention.ts` |
| runtime-controls | `runtime-controls.schemas.ts` | `packages/api-contract/src/runtime-controls.ts` |
| admin (operations) | `admin-operations.schemas.ts` | `packages/api-contract/src/admin-operations.ts` |
| chatbot | (in diagnosis.service.ts + types) | `packages/api-contract/src/chatbot.ts` |
| shared/common | `api-error.ts` (error codes) | `packages/api-contract/src/common.ts` |

**Quy tắc di chuyển:**
- Chỉ move file + đổi import paths bên trong (nếu schema có reference tới schema khác cùng feature thì đổi sang relative path trong cùng package).
- KHÔNG đổi tên schema, KHÔNG đổi field, KHÔNG thêm validation.
- KHÔNG move logic (chỉ Zod schemas + inferred types).
- File gốc BE được **xóa** sau khi BE đã đổi import (xem T0.3).

#### T0.3 — Đổi imports ở BE
- Ở mỗi feature service trong `apps/api/src/features/<feature>/`, đổi:
  ```ts
  // trước
  import { X } from './<feature>.schemas';
  // sau
  import { X } from '@careonroad/api-contract';
  ```
- Đối với route-handlers, services, repositories: tất cả những nơi dùng schema đều phải đổi.
- Sau khi BE build/typecheck pass → xóa file schemas cũ trong `apps/api/src/features/<feature>/<feature>.schemas.ts`.
- Lưu ý: một số file schemas có thể đã được split (request/response/error). Giữ nguyên cấu trúc, chỉ move.

#### T0.4 — Cập nhật root `pnpm-workspace.yaml`
Hiện tại:
```yaml
packages:
  - "apps/api"
  - "apps/web"
  - "packages/*"
```
→ Đã cover `packages/api-contract` (qua glob `packages/*`). Không cần đổi.

#### T0.5 — Verify BE
Chạy theo AGENTS.md:
```cmd
pnpm.cmd install
pnpm.cmd run typecheck
pnpm.cmd run lint
pnpm.cmd test
pnpm.cmd run build:api
```
Phải pass 100% — đây là test quan trọng nhất vì Phase 0 là "move file only".

### Definition of Done — Phase 0
- [ ] `packages/api-contract/src/` có file cho mỗi feature theo mapping trên.
- [ ] `apps/api` không còn file `*.schemas.ts` trong `src/features/`.
- [ ] `pnpm.cmd typecheck`, `lint`, `test`, `build:api` pass.
- [ ] Không có wire shape nào thay đổi (đối chiếu với OpenAPI thủ công hoặc inspect response shape).
- [ ] Không thay đổi dependency nào.

---

## Phase 1 — Tạo HTTP client + Error mapper chung cho Web

### Mục tiêu
Thay vì `apps/web/src/lib/api-client.ts` chỉ trả mock, tách thành:
- `apps/web/src/lib/http-client.ts` — fetch wrapper với Bearer token, idempotency key, error mapping.
- `apps/web/src/lib/api-client.ts` — giữ nguyên signature hiện tại nhưng internals switch giữa `mock` và `live` theo env var.

### Tasks

#### T1.1 — `http-client.ts`
- Method `request<T>(method, path, { body, query, headers, signal, timeoutMs })`.
- Tự đính kèm `Authorization: Bearer <token>` nếu có (sử dụng Supabase client tương tự mobile — xem `apps/mobile/src/lib/api.ts` để tham khảo pattern).
- Tự generate `X-Idempotency-Key` cho POST/PUT/PATCH/DELETE (UUID v4).
- Parse JSON response; nếu status >= 400 → throw `ApiError(status, code, message, details)`.
- Timeout default 15s; cho phép override qua options.
- Sanitize log (không in token, body).

#### T1.2 — `ApiError` + codes
- Copy pattern từ `apps/mobile/src/lib/api.ts:14-46` (đã có `ApiErrorCode = 'UNAUTHORIZED' | 'INVALID_TOKEN' | ...`).
- Map HTTP status → code theo bảng:
  - 400 → `INVALID_INPUT`
  - 401 → `UNAUTHORIZED`
  - 403 → `FORBIDDEN`
  - 404 → `NOT_FOUND`
  - 409 → `CONFLICT`
  - 5xx → `INTERNAL_ERROR`
- Cho phép truyền `code` từ BE response body nếu có (BE trả `{ code, message, details }` — xem `src/lib/api-error.ts`).

#### T1.3 — Switch mock/live cho `api-client.ts`
- Đọc `NEXT_PUBLIC_API_BASE_URL` (đã có trong `eas.json` pattern nhưng web dùng `NEXT_PUBLIC_`).
- Nếu empty hoặc `__USE_MOCK__` → trả mock (giữ nguyên hiện trạng).
- Nếu có URL → gọi `httpClient.request()`.
- Mỗi method trong `apiClient` switch inline; vẫn giữ nguyên signature Promise<T>.

#### T1.4 — Auth provider cho web
- Hiện tại web không có auth context (xem apps/web/src/app/page.tsx và AdminLayout).
- Phase 1 chỉ tạo stub `apps/web/src/lib/auth-provider.ts` export `getAccessToken(): Promise<string|null>` đọc từ localStorage / cookie (sẽ wire Supabase ở Phase 5).
- http-client gọi `getAccessToken()` lazy.

### Definition of Done — Phase 1
- [ ] `http-client.ts` + `auth-provider.ts` (stub) tồn tại.
- [ ] `api-client.ts` vẫn trả mock khi không có env (không vỡ demo).
- [ ] Type-check pass.
- [ ] Admin dashboard page vẫn render bình thường (chưa đổi data source).

---

## Phase 2 — Wire admin API contracts (read-only)

### Mục tiêu
Web (admin) consume các endpoint admin đã có sẵn từ `specs/003-careonroad-admin-operations`:
- `GET /api/v1/admin/users`, `GET /api/v1/admin/users/[userId]`
- `GET /api/v1/admin/mechanics`, `GET /api/v1/admin/mechanics/[mechanicId]`
- `GET /api/v1/admin/service-requests`, `GET /api/v1/admin/service-requests/[requestId]`
- `GET /api/v1/admin/operations/outbox-dead-letters`
- `GET /api/v1/admin/operations/payments-needs-review`
- `GET /api/v1/admin/operations/dispatch-stuck`
- `GET /api/v1/admin/operations/worker-runs`
- `GET /api/v1/internal/health/live`, `GET /api/v1/internal/health/ready`

### Tasks

#### T2.1 — Tạo `apps/web/src/lib/admin-api.ts`
- Một module export các hàm typed:
  ```ts
  import type { AdminUserListResponse } from '@careonroad/api-contract/admin-operations';
  export async function listAdminUsers(query?: AdminUserListQuery): Promise<AdminUserListResponse>
  ```
- Mỗi hàm gọi `httpClient.request()` với path tương ứng.

#### T2.2 — Server-side fetch (Next.js App Router)
- Vì admin web render server-side (RSC), các page admin nên gọi API trực tiếp qua BE base URL (không qua browser fetch).
- Pattern:
  ```ts
  // apps/web/src/app/admin/users/page.tsx
  const users = await listAdminUsers({ limit: 50 });
  ```
- Cần env `API_BASE_URL` (server-side, không `NEXT_PUBLIC_`).
- Set timeout 30s cho server fetch.

#### T2.3 — Update admin dashboard `MetricsBento` + `TelemetryMosaic`
Hiện tại (`apps/web/src/app/admin/dashboard/page.tsx`):
- Render 5 sections với mock components.
- Phase 2 chỉ wire **2 sections đầu** (MetricsBento + TelemetryMosaic) với data từ:
  - `GET /api/v1/internal/health/ready` cho status tổng quan.
  - `GET /api/v1/admin/service-requests?status=manual_escalation&limit=10` cho "needs attention".
- 3 sections còn lại (NeedsAttentionTable, BackgroundJobsTable) giữ mock ở Phase 2, wire ở Phase 3.

#### T2.4 — Tạo admin user list page (minimal)
- `apps/web/src/app/admin/users/page.tsx` — bảng đơn giản list users.
- Add nav link ở AdminLayout sidebar.
- Wire với `GET /api/v1/admin/users?limit=50`.

### Definition of Done — Phase 2
- [ ] `admin-api.ts` có typed functions cho ≥ 4 endpoints.
- [ ] Admin dashboard load được data thật (MetricsBento + TelemetryMosaic).
- [ ] Admin users page render list từ BE.
- [ ] BE dev server chạy (`pnpm.cmd run dev:api`) + test thủ công với Supabase mock data đã seed.
- [ ] Type-check + lint + build web pass.

---

## Phase 3 — Wire admin operations (read-mostly)

### Mục tiêu
Mở rộng wire cho:
- `NeedsAttentionTable` → `GET /api/v1/admin/operations/dispatch-stuck` + `payments-needs-review` + `service-requests?status=manual_escalation`.
- `BackgroundJobsTable` → `GET /api/v1/admin/operations/worker-runs` + `outbox-dead-letters`.
- Admin mechanic list/detail pages (từ `specs/003`).
- Admin service-request list/detail pages.

### Tasks

#### T3.1 — Wire `NeedsAttentionTable`
- Component hiện đang render mock — đổi sang server-side fetch + render rows từ 3 endpoint trên.
- Combine rows với tag loại (dispatch-stuck / payment-needs-review / manual-escalation).

#### T3.2 — Wire `BackgroundJobsTable`
- 2 source: `worker-runs` (recent runs) + `outbox-dead-letters` (failed events).
- Hiển thị status badge theo `status` enum.

#### T3.3 — Admin mechanics page
- `apps/web/src/app/admin/mechanics/page.tsx` — list + filter theo `status` (pending/approved/suspended/banned).
- Detail page `apps/web/src/app/admin/mechanics/[mechanicId]/page.tsx` — show profile, skills, service radius, work history.
- Mutations (approve/reject/suspend/ban/reactivate) để Phase 4.

#### T3.4 — Admin service-requests page
- `apps/web/src/app/admin/service-requests/page.tsx` — list + filter status.
- Detail page `apps/web/src/app/admin/service-requests/[requestId]/page.tsx` — show timeline, media, assignment, quotes.
- Cancel + manual-escalate + internal-note mutations để Phase 4.

### Definition of Done — Phase 3
- [ ] Tất cả 5 sections dashboard wired với data thật.
- [ ] Admin mechanics list + detail page render BE data.
- [ ] Admin service-requests list + detail page render BE data.
- [ ] Không vỡ các page non-admin (landing, dich-vu, ...).
- [ ] Build + typecheck + lint pass.

---

## Phase 4 — Wire admin mutations (with idempotency + reason)

### Mục tiêu
Wire các mutation endpoint từ `specs/003-careonroad-admin-operations`:
- `POST /api/v1/admin/mechanics/[mechanicId]/approve|reject|suspend|ban|reactivate`
- `POST /api/v1/admin/users/[userId]/grant-role|revoke-role`
- `POST /api/v1/admin/users/[userId]/devices/[deviceId]/revoke`
- `POST /api/v1/admin/service-requests/[requestId]/cancel`
- `POST /api/v1/admin/service-requests/[requestId]/manual-escalate`
- `POST /api/v1/admin/service-requests/[requestId]/internal-notes`

### Tasks

#### T4.1 — Tạo mutation client helpers
- `apps/web/src/lib/admin-api.ts` bổ sung các mutation functions.
- Mỗi mutation:
  - Tự generate `X-Idempotency-Key`.
  - Yêu cầu `reason` parameter (string) bắt buộc.
  - Trả `redacted` response từ BE (xem pattern của BE — không expose full payload).

#### T4.2 — Admin mechanics detail → action buttons
- 4 buttons: Approve / Reject / Suspend / Ban / Reactivate.
- Mỗi button mở modal nhập `reason` (textarea bắt buộc, ≥ 10 chars).
- Submit → call mutation → re-fetch detail page (revalidate).

#### T4.3 — Admin users detail → role + device actions
- Grant/revoke role modal.
- Device list với revoke button.

#### T4.4 — Admin service-request detail → actions
- Cancel button (với reason).
- Manual escalate button (với reason).
- Internal note form (textarea + submit).

#### T4.5 — Error handling cho mutations
- BE trả 409 CONFLICT nếu idempotency key trùng với request khác → hiển thị "Yêu cầu đã xử lý trước đó".
- BE trả 403 FORBIDDEN nếu actor không phải admin → hiển thị toast lỗi.
- Generic 5xx → retry button.

### Definition of Done — Phase 4
- [ ] Tất cả mutation endpoint có UI binding.
- [ ] Idempotency key auto-generated và verified bằng cách double-click test.
- [ ] Reason validation client-side (≥ 10 chars, không rỗng).
- [ ] Sau mutation thành công → page re-fetch tự động.
- [ ] E2E test thủ công với 1 actor admin (dùng Supabase seed account).

---

## Phase 5 — Auth + Polish + Verify

### Mục tiêu
Hoàn thiện admin web với auth thật + cuối cùng verify toàn bộ hệ thống.

### Tasks

#### T5.1 — Auth cho web
- Wire Supabase client ở `apps/web/src/lib/supabase.ts`.
- Login page `apps/web/src/app/login/page.tsx` — email/password.
- Session management qua cookie (server-side).
- AdminLayout kiểm tra role `admin` → redirect `/login` nếu thiếu.

#### T5.2 — Replace stub `auth-provider.ts`
- Implement `getAccessToken()` thật bằng Supabase session.

#### T5.3 — Verify toàn bộ
Theo AGENTS.md test expectations:
```cmd
pnpm.cmd install
pnpm.cmd run typecheck
pnpm.cmd run lint
pnpm.cmd test
pnpm.cmd run build
```
Cộng thêm:
- Manual smoke test admin dashboard + các mutation với Supabase seed data.
- Verify mobile không bị ảnh hưởng (xem phần cuối file).

#### T5.4 — Update AGENTS.md (optional)
- Thêm vào "API Routes" section mô tả ngắn về `@careonroad/api-contract` package.
- Thêm script `pnpm.cmd run contract:check` (verify schema đồng bộ giữa BE import và contract export — optional, có thể skip ở MVP).

### Definition of Done — Phase 5
- [ ] Auth flow hoàn chỉnh (login, logout, session).
- [ ] Admin page yêu cầu role admin (server-side check).
- [ ] Toàn bộ CI command pass.
- [ ] Mobile workspace **không bị đụng** (xác nhận `apps/mobile/pnpm-workspace.yaml` còn nguyên).

---

## Phạm vi ảnh hưởng tới Mobile

### Tại sao mobile không bị ảnh hưởng

**Cấu trúc workspace:**
- Root `pnpm-workspace.yaml`:
  ```yaml
  packages:
    - "apps/api"
    - "apps/web"
    - "packages/*"
  ```
- `apps/mobile/pnpm-workspace.yaml` riêng:
  ```yaml
  packages:
    - "."
  nodeLinker: hoisted
  ```

→ Mobile là một sub-project cô lập, không resolve được `@careonroad/api-contract` từ root workspace. Mọi thay đổi ở `packages/*` và `apps/api`/`apps/web` đều không ảnh hưởng mobile.

**Mobile không import workspace package:**
- `apps/mobile/package.json` không có dependency `@careonroad/*`.
- Mobile tự khai báo types hand-written trong 19 service wrappers (vd `apps/mobile/src/lib/service-requests-service.ts:30-49` cho `RequestStatus`, `apps/mobile/src/lib/payments-service.ts:16` cho `PaymentStatus`, `apps/mobile/src/lib/mechanic-jobs-service.ts:18` cho `AssignmentStatus`, `apps/mobile/src/lib/dispatch-service.ts:14` cho `DispatchCandidateStatus`).
- Mobile wire BE qua HTTP runtime (`apps/mobile/src/lib/api.ts`) với `EXPO_PUBLIC_API_BASE_URL` (xem `eas.json`).

### Phase 0 không thay đổi wire shape

Phase 0 chỉ **move file**, không đổi:
- Tên field, kiểu dữ liệu, enum value.
- HTTP status code trả về.
- Cấu trúc response wrapper.

→ Mobile runtime không thay đổi behavior. Nếu trước đó mobile gọi BE và parse JSON thành công, sau Phase 0 vẫn parse thành công.

### Drift đã có sẵn (chưa giải quyết trong plan này)

Đã phát hiện 3 điểm drift giữa mobile hand-written types và BE authoritative types — đây là rủi ro **tiềm ẩn từ trước**, không do plan này gây ra:

| Mobile type | Mobile values | BE values | Severity |
|---|---|---|---|
| `PaymentStatus` | `'pending' \| 'paid' \| 'canceled' \| 'failed' \| 'expired'` | `'created' \| 'pending' \| 'succeeded' \| 'failed' \| 'canceled' \| 'needs_review'` | High — mobile UI hiển thị sai khi BE trả `succeeded`/`created`/`needs_review` |
| `RequestStatus` | 11 states (vd có `manual_escalation`) | Authoritative ở `service-request.repository.ts` | Medium — có thể lệch nhẹ về tên |
| `AssignmentStatus` | Tự khai báo | Authoritative ở `assignment.repository.ts` | Medium — `nextAllowedStatuses` có thể cho phép transition sai |

**Khuếch nghị:** Phase phụ (Phase 6 — ngoài scope plan này) sẽ migrate mobile sang `@careonroad/api-contract`:
1. Gộp `apps/mobile` vào root workspace (xóa `apps/mobile/pnpm-workspace.yaml`, thêm `"apps/mobile"` vào root).
2. Thêm `"@careonroad/api-contract": "workspace:*"` vào `apps/mobile/package.json`.
3. Thay hand-written types bằng `import type` từ contract.
4. Fix 3 drift trên.
5. Verify Expo bundle (`pnpm.cmd --dir apps/mobile typecheck` + `eas build --profile development`).

**Không đưa vào plan này vì:**
- Tăng scope (mobile bundle khác web, cần Expo build verification).
- User đã chốt Phase scope là admin web + BE refactor.
- Drift không cấp bách (không do plan gây ra, đã có sẵn).

### Khi BE đổi wire shape trong tương lai

Mỗi lần BE thêm/xoá/sửa field hoặc rename enum → mobile sẽ **dễ bị lỗi runtime** vì mobile tự đồng bộ types. Đây là trạng thái **không xấu hơn hiện tại**, nhưng sẽ tệ dần nếu không migrate.

**Cách giảm thiểu tạm thời (không cần migrate):**
- Trong PR template BE, thêm checklist: "Đã thông báo team mobile nếu có breaking change wire shape?".
- BE thêm field mới (không breaking) → mobile dùng `?.` + optional chaining, không lỗi.
- BE xoá/đổi tên field (breaking) → mobile phải update trong cùng release.

### Mobile release readiness (note cho tương lai)

Hiện workspace đã có setup sẵn cho Play Store / App Store:
- `eas.json`: 4 profile (development/preview/staging/production) với `autoIncrement`.
- `app.config.ts`: dynamic bundle id + permissions (Camera, Location, Photo Library) + splash + adaptiveIcon.
- Build script: `pnpm.cmd build:mobile` → `expo export --platform android --output-dir dist`.

**Còn thiếu khi ready release thật:**
- Keystore signing (EAS tự generate được).
- Google Play Console + Apple Developer Program.
- App metadata + privacy policy URL + Data Safety/App Privacy forms.
- `google-services.json` nếu dùng FCM push (theo AGENTS.md có FCM env vars).

---

## Risk & Open Questions

### Risk
- **R1 (Medium):** Phase 0 là "move file" nhưng số lượng file lớn (~20 schemas). Có thể miss 1 file → BE build fail. Mitigation: chạy typecheck ngay sau mỗi file move.
- **R2 (Low):** Mobile drift đã có nhưng không fix trong plan này. Có thể mobile payment flow bị lỗi runtime khi test. Mitigation: tách Phase 6 (mobile migration) làm ngay sau Phase 5.
- **R3 (Low):** Web auth implementation có thể phức tạp hơn dự kiến vì Next.js 16.3 + React 19 RSC + cookie session. Mitigation: Phase 5 dành buffer 1-2 ngày.

### Open Questions
- **Q1:** Supabase publishable key có cần thêm vào web `.env.local` không? (Cần verify trước Phase 5.)
- **Q2:** Admin có cần 2FA không? (AGENTS.md không đề cập → assume không, Phase 5 chỉ email/password.)
- **Q3:** `INTERNAL_WORKER_SECRET` có cần cho admin web không? (Có thể không, vì admin web không gọi worker routes — chỉ BE gọi từ cron. Verify lại.)

---

## Files chính sẽ tạo / sửa

### Tạo mới
- `packages/api-contract/package.json`
- `packages/api-contract/tsconfig.json`
- `packages/api-contract/src/index.ts`
- `packages/api-contract/src/<feature>.ts` × ~20 file
- `apps/web/src/lib/http-client.ts`
- `apps/web/src/lib/auth-provider.ts` (stub → thật)
- `apps/web/src/lib/admin-api.ts`
- `apps/web/src/lib/supabase.ts` (Phase 5)
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/mechanics/page.tsx`
- `apps/web/src/app/admin/mechanics/[mechanicId]/page.tsx`
- `apps/web/src/app/admin/service-requests/page.tsx`
- `apps/web/src/app/admin/service-requests/[requestId]/page.tsx`
- `apps/web/src/app/login/page.tsx` (Phase 5)

### Sửa
- `apps/api/src/features/<feature>/*.ts` — đổi imports sang `@careonroad/api-contract` (Phase 0).
- `apps/api/src/features/<feature>/<feature>.schemas.ts` — **xóa** sau khi BE đã import từ contract (Phase 0).
- `apps/web/src/lib/api-client.ts` — thêm switch mock/live (Phase 1).
- `apps/web/src/components/admin/metrics-bento.tsx` — wire data (Phase 2).
- `apps/web/src/components/admin/telemetry-mosaic.tsx` — wire data (Phase 2).
- `apps/web/src/components/admin/needs-attention-table.tsx` — wire data (Phase 3).
- `apps/web/src/components/admin/background-jobs-table.tsx` — wire data (Phase 3).
- `apps/web/src/components/admin/admin-layout.tsx` — auth gate (Phase 5).

### Xóa
- `apps/api/src/features/<feature>/<feature>.schemas.ts` × ~20 file (sau khi BE đã import xong).

---

## Out of Scope (không làm trong plan này)

- Mobile migrate sang `@careonroad/api-contract` (Phase 6 tương lai).
- Mobile release lên Play Store / App Store (chỉ note readiness).
- Refactor non-admin web pages (landing, dich-vu, ...) — giữ mock-data.
- Payment/settlement/invoice UI ở web (theo AGENTS.md: không trong scope).
- Mechanic web view (chỉ có admin view trong plan này).
- Frontend maps/live-tracking UI (theo AGENTS.md).
- New API endpoint nào — chỉ wire những gì đã có từ `specs/003-careonroad-admin-operations` và `specs/016-operational-monitoring`.
