# CareOnRoad Admin Web — AI Coding Implementation Solution

## 1. Cách dùng tài liệu này

AI được giao code phải đọc toàn bộ file này trước khi sửa code. Thực hiện tuần tự theo phase; không làm phase sau nếu gate của phase trước chưa đạt.

Tài liệu này là solution triển khai. Phần lý do và audit đầy đủ nằm trong `FE-BE-CONTRACT-ADMIN-WEB-REVIEW-AND-AI-IMPLEMENTATION-GUIDE.md`.

Các từ khóa:

- **MUST:** bắt buộc.
- **MUST NOT:** cấm.
- **SHOULD:** mặc định làm; chỉ đổi khi có bằng chứng code yêu cầu.
- **STOP:** dừng và báo người phụ trách, không tự suy đoán.

## 2. Kết quả cuối cần đạt

Hoàn thiện Admin Web sử dụng backend thật với:

1. Supabase SSR login/logout và refresh session.
2. Backend `/api/v1/auth/me` xác nhận actor là admin active.
3. Shared contract chỉ chứa HTTP contract cần cho Admin Web.
4. Server-only API client, không đưa access token vào browser bundle.
5. Admin dashboard reuse giao diện đang có trên `minh/mobile`.
6. Trang users, mechanics, service requests và operations.
7. Admin mutations có reason validation, idempotency và controlled errors.
8. Typecheck, lint, build và API tests pass.

## 3. Phạm vi không được mở rộng

MUST NOT triển khai trong task này:

- payment UI;
- settlement, payout, invoice, refund hoặc card storage;
- mechanic web portal;
- Maps/live-tracking UI;
- chatbot hoặc ASR rewrite;
- mobile migration vào root workspace;
- mobile UI/API fixes;
- 2FA;
- API client generation cho toàn bộ OpenAPI;
- global state library, React Query hoặc SWR;
- design-system package mới;
- worker execution UI;
- endpoint backend mới chỉ để phục vụ metric trang trí.

Không sửa `apps/mobile`. Mobile drift được xử lý ở task riêng.

## 4. Source of truth

Khi tài liệu và code khác nhau, ưu tiên:

1. Branch/commit integration đã được người phụ trách chốt.
2. Route files dưới `apps/api/app/api/v1`.
3. Services, repositories, schemas và tests dưới `apps/api/src`.
4. Migrations đã version hóa.
5. File này.
6. Các plan cũ ngày 2026-09-27.

Không suy contract từ UI mock, commit message hoặc OpenAPI roadmap nếu route/service hiện tại khác.

## 5. Baseline bắt buộc

### 5.1 Branch gate

GitHub hiện có FE đầy đủ trên `minh/mobile`; local branch `Danh/fix/mobile-workspace-recovery` thiếu bốn commit FE/mobile. AI MUST kiểm tra:

```powershell
git ls-remote --heads origin
git branch --show-current
git rev-parse HEAD
git merge-base --is-ancestor 78f98c94a4043c4a90da50ed0d40aa892d0e1c28 HEAD
```

Exit code của lệnh cuối MUST là `0`.

Nếu không:

1. STOP.
2. Không tạo lại Admin UI bằng tay.
3. Không reset/switch working tree đang dirty.
4. Tạo worktree/branch mới từ `origin/minh/mobile` bằng cơ chế worktree của môi trường.
5. Dùng branch prefix `codex/` nếu user không chỉ định convention khác.

### 5.2 Existing code phải reuse

Các file sau có trên base đúng và MUST được reuse:

```text
apps/web/src/app/admin/dashboard/page.tsx
apps/web/src/app/admin/layout.tsx
apps/web/src/components/admin/admin-layout.tsx
apps/web/src/components/admin/background-jobs-table.tsx
apps/web/src/components/admin/metrics-bento.tsx
apps/web/src/components/admin/needs-attention-table.tsx
apps/web/src/components/admin/telemetry-mosaic.tsx
apps/web/src/components/admin/welcome-header.tsx
apps/web/src/lib/api-client.ts
apps/web/src/lib/mock-data.ts
apps/web/src/proxy.ts
```

`apps/web/src/lib/api-client.ts` là marketing mock client. MUST NOT biến nó thành admin client.

### 5.3 Dirty-tree safety

Trước mỗi phase:

```powershell
git status --short
```

AI MUST:

- ghi nhận file dirty có sẵn;
- không sửa/revert/stage file ngoài phase;
- không dùng `git reset --hard`, `git checkout --` hoặc force-push;
- không commit/push/deploy nếu chưa được yêu cầu.

## 6. Kiến trúc đích

```text
Browser
  │
  │ Supabase cookie session
  ▼
Next.js Admin Web :3001
  ├─ proxy.ts: refresh auth cookie
  ├─ Server Components: reads
  ├─ Server Actions: writes
  ├─ requireAdmin(): verify session + GET /api/v1/auth/me
  └─ server-only apiFetch(): Bearer token + Zod response parse
          │
          │ HTTPS/JSON
          ▼
Next.js API :3000
  ├─ Supabase JWT verification
  ├─ app actor/role/status authorization
  ├─ /api/v1/admin/**
  ├─ audit/outbox/idempotency
  └─ PostgreSQL repositories
```

Security rules:

