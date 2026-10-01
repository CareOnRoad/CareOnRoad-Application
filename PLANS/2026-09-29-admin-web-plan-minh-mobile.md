# Admin Web — Kế hoạch triển khai (đã verify trên `minh/mobile`)

**Ngày:** 2026-09-29
**Branch chuẩn:** `minh/mobile` (đã xác nhận với người phụ trách)
**Thay thế:** `PLANS/FE-BE-CONTRACT-ADMIN-WEB-REVIEW-AND-AI-IMPLEMENTATION-GUIDE.md` (viết trên `main` — sai baseline)
**Phạm vi:** contract admin-only → auth → server API client → read-only UI → mutation
**Ngoài scope:** mobile, chatbot, payment UI, live tracking UI, route ETA UI

---

## 0. Tại sao tài liệu cũ bị thay thế

Tài liệu guide cũ phân tích 3 file plans của FE trên branch `main`. Nhưng `main` **không phải CareOnRoad monorepo**:

| | `main` (b762dc4, 19/07/2026) | `minh/mobile` (78f98c9, 26/09/2026) |
|---|---|---|
| Root `package.json` name | `my-project` | `careonroad-application` |
| Monorepo | Không (npm, `package-lock.json`) | pnpm workspace |
| `apps/api` | Không có | 559 file, 111 route, 32 migrations |
| `apps/web/src/components/admin/*` | Không có | 6 component |
| Mobile service layer | Không có | 19 file service |

Guide cũ đúng ở **contract shape** (`error_code`, `{items,page}`, route path, mechanic status) và ở **kiến trúc** (auth-first, server-only client, read-before-write). Sai ở **baseline** → dẫn tới kết luận "web là greenfield" khi thực tế đã có UI admin.

Phần **giữ nguyên** từ guide cũ: mục 4.6, 4.7, 4.8, 4.10, 4.11, 5 (R03, R06, R07, R08, R09, R10, R11, R12, R13, R16, R17), 8, 11.

Phần **viết lại**: baseline, port, phase order, file list, gate.

---

## 1. Baseline đã verify (nguồn sự thật)

### 1.1 Backend

- 111 route files tại `apps/api/app/api/**`, admin gồm 39 file.
- Error body: `apps/api/src/lib/api-error.ts:30-34` → `{ error_code, message, request_id?, details? }`.
- Cursor page: `admin-mechanic-management.service.ts:74-78` → `{ items, page: { limit, has_more, next_cursor? } }`.
- Mechanic status: `admin.schemas.ts:81-87` → `pending | active | rejected | suspended | banned` (không có `approved`).
- Admin reason: `admin.schemas.ts:7-21` → trim, min 10, max 500.
- Auth actor: `auth.types.ts` → `{ id, display_name?, roles[], status }`.
- `RequestActor` bootstrap: `auth.service.ts:44-96`.
- Zod `^3.24.0`, TypeScript `^5.6.0`.
- Dev script: `next dev -H 0.0.0.0` (port 3000).

### 1.2 Web (đã có, không phải skeleton)

| Path | Trạng thái |
|---|---|
| `src/app/layout.tsx` | Đọc `x-pathname`, ẩn Header/Footer khi chứa `/admin` |
| `src/proxy.ts` | Set `x-pathname` request header; matcher loại `_next/static`, `_next/image`, `favicon.ico` |
| `src/app/admin/layout.tsx` | Wrapper tối giản, không render Header/Footer |
| `src/app/admin/dashboard/page.tsx` | Render 5 section static |
| `src/components/admin/*` | 6 file: admin-layout, welcome-header, metrics-bento, telemetry-mosaic, needs-attention-table, background-jobs-table |
| `src/lib/api-client.ts` | **Mock-only**, 10 method trả `@/lib/mock-data`, không có HTTP |
| `src/lib/mock-data.ts` | Dữ liệu tĩnh cho marketing |
| `src/app/dang-nhap/`, `dang-ky/`, `quen-mat-khau/` | UI-only, submit no-op (dirty, chưa commit) |