- Browser MUST NOT gọi backend API trực tiếp trong phase này.
- Access token MUST NOT nằm trong Client Component props, rendered HTML, localStorage hoặc log.
- Web MUST NOT có `SUPABASE_SERVICE_ROLE_KEY`, `INTERNAL_WORKER_SECRET`, database URL hoặc provider secret.
- Backend là authorization authority. Layout guard chỉ là early rejection/UX.
- Mọi response backend MUST được parse tại trust boundary trước khi render.

## 7. File plan

### 7.1 Package contract

```text
packages/api-contract/
  package.json                         # sửa stub
  tsconfig.json                        # mới
  src/
    common.ts                          # mới
    auth.ts                            # mới
    admin-users.ts                     # mới
    admin-mechanics.ts                 # mới
    admin-service-requests.ts          # mới
    admin-operations.ts                # mới
    health.ts                          # mới
```

Không tạo root barrel `src/index.ts` export mọi domain.

### 7.2 Web auth và data

```text
apps/web/.env.example                  # mới
apps/web/src/lib/supabase/client.ts    # mới
apps/web/src/lib/supabase/server.ts    # mới
apps/web/src/lib/auth/require-admin.ts # mới
apps/web/src/lib/api/server-client.ts  # mới
apps/web/src/lib/api/admin.ts          # mới
apps/web/src/app/login/page.tsx        # mới
apps/web/src/app/login/actions.ts      # mới
apps/web/src/proxy.ts                  # sửa file hiện có
apps/web/src/app/admin/layout.tsx      # sửa auth gate
```

### 7.3 Admin pages

```text
apps/web/src/app/admin/page.tsx
apps/web/src/app/admin/users/page.tsx
apps/web/src/app/admin/users/[userId]/page.tsx
apps/web/src/app/admin/mechanics/page.tsx
apps/web/src/app/admin/mechanics/[mechanicId]/page.tsx
apps/web/src/app/admin/service-requests/page.tsx
apps/web/src/app/admin/service-requests/[requestId]/page.tsx
apps/web/src/app/admin/operations/page.tsx
```

Dashboard route/components hiện có được sửa để nhận dữ liệu thật; không tạo bản sao.

## 8. Phase 0 — Baseline và dependency approval

### Tasks

1. Xác nhận Branch Gate.
2. Đọc root `AGENTS.md` và `apps/web/AGENTS.md`.
3. Chạy baseline command đang tồn tại:

```powershell
pnpm.cmd run typecheck
pnpm.cmd test
pnpm.cmd run build:api
pnpm.cmd run lint:web
pnpm.cmd run build:web
```

4. Ghi kết quả pass/fail trước khi sửa.
5. Xin approval trước khi thêm dependency:

```text
apps/web:
  @careonroad/api-contract workspace:*
  @supabase/supabase-js
  @supabase/ssr
  zod ^3.24.0

apps/api:
  @careonroad/api-contract workspace:*

packages/api-contract:
  zod ^3.24.0
  typescript compatible với workspace
```

Không chạy install khi chưa có approval.

### Gate 0

- Branch chứa `78f98c9` hoặc successor tương đương.
- Existing Admin UI tồn tại.
- Baseline failures được ghi lại và phân biệt với lỗi do task.
- Dependency list được duyệt.

## 9. Phase 1 — Shared Admin HTTP contract

### 9.1 Package manifest

`packages/api-contract/package.json` mục tiêu:

```json
{
  "name": "@careonroad/api-contract",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "exports": {
    "./common": "./src/common.ts",
    "./auth": "./src/auth.ts",
    "./admin/users": "./src/admin-users.ts",
    "./admin/mechanics": "./src/admin-mechanics.ts",
    "./admin/service-requests": "./src/admin-service-requests.ts",
    "./admin/operations": "./src/admin-operations.ts",
    "./health": "./src/health.ts"
  },
  "dependencies": {
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5"
  }
}
```

MUST NOT dùng wildcard export `"./*"` hoặc `export *` toàn package.

### 9.2 Package tsconfig

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

Không dùng `composite`, `declaration`, `outDir` trong phase source-consumed.

### 9.3 Contract purity

Mọi file package MUST:

- chỉ import Zod hoặc file khác trong package;
- không import từ `apps/api`;
- không import repository, Next.js hoặc Supabase;
- không dùng `node:*`, Buffer hoặc `process.env`;
- không có service/business logic;
- giữ snake_case đúng wire format.

### 9.4 Common contract

`common.ts` MUST định nghĩa:

```ts
import { z } from "zod";

export const apiErrorBodySchema = z.object({
  error_code: z.string().min(1),
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

Error body backend là top-level `{ error_code, message, request_id?, details? }`; không bọc trong `{ error: ... }`.

### 9.5 Shared enums

Định nghĩa trong đúng domain và export type từ Zod:

```text
UserRole: rider | mechanic | admin
UserStatus: active | suspended | archived
MechanicProfileStatus: pending | active | rejected | suspended | banned
MechanicLocationFreshness: fresh | stale | missing
MechanicWorkState: idle | active_assignment
ServiceType: emergency_rescue | mobile_repair | at_home_service | periodic_maintenance | other
RequestPriority: normal | high | emergency
RequestStatus:
  submitted | dispatching | offered | assigned | mechanic_en_route |
  in_service | awaiting_quote_approval | awaiting_payment |
  completed | manual_escalation | canceled
AssignmentStatus:
  accepted | en_route | on_site | diagnosis | quoted |
  awaiting_payment | in_progress | completed | canceled | recovery_canceled
```

Không dùng mechanic status `approved`. Action approve chuyển status sang `active`.

### 9.6 Auth contract

Response `/api/v1/auth/me`:

```ts
type RequestActor = {
  id: string;
  display_name?: string;
  roles: UserRole[];
  status: UserStatus;
};
```

Tạo `requestActorSchema`; không export backend `AuthError` hoặc verified identity type.

### 9.7 Admin user contract

Request/query schemas MUST mirror `apps/api/src/features/admin/admin.schemas.ts`:

```text
list query:
  cursor?: string (1..500)
  limit: integer 1..100, default 50
  query?: trimmed string 1..120
  role?: UserRole
  status?: UserStatus
  from?: ISO datetime with offset
  to?: ISO datetime with offset; from <= to

reason body:
  reason: trimmed string 10..500

role body:
  reason: trimmed string 10..500
  role: UserRole
```

Response item:

```ts
type AdminUserSummary = {
  id: string;
  display_name?: string;
  phone_masked?: string;
  status: UserStatus;
  roles: UserRole[];
  device_summary: { total: number; enabled: number };
  created_at: string;
  updated_at: string;
};
```

Device response:

```ts
type AdminUserDevice = {
  id: string;
  user_id: string;
  device_key_fingerprint: string;
  platform: string;
  enabled: boolean;
  last_registered_at: string;
  created_at: string;
  updated_at: string;
};
```

Activity response:

```ts
type AdminUserActivity = {
  id: string;
  actor_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  metadata: Record<string, unknown>;
  occurred_at: string;
};
```

List/devices/activity use `{ items, page }`.

### 9.8 Admin mechanic contract

List query:

```text
cursor?: string
limit: 1..100, default 50
profile_status?: pending|active|rejected|suspended|banned
service_type?: ServiceType
is_available?: boolean
location_freshness?: fresh|stale|missing
work_state?: idle|active_assignment
```

Mutation bodies:

```text
status/force-unavailable: { reason: string 10..500 }
skills: { reason: string 10..500, service_types: ServiceType[1..5] }
radius: { reason: string 10..500, service_radius_km: number > 0 and <= 100 }
```

Summary response:

```ts
type AdminMechanicSummary = {
  user_id: string;
  profile_status: MechanicProfileStatus;
  is_available: boolean;
  service_radius_km: number;
  service_types: ServiceType[];
  location_freshness: MechanicLocationFreshness;
  work_state: MechanicWorkState;
  rating_avg: number;
  rating_count: number;
  availability_updated_at: string;
  created_at: string;
  updated_at: string;
};
```

Work-history response:

```ts
type AdminMechanicWorkHistory = {
  assignment_id: string;
  request_id: string;
  status: AssignmentStatus;
  accepted_at: string;
  started_at?: string;
  completed_at?: string;
  canceled_at?: string;
  created_at: string;
  updated_at: string;
};
```

Performance response:

```ts
type AdminMechanicPerformance = {
  mechanic_id: string;
  assignments: {
    total: number;
    active: number;
    completed: number;
    canceled: number;
  };
  trusted_rating: { average: number; count: number };
};
```

### 9.9 Admin service-request contract

List query:

```text
cursor?: string
limit: 1..100, default 50
status?: RequestStatus
service_type?: ServiceType
priority?: normal|high|emergency
rider_id?: UUID
mechanic_id?: UUID
request_code?: trimmed string 1..40
from?: ISO datetime with offset
to?: ISO datetime with offset; from <= to
```

Summary response:

```ts
type AdminServiceRequestSummary = {
  id: string;
  request_code: string;
  rider_id: string;
  motorcycle_id: string;
  service_type: ServiceType;
  fulfillment_mode?: "immediate_location" | "scheduled_visit";
  status: RequestStatus;
  priority: RequestPriority;
  mechanic_id?: string;
  scheduled_start_at?: string;
  created_at: string;
  updated_at: string;
};
```

Detail extends summary with optional `dispatch`, `assignment`, `latest_quote`, `reminder`. AI MUST mirror field definitions from `AdminServiceRequestDetailResponse` instead of inventing them.

Timeline is a discriminated union:

```text
kind=status:
  id, from_status?, to_status, actor_id?, reason?, created_at

kind=internal_note:
  id, admin_id, note, created_at
```

Internal note body:

```text
reason: 10..500
note: trimmed 1..2000
```

### 9.10 Operations contract

Tất cả response dùng `{ items, page }`, query chỉ có `limit` 1..100 default 25 và `cursor?`.

Item wire shapes:

```text
outbox-dead-letters:
  id, topic, aggregate_type, aggregate_id, attempt_count,
  last_error_code?, created_at

payments-needs-review:
  id, request_id, assignment_id, status="needs_review", updated_at

dispatch-stuck:
  id, request_code, status="dispatching"|"offered", updated_at

worker-runs:
  id, worker_name, status="succeeded"|"failed", error_code?,
  items_claimed, items_succeeded, items_failed,
  started_at, completed_at, created_at
```

Không expose event payload hoặc raw worker errors.

### 9.11 Health contract

```ts
type Liveness = { status: "ok" };