**Rủi ro hiện tại:** `/admin/dashboard` render dữ liệu giả **không có auth gate**. Ai truy cập URL cũng thấy. Đây là lý do auth phải làm trước data.

### 1.3 Contract package

`packages/api-contract/package.json` chỉ có `name`/`version`/`private`. Không có source, không exports, không dependency.

**Ghi chú (đã hiệu chỉnh sau review):** `admin.schemas.ts:1-3` import `@/features/auth/auth.types` và `@/features/motorcycles/motorcycle.schemas`. Đây **không phải blocker** — cả hai chỉ là mảng literal `as const`, không có DB call / `process.env` / repository type. Portable bằng cách đặt ở contract package và cho BE import ngược lại (xem 3.5).

### 1.4 Port

| App | Port | Lý do |
|---|---|---|
| `apps/api` | 3000 | Giữ nguyên — mobile `.env` trỏ `localhost:3000`, `start:lan` detect IP |
| `apps/web` | 3100 | Chỉ web đổi, không consumer nào phụ thuộc |
| Mobile | n/a | Không sửa gì |

Port chỉ ảnh hưởng lúc dev. Khi publish, `APP_VARIANT=production` → `https://api.careonroad.example` (`config.ts:35-41`).

---

## 2. Kiến trúc đích

```text
Browser
  │ Supabase cookie session
  ▼
Next.js Admin Web :3100
  ├─ Server Components: reads
  ├─ Server Actions: mutations
  ├─ src/proxy.ts: x-pathname (giữ) + Supabase refresh (thêm)
  └─ server-only apiFetch: Bearer + Zod parse
      ▼
Next.js API :3000
  ├─ Supabase JWT verification
  ├─ GET /api/v1/auth/me
  └─ /api/v1/admin/**
```

Bất biến:

- Browser không gọi API trực tiếp.
- Token không vào Client Component props, localStorage, log.
- Web không có `SUPABASE_SERVICE_ROLE_KEY` / `INTERNAL_WORKER_SECRET`.
- Backend quyết định authorization; layout guard chỉ là UX.
- Response parse bằng Zod trước khi render.
- Không sửa `apps/mobile`.

---

## 3. Phase A — Contract admin-only

**Owner:** người có quyền sửa cross-package.

**Mục tiêu thật của Phase A:** hợp nhất 3 nguồn định nghĩa enum thành 1, không chỉ "di chuyển file". Xem 3.5.

### File

```text
packages/api-contract/
  package.json
  tsconfig.json
  src/
    common.ts            # ApiErrorBody, CursorPage
    auth.ts              # RequestActor
    admin-users.ts
    admin-mechanics.ts
    admin-service-requests.ts
    admin-operations.ts
    health.ts
```

Không tạo `src/index.ts` barrel. Không codegen.

### package.json

```json
{
  "name": "@careonroad/api-contract",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": { "typecheck": "tsc --noEmit" },
  "exports": {
    "./common": "./src/common.ts",
    "./auth": "./src/auth.ts",
    "./admin/users": "./src/admin-users.ts",
    "./admin/mechanics": "./src/admin-mechanics.ts",
    "./admin/service-requests": "./src/admin-service-requests.ts",
    "./admin/operations": "./src/admin-operations.ts",
    "./health": "./src/health.ts"
  },
  "dependencies": { "zod": "^3.24.0" },
  "devDependencies": { "typescript": "^5.6.0" }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

Không `composite`, không `declaration`, không `outDir` (source-consumed).

### common.ts

```ts
import { z } from "zod";

export const apiErrorCodeSchema = z.enum([
  "INVALID_INPUT", "INVALID_TOKEN", "ACTOR_SUSPENDED", "UNAUTHORIZED",
  "FORBIDDEN", "NOT_FOUND", "CONFLICT", "RATE_LIMITED", "INTERNAL_ERROR",
  "DATABASE_CONFLICT", "DATABASE_CONSTRAINT_VIOLATION",
  "DATABASE_UNAVAILABLE", "DATABASE_ERROR", "PROVIDER_ERROR"
]);