type Readiness = {
  status: "ready" | "not_ready";
  checks: Array<{
    name: "database" | "workers" | "notifications" | "media" | "payments";
    status: "up" | "configured" | "disabled" | "down" | "invalid";
  }>;
};
```

Health không phải business metrics.

### 9.12 Backend adoption

Migrate từng domain:

1. Tạo shared response/request schema.
2. Thêm `workspace:*` dependency cho API.
3. Cập nhật imports domain tương ứng.
4. Giữ thin route handlers.
5. Thêm test chứng minh service response parse bằng shared schema.
6. Chạy domain tests + contract typecheck + API typecheck.
7. Chỉ xóa định nghĩa cũ sau khi `rg` chứng minh không còn caller.

MUST NOT move toàn bộ 16+ schema files. Không đưa runtime-controls, retention, chatbot, route ETA hoặc mobile types vào phase này.

### Gate 1

```powershell
pnpm.cmd --filter @careonroad/api-contract typecheck
pnpm.cmd run typecheck
pnpm.cmd test
pnpm.cmd run build:api
```

Ngoài ra:

- package không import backend internals;
- error/pagination schemas đúng wire shape;
- không duplicate export;
- API behavior/status code không đổi.

## 10. Phase 2 — Web runtime, env và scripts

### 10.1 Port convention

- API giữ port `3000`.
- Web chạy port `3001` khi đồng thời với API.

Sửa web dev script theo pattern tối thiểu:

```json
"dev": "next dev -p 3001",
"typecheck": "tsc --noEmit"
```

Không đổi API sang 3001 vì mobile remote đang dùng API 3000.

### 10.2 Environment example

Tạo `apps/web/.env.example`:

```dotenv
API_BASE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

MUST NOT thêm backend secrets.

### 10.3 Web dependencies

Sau approval, khai báo:

```json
"@careonroad/api-contract": "workspace:*"
```

và official Supabase SSR dependencies. Dùng Zod cùng version contract/API; không cài validation library khác.

### Gate 2

```powershell
pnpm.cmd --filter @careonroad/web typecheck
pnpm.cmd run lint:web
pnpm.cmd run build:web
```

`rg` MUST không tìm thấy service-role key, worker secret hoặc database URL trong `apps/web`.

## 11. Phase 3 — Supabase SSR authentication

### 11.1 Browser client

`apps/web/src/lib/supabase/client.ts`:

- dùng `createBrowserClient`;
- đọc public URL + publishable key;
- validate env tồn tại;
- không import trong server-only API module;
- chỉ dùng cho login/logout hoặc interactive auth state khi cần.

### 11.2 Server client

`apps/web/src/lib/supabase/server.ts`:

- dùng `createServerClient` và `cookies()`;
- tạo client theo request, không cache module-global;
- hỗ trợ read/write cookie theo API hiện tại của `@supabase/ssr`;
- Server Component read-only cookie write failure phải được xử lý theo official pattern;
- không log cookie hoặc token.

### 11.3 Proxy

Sửa `apps/web/src/proxy.ts` hiện có:

- giữ `x-pathname` nếu root layout còn cần;
- refresh session/cookies theo official Next.js 16 + Supabase SSR pattern;
- không quyết định admin role tại proxy;
- matcher loại static assets và Next internals;
- tránh redirect loop `/login` ↔ `/admin`.

### 11.4 Login

`/login` gồm:

- email input;
- password input;
- submit pending state;
- generic invalid-credentials message;
- accessible labels;
- không lưu password;
- không tiết lộ email có tồn tại hay không.

Server Action flow:

1. Validate input.
2. `signInWithPassword`.
3. Verify session server-side.
4. Gọi `/api/v1/auth/me`.
5. Chỉ redirect `/admin/dashboard` nếu actor `active` và có role `admin`.
6. Rider/mechanic/suspended actor nhận 403 flow; không render admin data.

### 11.5 `requireAdmin()`

Algorithm bắt buộc:

1. Tạo Supabase server client.
2. Verify auth bằng `getClaims()` hoặc `getUser()` theo official version; MUST NOT chỉ tin `getSession()`.
3. Lấy access token của session đã được verify.
4. Nếu thiếu/hết hạn: redirect `/login`.
5. Gọi backend `GET /api/v1/auth/me` qua server client.
6. Nếu actor status khác `active`: deny.
7. Nếu roles không chứa `admin`: deny.
8. Trả `{ actor, accessToken }` chỉ trong server boundary.

`apps/web/src/app/admin/layout.tsx` gọi `requireAdmin()` trước khi render children. Chỉ truyền `actor.display_name` và display-safe fields vào `AdminLayout`; không truyền token.

### Gate 3 — Auth matrix

| Case | Expected |
|---|---|
| Không cookie | Redirect `/login` |
| Cookie expired | Refresh hoặc login, không loop |
| Rider active | 403/forbidden |
| Mechanic active | 403/forbidden |
| Admin suspended | Bị chặn |
| Admin active | Vào admin shell |
| Logout | Cookie xóa, `/admin` bị chặn |

Web typecheck/lint/build MUST pass.

## 12. Phase 4 — Server-only API client

### 12.1 Boundary

`apps/web/src/lib/api/server-client.ts` MUST bắt đầu bằng:

```ts
import "server-only";
```

MUST NOT import module này từ Client Component.

### 12.2 Interface tối thiểu

```ts
type ApiRequestOptions<T> = {
  accessToken: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  idempotencyKey?: string;
  schema: import("zod").ZodType<T>;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions<T>
): Promise<T>;
```

Không tạo class/factory/interceptor framework ngoài một controlled error class.

### 12.3 Request algorithm

1. Đọc `API_BASE_URL`; throw configuration error nếu thiếu/invalid.
2. Chỉ nhận relative path bắt đầu `/`.
3. Ghép URL bằng `new URL(path, base)`.
4. Header:
   - `Accept: application/json`;
   - `Authorization: Bearer ...`;
   - `Content-Type: application/json` khi có body;
   - `X-Idempotency-Key` khi caller truyền.
5. `cache: "no-store"`.
6. Timeout mặc định 15 giây bằng `AbortController`.
7. Cleanup timer trong `finally`.
8. 204 trả `undefined` chỉ khi schema cho phép.
9. Non-2xx parse `apiErrorBodySchema`.
10. 2xx parse bằng schema caller truyền.
11. Schema mismatch throw controlled `CONTRACT_MISMATCH`; không render partial payload.

### 12.4 Error class

```ts
export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}
```

Không log token, headers, request body hoặc raw response.

### 12.5 Error UX mapping

| Error | Behavior |
|---|---|
| 400 `INVALID_INPUT` | Field/form error hoặc controlled banner |
| 401 | Redirect login; không retry loop |
| 403 | Forbidden page |
| 404 | Not-found state |
| 409 | Conflict message; giữ same intent key |
| 429 | Retry-later message |
| timeout/network | GET có retry button; mutation retry cùng key |
| contract mismatch | Error boundary + diagnostic code, không show raw payload |
| 5xx | Generic service unavailable + request ID nếu có |

### Gate 4

- API module không vào browser bundle.
- GET thật parse qua Zod.
- Error shape đọc `error_code` top-level.
- Timeout cleanup đúng.
- Marketing `apps/web/src/lib/api-client.ts` không đổi semantics.

## 13. Phase 5 — Admin API adapter

Tạo `apps/web/src/lib/api/admin.ts`. Mỗi function:

- nhận `accessToken` từ server caller;
- validate query/body bằng contract trước khi gửi;
- build query với `URLSearchParams`;
- bỏ field `undefined`, `null`, empty string;
- gọi đúng response schema;
- không tự sinh idempotency key.

### 13.1 Users

| Function | Method/path |
|---|---|
| `listUsers` | `GET /api/v1/admin/users` |
| `getUser` | `GET /api/v1/admin/users/{userId}` |
| `listUserDevices` | `GET /api/v1/admin/users/{userId}/devices` |
| `listUserActivity` | `GET /api/v1/admin/users/{userId}/activity` |
| `suspendUser` | `POST /api/v1/admin/users/{userId}/suspend` |
| `reactivateUser` | `POST /api/v1/admin/users/{userId}/reactivate` |
| `archiveUser` | `POST /api/v1/admin/users/{userId}/archive` |
| `grantUserRole` | `POST /api/v1/admin/users/{userId}/roles/grant` |
| `revokeUserRole` | `POST /api/v1/admin/users/{userId}/roles/revoke` |
| `revokeDevice` | `POST /api/v1/admin/devices/{deviceId}/revoke` |

Không dùng `/grant-role`, `/revoke-role` hoặc nested user-device revoke path.

### 13.2 Mechanics

| Function | Method/path |
|---|---|
| `listMechanics` | `GET /api/v1/admin/mechanics` |
| `getMechanic` | `GET /api/v1/admin/mechanics/{mechanicId}` |
| `listMechanicWorkHistory` | `GET /api/v1/admin/mechanics/{mechanicId}/work-history` |
| `getMechanicPerformance` | `GET /api/v1/admin/mechanics/{mechanicId}/performance` |
| `approveMechanic` | `POST .../{mechanicId}/approve` |
| `rejectMechanic` | `POST .../{mechanicId}/reject` |
| `suspendMechanic` | `POST .../{mechanicId}/suspend` |
| `banMechanic` | `POST .../{mechanicId}/ban` |
| `reactivateMechanic` | `POST .../{mechanicId}/reactivate` |
| `forceUnavailable` | `POST .../{mechanicId}/force-unavailable` |
| `updateMechanicSkills` | `PUT .../{mechanicId}/skills` |
| `updateMechanicRadius` | `PUT .../{mechanicId}/service-radius` |

### 13.3 Service requests

| Function | Method/path |
|---|---|
| `listServiceRequests` | `GET /api/v1/admin/service-requests` |
| `getServiceRequest` | `GET /api/v1/admin/service-requests/{requestId}` |
| `listRequestTimeline` | `GET .../{requestId}/timeline` |
| `listRequestMedia` | `GET .../{requestId}/media` |
| `getRequestAssignment` | `GET .../{requestId}/assignment` |
| `listRequestQuotes` | `GET .../{requestId}/quotes` |
| `cancelRequest` | `POST .../{requestId}/cancel` |
| `manualEscalateRequest` | `POST .../{requestId}/manual-escalate` |
| `addInternalNote` | `POST .../{requestId}/notes` |

Không dùng `/internal-notes`.

### 13.4 Operations và health

| Function | Method/path | Auth |
|---|---|---|
| `listDeadLetters` | `GET /api/v1/admin/operations/outbox-dead-letters` | Admin JWT |
| `listPaymentsNeedsReview` | `GET /api/v1/admin/operations/payments-needs-review` | Admin JWT |
| `listDispatchStuck` | `GET /api/v1/admin/operations/dispatch-stuck` | Admin JWT |
| `listWorkerRuns` | `GET /api/v1/admin/operations/worker-runs` | Admin JWT |
| `getLiveness` | `GET /api/v1/internal/health/live` | Public probe |
| `getReadiness` | `GET /api/v1/internal/health/ready` | Public probe |