export const apiErrorBodySchema = z.object({
  error_code: apiErrorCodeSchema,
  message: z.string(),
  request_id: z.string().optional(),
  details: z.unknown().optional()
});

export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

export const pageMetaSchema = z.object({
  limit: z.number().int().positive(),
  has_more: z.boolean(),
  next_cursor: z.string().optional()
});

export const cursorPageSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ items: z.array(item), page: pageMetaSchema });
```

### auth.ts

```ts
import { z } from "zod";

import { userRoles, userStatuses } from "./enums";

export const requestActorSchema = z.object({
  id: z.string(),
  display_name: z.string().optional(),
  roles: z.array(z.enum(userRoles)),
  status: z.enum(userStatuses)
});
```

### enums.ts (nguồn enum duy nhất)

Gom 3 tập giá trị đang định nghĩa rải rác:

```ts
export const userRoles = ["rider", "mechanic", "admin"] as const;
export const userStatuses = ["active", "suspended", "archived"] as const;
export const serviceTypes = [
  "emergency_rescue",
  "mobile_repair",
  "at_home_service",
  "periodic_maintenance",
  "other"
] as const;
```

Các schema khác dùng `z.enum(userRoles)` / `z.enum(serviceTypes)` thay vì viết literal lần nữa.

### Quy tắc response schema

Với mỗi endpoint admin:
1. Đọc return type từ service thật.
2. Viết Zod response schema trong package.
3. FE parse bằng cùng schema.
4. Không `z.any()`. Chỉ `z.unknown()` cho `details`.

### 3.5 Hợp nhất enum — phần quan trọng nhất của Phase A

Hiện có **3 nguồn** cho cùng một tập giá trị:

| Tập giá trị | TS hiện tại | DB enum |
|---|---|---|
| role | `auth.types.ts:3` | `202606250004:1` `app_role` |
| status | `auth.types.ts:4` | `202606250004:2` `user_status` |
| service_type | `motorcycle.schemas.ts:3-8` | `202606250006:3-8` `service_type` |
| mechanic profile status | `admin.schemas.ts:81-87` | *(không có)* |

Không có cơ chế bảo đảm TS khớp DB. Lệch enum là lỗi im lặng — DB reject ở runtime, không fail lúc build.

**Việc phải làm:**

1. Contract package thành **nguồn duy nhất** cho 3 tập đầu.
2. `apps/api/src/features/auth/auth.types.ts` → `export { userRoles, userStatuses } from "@careonroad/api-contract/common"` (hoặc `/enums`), giữ `type` alias để không phá 30+ chỗ import.
3. `motorcycle.schemas.ts` → tương tự cho `serviceTypes`.
4. `admin.schemas.ts` → import `userRoles`, `userStatuses`, `serviceTypes` từ contract, xoá import `@/...`.
5. **Không** thêm DB constraint mới. `adminMechanicProfileStatuses` là business rule TS-only — giữ nguyên semantics.

**Test chống lệch:** `packages/api-contract/src/__tests__/enum-parity.test.ts`

- So `userRoles`/`userStatuses` với `create type app_role` / `user_status` trong `202606250004`.
- So `serviceTypes` với `create type service_type` trong `202606250006`.
- Parse file migration bằng regex, không cần DB.
- Chạy bằng Vitest, thuộc `pnpm.cmd run test:unit` hoặc script riêng của package.

**Contract là source of truth:** nếu sửa enum, sửa ở contract package. BE import, không định nghĩa lại. Hai nơi cùng định nghĩa = bug quay lại.

### Gate A

- [ ] `pnpm.cmd --filter @careonroad/api-contract typecheck` pass
- [ ] Không import từ `apps/api` trong package
- [ ] Không `node:*`, `process.env`, `Buffer`, Next type, repository type
- [ ] Không root barrel
- [ ] `pnpm.cmd run typecheck`, `pnpm.cmd test`, `pnpm.cmd run build:api` pass
- [ ] Thêm `"@careonroad/api-contract": "workspace:*"` vào `apps/api/package.json` và `apps/web/package.json` → `pnpm.cmd install`
- [ ] Enum parity test pass
- [ ] `auth.types.ts` và `motorcycle.schemas.ts` không còn literal `as const` cho role/status/service_type
- [ ] `admin.schemas.ts` import enum từ `@careonroad/api-contract/enums`, không import từ `@/features/**`

**Lưu ý:** literal `"rider"` / `"mechanic"` vẫn còn ở nhiều test fixture và type guard cục bộ (vd `assignment.service.ts:327-329`, `quote.service.ts:208-210`). Đó là **có chủ ý** — chúng là dữ liệu đầu vào của test và type predicate, không phải định nghĩa enum. Refactor chúng sang contract là việc riêng, không thuộc Phase A.

---

## 4. Phase B — Web port + env + scripts

### package.json web

```json
{
  "scripts": {
    "dev": "next dev -p 3100",
    "typecheck": "tsc --noEmit"
  }
}
```

### apps/web/.env.example

```dotenv
API_BASE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Không thêm: `SUPABASE_SERVICE_ROLE_KEY`, `INTERNAL_WORKER_SECRET`, `DATABASE_URL`, `PAYOS_*`, `OPENROUTER_*`, `GEMINI_*`.

### Gate B

- [ ] `pnpm.cmd install` (web không cần dependency mới ở phase này)
- [ ] `pnpm.cmd run lint:web`, `pnpm.cmd run build:web` pass
- [ ] `rg "SERVICE_ROLE|WORKER_SECRET" apps/web` → rỗng

---

## 5. Phase C — Auth

**Dependency: ĐÃ DUYỆT** — cài `@supabase/supabase-js` + `@supabase/ssr` vào `apps/web`.

```bash
pnpm.cmd --filter @careonroad/web add @supabase/supabase-js @supabase/ssr
```

Chỉ cài trong `apps/web`, không cài ở root.

### 5.0 Prerequisite — Tạo admin account (BLOCKER)

Chưa có tài khoản `role=admin`, `status=active`. Phase C không test được nếu chưa có.

**Bằng chứng schema:**

- `202606250004_identity_and_roles.sql:12-16` → bảng `user_roles (user_id, role)`, `role` là enum `app_role`.
- `auth.types.ts:3-4` → `userRoles = ["rider","mechanic","admin"]`, `userStatuses = ["active","suspended","archived"]`.
- `202606250014_indexes_constraints_rls.sql:168-171` → policy `user_roles_self_select` chỉ cho `user_id = auth.uid()`.
- `202606250004:24-35` → `revoke all on app_users, user_roles from anon, authenticated`.

**Kết luận:** không có đường nào cho user tự tạo role admin. `auth.service.ts:59-66` chỉ `addRole(subject, "rider")` khi bootstrap. Cần tạo qua SQL/dashboard với service role.

**Cách tạo (chọn 1):**

| Cách | Lệnh | Ghi chú |
|---|---|---|
| A. Dashboard SQL Editor | `insert into app_users (id, display_name, status) values ('<auth-user-uuid>','Admin','active') on conflict (id) do nothing;`<br>`insert into user_roles (user_id, role) values ('<auth-user-uuid>','admin') on conflict do nothing;` | Nhanh, không cần code |
| B. Seed script mở rộng | Thêm admin vào `apps/api/scripts/seed-mock-data.mjs` | Lặp lại được, nhưng sửa BE |

**Ưu tiên A** cho lần đầu. Chỉ chọn B nếu cần admin account tự động cho môi trường khác.

**Thứ tự thao tác:**

1. Supabase Dashboard → Authentication → Users → **Add user** (email + password, hoặc auto-confirm).
2. Copy user UUID.
3. SQL Editor → chạy 2 câu `insert` ở trên.
4. Verify: `GET /api/v1/auth/me` với JWT của user đó → `roles` chứa `"admin"`, `status = "active"`.

**Không commit UUID hay email admin thật vào git.** Nếu cần tài liệu hoá, chỉ ghi placeholder.

**Lưu ý:** Q3 đã giải quyết — "Confirm email" đã tắt, nên khi tạo admin account không cần bước confirm email. Nếu bật lại sau này, admin login sẽ cần email đã confirm.

### File

```text
apps/web/src/lib/supabase/client.ts     # browser client
apps/web/src/lib/supabase/server.ts     # cookies() client
apps/web/src/lib/auth/require-admin.ts  # gate
apps/web/src/app/admin/login/page.tsx   # trang login admin riêng
apps/web/src/app/admin/login/actions.ts # server action
apps/web/src/app/admin/layout.tsx       # SỬA: thêm guard
```

### Về `src/proxy.ts` — phải merge, không tạo mới

File đã tồn tại và root layout phụ thuộc vào nó. **Không thay matcher.**

```ts
export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

Thêm Supabase session refresh **bên trong** function này, giữ nguyên `x-pathname` và matcher.

### Login admin tại `/admin/login`

Tách khỏi `/dang-nhap` marketing để không ảnh hưởng rider/mechanic. Không dùng `(admin-auth)` group vì `admin/layout.tsx` đã bọc guard.

**Lý do chọn `/admin/login` (trả lời câu hỏi đầu phiên):**
- `admin/layout.tsx` hiện trả `<div className="min-h-screen w-full">{children}</div>` — không render AdminLayout. Nên `/admin/login` sẽ **không** có sidebar.
- URL giữ nguyên trong admin namespace, không chạm `/dang-nhap`.
- Tương lai thêm `/admin/reset-password` cùng nhánh được.

Nếu sau này AdminLayout muốn render ở login thì mới tách group.

### require-admin.ts

1. Supabase server client → `getUser()`.
2. Không có user → `redirect("/admin/login")`.
3. `apiGet("/api/v1/auth/me")` với Bearer token.
4. `!actor.roles.includes("admin") || actor.status !== "active"` → trang 403 hoặc sign out.
5. Trả `{ actor, accessToken }` chỉ cho server caller.

Không tin cookie metadata. Không log token.

### Login action

- Validate email/password.
- `supabase.auth.signInWithPassword`.
- Message lỗi không phân biệt "email tồn tại" / "sai mật khẩu".
- Chỉ `redirect("/admin")` **sau khi** guard pass.
- Nếu không phải admin → sign out, không render admin shell.

### Gate C

**Trước khi chạy gate:** phải có admin account theo mục 5.0. Không có → gate fail ở case 4.

| Case | Kỳ vọng |
|---|---|
| Chưa login → `/admin/dashboard` | redirect `/admin/login` |
| Rider đăng nhập | 403, không thấy admin data |
| Admin `suspended` | bị chặn |
| Admin `active` | vào dashboard |
| Logout | cookie xoá, `/admin` chặn |
| `/dang-nhap` | không ảnh hưởng |
| `/admin/login` | không có sidebar |

## 5.x Về lỗi "Lỗi không xác định" ở mobile — ĐÃ GIẢI QUYẾT

**Nguyên nhân gốc:** Supabase bật "Confirm email". Khi bật, `signUp` không trả session cho tài khoản mới, nên `data.session` là `null`. Code mobile ném lỗi chung:

```ts
if (error || !data.session) {
  throw mapSupabaseError(error);  // error = null → "Lỗi không xác định"
}
```

Khi Confirm email bật, Supabase trả `error = null` nhưng `data.session = null` → `mapSupabaseError(null)` rơi vào fallback `'Lỗi không xác định'`. Đây là hành vi **đúng** của code, chỉ là message không sắc ý.

**Cách xử lý:** tắt "Confirm email" trong Supabase Dashboard → Authentication → Providers → Email. **Đã thực hiện.**

**Kết quả:** không còn lỗi "Lỗi không xác định" khi đăng ký, và không còn link confirm 404 trong email (vì không còn gửi email xác nhận nữa).

**Không cần sửa code mobile.** Điểm 5.x chỉ là ghi nhận context, không phải task.

---

## 6. Phase D — Server-only API client

```text
apps/web/src/lib/api/server-client.ts
apps/web/src/lib/api/admin.ts
```

`import "server-only";` ở đầu module giữ token.

```ts
type ApiRequestOptions<T> = {
  accessToken: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  idempotencyKey?: string;
  schema: z.ZodType<T>;
  timeoutMs?: number;
};

export async function apiFetch<T>(path: string, options: ApiRequestOptions<T>): Promise<T>;
```

Yêu cầu:

- Base URL từ `API_BASE_URL`.
- `Authorization: Bearer <token>`.
- `cache: "no-store"`.
- Timeout qua `AbortController`, cleanup trong `finally`.
- Parse success bằng schema.
- Non-2xx → parse `ApiErrorBody`, giữ `status`, `error_code`, `request_id`.
- Không log token/body.

```ts
export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
    readonly details?: unknown
  ) { super(message); }
}
```

### Error UX

| Status/code | UX |
|---|---|
| 400 / `INVALID_INPUT` | lỗi form |
| 401 | → login, không retry loop |
| 403 | trang không đủ quyền |
| 404 | not-found state |
| 409 | conflict, **không** sinh intent mới |
| 429 | thử lại sau, tôn trọng header |
| 5xx / timeout | error state + nút retry (mutation giữ cùng key) |
| Schema invalid | contract mismatch, không render partial |

### Gate D

- [ ] Token không xuất hiện trong browser bundle
- [ ] 1 GET thật parse thành công
- [ ] 401/403/409/schema-invalid có nhánh riêng
- [ ] Timeout cleanup trong `finally`

---

## 7. Phase E — Admin route adapter (allowlist)

Chỉ tạo function cho màn hình sắp làm. Đường dẫn đã verify từ route files.

### Users

| Method | Path |
|---|---|
| GET | `/api/v1/admin/users` |
| GET | `/api/v1/admin/users/{userId}` |
| GET | `/api/v1/admin/users/{userId}/devices` |
| GET | `/api/v1/admin/users/{userId}/activity` |
| POST | `/api/v1/admin/users/{userId}/suspend` |
| POST | `/api/v1/admin/users/{userId}/reactivate` |
| POST | `/api/v1/admin/users/{userId}/archive` |
| POST | `/api/v1/admin/users/{userId}/roles/grant` |
| POST | `/api/v1/admin/users/{userId}/roles/revoke` |
| POST | `/api/v1/admin/devices/{deviceId}/revoke` |

### Mechanics

| Method | Path |
|---|---|
| GET | `/api/v1/admin/mechanics` |
| GET | `/api/v1/admin/mechanics/{mechanicId}` |
| GET | `/api/v1/admin/mechanics/{mechanicId}/work-history` |
| GET | `/api/v1/admin/mechanics/{mechanicId}/performance` |
| POST | `.../approve`, `.../reject`, `.../suspend`, `.../ban`, `.../reactivate` |
| POST | `/api/v1/admin/mechanics/{mechanicId}/force-unavailable` |
| PUT | `/api/v1/admin/mechanics/{mechanicId}/skills` |
| PUT | `/api/v1/admin/mechanics/{mechanicId}/service-radius` |

### Service requests

| Method | Path |
|---|---|
| GET | `/api/v1/admin/service-requests` |
| GET | `/api/v1/admin/service-requests/{requestId}` |
| GET | `.../timeline`, `.../media`, `.../assignment`, `.../quotes` |
| POST | `.../cancel`, `.../manual-escalate`, `.../notes` |

### Operations + health

| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/admin/operations/outbox-dead-letters` | Admin JWT |
| GET | `/api/v1/admin/operations/payments-needs-review` | Admin JWT |
| GET | `/api/v1/admin/operations/dispatch-stuck` | Admin JWT |
| GET | `/api/v1/admin/operations/worker-runs` | Admin JWT |
| GET | `/api/v1/internal/health/live` | Public |
| GET | `/api/v1/internal/health/ready` | Public |

Không gọi `/api/v1/internal/workers/**` từ web.

Query dùng `URLSearchParams`, bỏ field undefined/empty. Filter mechanic dùng `profile_status=active`, không dùng `approved`.

---

## 8. Phase F — Read-only UI

### Route

```text
apps/web/src/app/
  admin/
    login/page.tsx        # Phase C
    actions.ts
    layout.tsx            # guard
    dashboard/page.tsx
    users/page.tsx
    users/[userId]/page.tsx
    mechanics/page.tsx
    mechanics/[mechanicId]/page.tsx
    service-requests/page.tsx
    service-requests/[requestId]/page.tsx
    operations/page.tsx
```

### Nguyên tắc

- Page/layout mặc định Server Component.
- Filter dùng URL search params + form GET, không global state.
- Chỉ modal/confirm/toast là Client Component.
- Không thêm React Query/SWR.
- Tách display label khỏi API value (`active` → "Đã duyệt").

### Dashboard

Giữ 5 section hiện có nhưng thay nguồn data:

| Section | Nguồn thật |
|---|---|
| WelcomeHeader | actor từ guard |
| MetricsBento | count từ list endpoints, **không** dùng readiness làm business metric |
| TelemetryMosaic | `operations/*` counts |
| NeedsAttentionTable | `dispatch-stuck` + `payments-needs-review` + `service-requests?status=manual_escalation` |
| BackgroundJobsTable | `worker-runs` + `outbox-dead-letters` |

Không tải toàn bộ list chỉ để đếm. Nếu endpoint không trả count, hiển thị link thay vì số giả.

### List page

- Filter theo query backend thật.
- Semantic table (`table`/`thead`/`th`/`tbody`).
- Empty state, controlled error state.
- Cursor: `page.has_more` + `page.next_cursor`.
- Status label map tách khỏi API value.

### Detail page

- Fetch resource chính server-side.
- Tab phụ chỉ fetch khi mở.
- 404 → `notFound()`.

### Accessibility

- Mọi input có label.
- Nút icon có accessible name.
- Không chỉ dùng màu để truyền status.
- Loading/error text đọc được bằng screen reader.

---

## 9. Phase G — Mutation + idempotency

Chỉ bắt đầu sau khi read-only pass.

1. User mở dialog cho action cụ thể.
2. Tạo **một** UUID cho intent đó.
3. UUID nằm trong hidden field / server-side state.
4. User nhập reason.
5. Server Action validate bằng contract schema.
6. Gọi backend với `X-Idempotency-Key` = UUID trên.
7. Timeout/network error → retry **cùng key**.
8. Thành công → `revalidatePath` đúng list/detail.
9. Đóng dialog, bắt đầu intent mới → key mới.

Không sinh key trong `apiFetch` cho mỗi HTTP attempt.

### Validation

- Reason: trim, 10–500 ký tự (`admin.schemas.ts:7-21`).
- Đọc schema hiện tại trước khi hardcode limit cho từng endpoint.
- 409 → message từ controlled error, không retry key mới.

### Revalidation

Chỉ revalidate path bị ảnh hưởng. Không `revalidatePath("/", "layout")`.

---

## 10. Verification

```powershell
pnpm.cmd --filter @careonroad/api-contract typecheck
pnpm.cmd run typecheck
pnpm.cmd test
pnpm.cmd run build:api
pnpm.cmd --filter @careonroad/web typecheck
pnpm.cmd run lint:web
pnpm.cmd run build:web
```

Không chạy mobile build (không sửa mobile).

### Manual smoke

1. API ở 3000, web ở 3100.
2. `/admin/dashboard` khi chưa login → redirect `/admin/login`.
3. Rider login → bị chặn.
4. Admin `active` → vào dashboard.
5. Mỗi list; filter; next cursor.
6. Detail user/mechanic/request.
7. 1 mutation hợp lệ.
8. Double-click / retry cùng intent → không nhân đôi side effect.
9. Reason invalid → 400 hiển thị đúng.
10. Actor mất role / `suspended` → 403/redirect.
11. Tắt API → error state, web không crash.
12. Kiểm tra rendered HTML không có service-role key, worker secret, access token.

---

## 11. Thứ tự PR

1. **PR 1 — Contract admin-only.** Package, backend import, contract test. Không UI.
2. **PR 2 — Auth + server client.** Port, env, Supabase SSR, guard, error handling.
3. **PR 3 — Read-only admin.** Users, mechanics, requests, operations, health badge.
4. **PR 4 — Mutations.** Reason form, idempotency, revalidation, conflict UX.

Không bắt đầu checkpoint sau khi checkpoint trước đang đỏ.

---

## 12. Cố ý không làm

- Không extract contract cho mọi feature.
- Không generate client từ OpenAPI.
- Không tạo SDK class/factory/interceptor.
- Không React Query/SWR/global state.
- Không dashboard metrics giả.
- Không gọi worker routes từ web.
- Không route ETA / live tracking / payment UI.
- Không merge mobile vào root workspace.
- Không sửa `apps/mobile` (kể cả `.env`).
- Không thêm 2FA.
- Không nâng Zod major.
- Không sửa `src/proxy.ts` matcher.
- Không nâng API lên 3001 (phá mobile dev).
- Không thêm route tạo user admin trong backend (tạo account là thao tác vận hành, không phải API).
- Không sửa `apps/mobile` (bao gồm bug `mapSupabaseError` khi `data.session` null).

---

## 13. Open Questions

| # | Câu hỏi | Trạng thái |
|---|---|---|
| Q1 | Cho phép cài `@supabase/supabase-js` + `@supabase/ssr` vào `apps/web`? | **Đã duyệt** |
| Q2 | Có admin test account (`role=admin`, `status=active`)? | **Chưa có** → tạo theo mục 5.0 trước Phase C |
| Q3 | Supabase có bật "Confirm email"? | **Đã giải quyết** — đã tắt, không còn ràng buộc confirm |
| Q4 | 2FA cho admin? | Không trong scope |
| Q5 | `INTERNAL_WORKER_SECRET` cần cho web không? | Không — operations dùng admin JWT |
| Q6 | `/admin/login` có cần tách route group `(admin-auth)` nếu sau này muốn AdminLayout ở login? | Chưa cần |
| Q7 | Tài khoản admin dùng email nào, có commit vào `.env.example` không? | Không commit email thật |
| Q8 | Có nên thêm admin vào `seed-mock-data.mjs` để tái lập môi trường? | Chỉ khi cần nhiều env |

---

## 14. Nguồn đã verify

**Backend**
- `apps/api/src/lib/api-error.ts`
- `apps/api/src/features/auth/auth.types.ts`, `auth.service.ts`, `auth.route-handlers.ts`
- `apps/api/src/features/admin/admin.schemas.ts`
- `apps/api/src/features/admin/admin-user-management.service.ts`
- `apps/api/src/features/admin/admin-mechanic-management.service.ts`
- `apps/api/src/features/admin/admin-service-request.service.ts`
- `apps/api/app/api/v1/admin/**/route.ts` (39 file)
- `apps/api/app/api/v1/internal/health/**/route.ts`
- `specs/003-careonroad-admin-operations/contracts/admin-api.yaml`

**Web**
- `apps/web/src/app/layout.tsx`, `src/proxy.ts`
- `apps/web/src/app/admin/layout.tsx`, `src/app/admin/dashboard/page.tsx`
- `apps/web/src/components/admin/*` (6 file)
- `apps/web/src/lib/api-client.ts`, `src/lib/mock-data.ts`
- `apps/web/src/components/sections/login-section.tsx`
- `apps/web/package.json`, `apps/web/next.config.ts`, `apps/web/tsconfig.json`
- `apps/web/public/` (chỉ asset Next.js mặc định)

**Workspace**
- `pnpm-workspace.yaml`, `package.json` (root), `packages/api-contract/package.json`
- `apps/mobile/src/lib/config.ts`, `apps/mobile/README.md`, `apps/mobile/pnpm-workspace.yaml`

**Git**
- `main` = b762dc4 (19/07/2026), `my-project`, npm single app
- `minh/mobile` = 78f98c9 (26/09/2026), pnpm monorepo