MUST NOT gọi `/api/v1/internal/workers/**` từ web.

### Gate 5

- Mọi adapter path đối chiếu route file.
- Không path từ plan cũ còn tồn tại.
- Query dùng API enum thật.
- Response đều parse Zod.

## 14. Phase 6 — Read-only Admin UI

### 14.1 Server/Client rules

- Page/layout mặc định là Server Component.
- Reads thực hiện server-side.
- Filters dùng GET form + URL search params nếu đủ.
- Chỉ dialog/form/toast cần Client Component.
- Không fetch bằng `useEffect` nếu Server Component làm được.
- Không thêm global state/data-fetch dependency.

### 14.2 Root admin route

`/admin` redirect server-side tới `/admin/dashboard`.

### 14.3 Admin shell

Sửa `AdminLayout`:

- nhận actor display name/code từ backend, bỏ hard-coded Nhật Minh;
- nav link đúng users/mechanics/service-requests/operations;
- không hiển thị badge số hard-coded như dữ liệu thật;
- badge không có dữ liệu thật thì bỏ hoặc dùng nhãn không định lượng;
- active state dựa path/prop thật.

### 14.4 Dashboard

Reuse:

- `MetricsBento`;
- `TelemetryMosaic`;
- `NeedsAttentionTable`;
- `BackgroundJobsTable`;
- `WelcomeHeader`.

Refactor module-level hard-coded arrays thành typed props.

Dashboard MVP chỉ được hiển thị dữ liệu có nguồn thật:

- liveness/readiness badge;
- dead letters;
- payments needing review;
- stuck dispatch;
- worker runs;
- link đến users/mechanics/service requests.

Không dùng readiness làm request/user/mechanic count. Không fetch toàn bộ list để đếm. Metric chưa có aggregate endpoint thì bỏ khỏi MVP hoặc ghi rõ “chưa có dữ liệu”; không hiển thị số giả.

`TelemetryMosaic` map/real-time content không có backend phù hợp trong scope. Giữ placeholder có nhãn rõ hoặc bỏ section; không gọi live tracking/maps.

### 14.5 Users pages

List page:

- filters: query, role, status, date range;
- table columns: display name/ID, masked phone, status, roles, device counts, updated time;
- next cursor navigation;
- empty/error/loading states;
- detail link.

Detail page:

- summary;
- devices page;
- activity page;
- action area để Phase 7 wire mutations.

Không render full phone vì backend chỉ trả masked value.

### 14.6 Mechanics pages

List filters:

- profile status;
- service type;
- availability;
- location freshness;
- work state.

Columns:

- user ID;
- status;
- availability;
- service types/radius;
- location freshness/work state;
- rating/count;
- updated time.

Display label “Đã duyệt” có thể map từ API value `active`, nhưng query MUST gửi `active`.

Detail page:

- summary;
- work history;
- performance;
- action area.

Không hiển thị earnings/payout vì endpoint không có.

### 14.7 Service-request pages

List filters:

- status;
- service type;
- priority;
- rider/mechanic ID;
- request code;
- date range.

Detail page:

- summary;
- dispatch/assignment/latest quote/reminder nếu có;
- timeline;
- media metadata;
- quotes;
- action area.

Không render raw media payload; endpoint chỉ trả metadata.

### 14.8 Operations page

Dùng bốn section/tab:

- Dispatch stuck;
- Payments needs review;
- Outbox dead letters;
- Worker runs.

Không gộp item khác shape bằng unsafe cast. Nếu cần unified view, tạo display discriminant tại UI adapter, không sửa wire contract.

### 14.9 Pagination

Mọi list dùng:

```text
items
page.limit
page.has_more
page.next_cursor
```

Không dùng page number giả. Cursor được coi opaque; không decode trong web.

### 14.10 Accessibility

- input có label;
- table có caption/header semantic;
- icon button có accessible name;
- không dùng màu làm tín hiệu duy nhất;
- focus rõ;
- dialog trap/restore focus;
- pending/error status đọc được bởi screen reader;
- action destructive cần confirmation.

### Gate 6

- Tất cả read-only pages render data thật.
- Không mock admin counts/rows.
- 401/403/404/empty/error/loading states hoạt động.
- Marketing pages vẫn dùng mock client và không regression.
- Web typecheck/lint/build pass.

## 15. Phase 7 — Mutations và idempotency

### 15.1 Server Actions

Mỗi domain có action module gần route hoặc trong `src/lib/actions`. Không tạo generic mutation framework.

Action flow:

1. `requireAdmin()`.
2. Parse form data bằng shared contract.
3. Nhận idempotency key thuộc user intent.
4. Gọi admin adapter.
5. Map controlled error thành action result.
6. `revalidatePath` đúng list/detail.
7. Không trả token/raw error/details nhạy cảm về client.

### 15.2 Idempotency lifecycle

MUST:

1. Tạo UUID khi user mở/bắt đầu một action intent.
2. Giữ UUID trong hidden form field hoặc server-owned state.
3. Retry timeout/network của cùng intent với cùng UUID.
4. Sau success/cancel dialog, intent mới dùng UUID mới.

MUST NOT sinh key trong `apiFetch` hoặc mỗi retry attempt.

Backend semantics:

- same key + same payload → replay;
- same key + different payload → conflict;
- in-progress duplicate → conflict.

### 15.3 Mutation requirements

Tất cả admin mutations:

- gửi `X-Idempotency-Key` 8..200 chars;
- gửi reason 10..500 chars;
- disable submit khi pending;
- có confirmation rõ action/resource;
- sau success revalidate đúng paths.

Role mutation thêm `role`. Skills thêm `service_types`. Radius thêm `service_radius_km`. Internal note thêm `note` 1..2000.

### 15.4 Conflict handling

409 không tự động đồng nghĩa “đã xử lý thành công”. UI:

- hiển thị backend controlled message;
- giữ same key nếu user retry cùng intent;
- cung cấp refresh resource;
- không retry bằng key mới để né conflict.

### 15.5 State-aware actions

Chỉ render/enable action hợp lý theo status hiện tại:

- mechanic approve/reject khi pending;
- reactivate theo state backend cho phép;
- request cancel/escalate theo state backend;
- role revoke không được làm UI giả định rằng actor có thể tự bỏ admin an toàn.

Backend vẫn quyết định cuối cùng; UI state gate không thay authorization.

### Gate 7

- Double-click không nhân side effect.
- Network retry dùng same key.
- Invalid reason/note/radius/skills bị chặn.
- 409/403/429/5xx có UX riêng.
- Thành công cập nhật list/detail không reload toàn site.

## 16. Phase 8 — Verification

### 16.1 Static/unit/build

Chạy từ root trên Windows:

```powershell
pnpm.cmd --filter @careonroad/api-contract typecheck
pnpm.cmd run typecheck
pnpm.cmd test
pnpm.cmd run build:api
pnpm.cmd --filter @careonroad/web typecheck
pnpm.cmd run lint:web
pnpm.cmd run build:web
```

Không chạy mobile build nếu không chạm mobile.

### 16.2 Focused tests

Contract/backend:

- error schema;
- page schema;
- each admin response schema parses service output;
- invalid enum/date/range/reason rejected;
- no wire-shape changes.

Web:

- nếu repo chưa có web test runner, không thêm framework chỉ để tick checkbox;
- Next build + TypeScript + lint là minimum runnable check;
- security/idempotency logic cần test bằng runner đã có hoặc nhỏ nhất được team duyệt.

### 16.3 Manual smoke

1. API 3000, web 3001.
2. `/admin` chưa login → `/login`.
3. Rider login → forbidden.
4. Mechanic login → forbidden.
5. Admin suspended → blocked.
6. Admin active → dashboard.
7. Health badge đúng.
8. Bốn operational queues load.
9. Users list/filter/cursor/detail/devices/activity.
10. Mechanics list/filter/detail/history/performance.
11. Requests list/filter/detail/timeline/media/quotes.
12. Một mutation mỗi domain.
13. Double-click mutation.
14. Retry mutation sau simulated timeout.
15. Invalid reason.
16. API down → controlled error.
17. Browser source/network không lộ backend secret/token trong HTML.
18. Marketing routes vẫn render.

### 16.4 Security scan

```powershell
rg -n "SUPABASE_SERVICE_ROLE_KEY|INTERNAL_WORKER_SECRET|DATABASE_URL|PAYOS_|OPENROUTER_API_KEY|GEMINI_API_KEY" apps/web
rg -n "NEXT_PUBLIC_API_BASE_URL" apps/web
rg -n "localStorage.*token|access_token" apps/web/src
```

Mọi match phải được review. Public Supabase URL/publishable key được phép; secret không được phép.

## 17. Definition of Done

Branch/base:

- [ ] Implementation base chứa `78f98c9` hoặc successor tích hợp tương đương.
- [ ] Không tái tạo/ghi đè Admin UI từ branch cũ.

Contract:

- [ ] Admin-only request/query/response schemas tồn tại.
- [ ] Error và pagination đúng wire shape.
- [ ] Package không import backend internals.
- [ ] Explicit subpath exports.
- [ ] API/web dùng `workspace:*`.

Auth/security:

- [ ] Supabase SSR session refresh hoạt động.
- [ ] `/auth/me` xác nhận active admin.
- [ ] Token chỉ ở server boundary.
- [ ] Không service role/worker secret/database URL trong web.
- [ ] Không log token/cookie/body nhạy cảm.

Data/UI:

- [ ] Dashboard reuse component hiện có.
- [ ] Không admin mock rows/counts giả.
- [ ] Users/mechanics/requests/operations read pages hoạt động.
- [ ] Cursor pagination đúng.
- [ ] Error/loading/empty/403/404 states có.
- [ ] Accessibility cơ bản có.

Mutations:

- [ ] Route/body đúng backend.
- [ ] Reason validation đúng.
- [ ] Same intent giữ idempotency key qua retry.
- [ ] 409 không bị né bằng key mới.
- [ ] Revalidation có phạm vi.

Verification:

- [ ] Contract typecheck pass.
- [ ] API typecheck/test/build pass.
- [ ] Web typecheck/lint/build pass.
- [ ] Manual smoke matrix có kết quả.
- [ ] Không có mobile diff mới.
- [ ] Không có secret trong diff.

## 18. Thứ tự PR/commit

Không tạo mega-PR.

1. **Branch integration gate** — xác nhận base FE đầy đủ; merge branch là decision riêng.
2. **PR 1: admin HTTP contract** — package + backend adoption + tests.
3. **PR 2: web runtime/auth/server client** — env, port, Supabase SSR, `/auth/me` gate.
4. **PR 3: read-only admin UI** — dashboard/users/mechanics/requests/operations.
5. **PR 4: mutations** — forms, reason, idempotency, revalidation.

Mỗi PR phải pass gate riêng trước PR sau.

## 19. Stop conditions

AI MUST STOP và báo người phụ trách khi:

- branch không chứa `78f98c9`/Admin UI expected;
- remote tip thay đổi và code không còn khớp guide;
- cần dependency chưa được duyệt;
- cần sửa backend behavior nhưng task chỉ cấp quyền frontend;
- response thật khác contract đã khóa;
- route không tồn tại;
- cần admin credential hoặc env để E2E;
- có nguy cơ ghi dữ liệu production;
- gặp cùng blocker/fix thất bại hai lần;
- file cần sửa đang có user changes chồng lấn.

Không hardcode bypass auth, mock success, cast `as any`, bỏ Zod parse hoặc đổi status/path để làm build xanh.

## 20. Report template cho AI

Sau mỗi phase, AI trả đúng format:

```text
Phase:
Base branch/commit:

Implemented:
- ...

Files changed:
- ...

Verification:
- command: result

Manual checks:
- case: result

Security checks:
- ...

Not verified:
- item + reason

Risks/blockers:
- ...
```

Không báo “done” nếu gate chưa pass.

## 21. Prompt copy/paste cho AI coding agent

```text
Bạn phải triển khai CareOnRoad Admin Web theo file ADMIN-WEB-AI-IMPLEMENTATION-SOLUTION.md.

Trước khi code:
1. Đọc root AGENTS.md, apps/web/AGENTS.md và toàn bộ solution file.
2. Chạy git ls-remote, git status và Branch Gate.
3. Chỉ làm trên branch chứa commit 78f98c9 hoặc successor tích hợp đầy đủ minh/mobile.
4. Không switch/reset working tree dirty; dùng worktree mới nếu cần.
5. Ghi baseline command results.

Chỉ triển khai phase được giao: [GHI PHASE Ở ĐÂY]. Không làm phase khác.

Quy tắc:
- Route/service/test backend là source of truth.
- Reuse Admin UI đang có; không dựng lại.
- Giữ web api-client.ts cho marketing mock.
- Admin reads dùng Server Components và server-only apiFetch.
- Admin writes dùng Server Actions khi phù hợp.
- Auth phải verify Supabase server-side và gọi /api/v1/auth/me.
- Error body là { error_code, message, request_id?, details? }.
- Pagination là { items, page: { limit, has_more, next_cursor? } }.
- Mechanic approved là UI label; API value là active.
- Không gọi internal worker routes.
- Không đưa token/service role/worker secret/database URL vào browser hoặc log.
- Idempotency key thuộc một user intent và giữ nguyên qua retry.
- Không sửa apps/mobile.
- Không thêm dependency nếu chưa được duyệt.
- Không dùng any/bypass validation/mock success để làm build xanh.
- Không commit/push/deploy nếu chưa được yêu cầu.

Quy trình:
1. Xác nhận file/routes/schema thực tế.
2. Nêu file sẽ sửa.
3. Làm diff nhỏ nhất hoàn thành phase.
4. Chạy phase gate.
5. Sửa lỗi trong scope.
6. Báo theo Report template của solution file.

STOP khi branch sai, contract khác code, cần quyền/dependency/credential mới, có nguy cơ production write, hoặc user changes chồng lấn.
```

## 22. Bằng chứng code dùng để khóa solution

Backend:

```text
apps/api/src/lib/api-error.ts
apps/api/src/features/auth/auth.types.ts
apps/api/src/features/auth/auth.route-handlers.ts
apps/api/src/features/admin/admin.schemas.ts
apps/api/src/features/admin/admin-user-management.service.ts
apps/api/src/features/admin/admin-mechanic-management.service.ts
apps/api/src/features/admin/admin-service-request.service.ts
apps/api/src/features/operations/operational-monitoring.service.ts
apps/api/src/features/health/health.service.ts
apps/api/app/api/v1/admin/**/route.ts
apps/api/app/api/v1/internal/health/**/route.ts
```

Frontend tại `minh/mobile@78f98c9`:

```text
apps/web/src/lib/api-client.ts
apps/web/src/lib/mock-data.ts
apps/web/src/proxy.ts
apps/web/src/app/admin/dashboard/page.tsx
apps/web/src/app/admin/layout.tsx
apps/web/src/components/admin/*
```

GitHub:

- `https://github.com/CareOnRoad/CareOnRoad-Application/tree/78f98c94a4043c4a90da50ed0d40aa892d0e1c28`
- `https://github.com/CareOnRoad/CareOnRoad-Application/commit/78f98c94a4043c4a90da50ed0d40aa892d0e1c28`
- `https://github.com/CareOnRoad/CareOnRoad-Application/commit/626626b2330da497d10685b81fef1d3bca727aaa`

Nếu code thay đổi sau ngày khóa bằng chứng, AI phải re-audit route/schema/branch trước khi áp dụng solution.
