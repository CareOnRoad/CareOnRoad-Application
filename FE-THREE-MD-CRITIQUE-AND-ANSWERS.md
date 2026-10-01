# Phản biện ba tài liệu FE và trả lời toàn bộ câu hỏi


## 1. Ba tài liệu được review

1. `2026-09-27-open-questions-for-be-dev.md`
2. `2026-09-27-be-dev-notes-phase0.md`
3. `2026-09-27-be-contract-refactor-and-admin-web.md`

## 2. Kết luận ngắn

Ba tài liệu xác định đúng vấn đề tổng quát: frontend cần contract đáng tin cậy và Admin Web cần nối backend thật. Tuy nhiên không nên thực thi nguyên trạng.

Kết luận sau khi đối chiếu cả local và GitHub:

- Các file Web Admin, mock API client, mobile services, `app.config.ts` và `eas.json` **có tồn tại** trên `minh/mobile`.
- Audit chỉ nhìn local `78c17c1` sẽ kết luận sai vì local thiếu bốn commit frontend/mobile.
- Backend trên `minh/mobile` gần như giống local; dưới `apps/api` chỉ khác `package.json`. Vì vậy các phản biện về route, schema, response và error vẫn áp dụng.
- Phase 0 “move toàn bộ schema” không tạo ra HTTP contract hoàn chỉnh và có phạm vi quá rộng.
- Error body, pagination, một số route mutation và mechanic status trong plan không khớp backend.
- Auth bị đặt quá muộn. Phải làm auth trước khi wire admin data.
- `apps/web/src/lib/api-client.ts` có thật nhưng chỉ phục vụ marketing mock data; không nên biến nó thành admin client.
- Giải pháp đúng là: base từ `minh/mobile` → admin-only contract → auth-first → server-only admin client → read-only UI → mutations.

## 3. Phạm vi audit và bằng chứng GitHub

Audit được thực hiện bằng:

- `git ls-remote --heads --tags` trực tiếp tới GitHub;
- mirror clone toàn bộ repository;
- `git log --all`;
- `git ls-tree` trên từng branch;
- `git diff 78c17c1..78f98c9`;
- `git show` và `git grep` trên remote commit;
- đối chiếu route/service/schema/test trong backend.

### 3.1 Branch inventory

| Branch | Tip | Đi trước `main` | File tại tip | Nhận định |
|---|---:|---:|---:|---|
| `main` | `b762dc4` | 0 | 77 | Default branch cũ |
| `v0/dashork-6b90d306` | `b762dc4` | 0 | 77 | Trùng `main` |
| `refactor/monorepo` | `fc7e7e5` | 6 | 921 | Backend được đưa vào monorepo |
| `mono/mobile/break` | `0d178c1` | 7 | 963 | Mobile baseline/backup |
| `Danh/fix/mobile-workspace-recovery` | `78c17c1` | 8 | 967 | Local branch hiện tại |
| `minh/mobile` | `78f98c9` | 12 | 1.050 | Branch đầy đủ nhất |

Tất cả branch tip nằm trên cùng chuỗi lịch sử. `main` là ancestor và đang tụt 12 commit so với `minh/mobile`.

### 3.2 Bốn commit local đang thiếu

| Commit | Nội dung đã kiểm chứng trong tree |
|---|---|
| `461d460` | Mobile auth/login, Supabase, HTTP client |
| `0df9edb` | Rider services, `app.config.ts`, `eas.json` |
| `626626b` | Web marketing UI, mock `api-client.ts`, mock data |
| `78f98c9` | Mechanic mobile services và Admin dashboard/components |

### 3.3 Ma trận file quan trọng

| File/nhóm file | Local `78c17c1` | Remote `minh/mobile` |
|---|---:|---:|
| Backend admin routes/services | Có | Có |
| `packages/api-contract` stub | Có | Có |
| Web mock `api-client.ts` | Không | Có |
| Web Admin dashboard/components | Không | Có |
| Mobile `api.ts` | Không | Có |
| Mobile service modules | Không | Có |
| `app.config.ts` | Không | Có |
| `eas.json` | Không | Có |

Do đó tài liệu FE mô tả branch `minh/mobile`, không phải working tree local đang mở.

## 4. Các sự thật backend dùng làm chuẩn

### 4.1 Error body

Backend trả:

```json
{
  "error_code": "INVALID_INPUT",
  "message": "...",
  "request_id": "optional",
  "details": "optional"
}
```

Nguồn: `apps/api/src/lib/api-error.ts`.

Không phải:

```json
{
  "error": {
    "code": "INVALID_INPUT"
  }
}
```

Mobile client trên `minh/mobile` hiện đang parse theo shape thứ hai, nên đây là drift có thật.

### 4.2 Pagination

Admin list/operational responses dùng:

```json
{
  "items": [],
  "page": {
    "limit": 50,
    "has_more": false,
    "next_cursor": "optional"
  }
}
```

Không dùng `{ data, next_cursor }`.

### 4.3 Admin actor

`GET /api/v1/auth/me` trả:

```ts
type RequestActor = {
  id: string;
  display_name?: string;
  roles: ("rider" | "mechanic" | "admin")[];
  status: "active" | "suspended" | "archived";
};
```

Admin Web phải kiểm tra `status === "active"` và `roles.includes("admin")`.

### 4.4 Mechanic status

Backend dùng:

```text
pending | active | rejected | suspended | banned
```

Không có `approved`. Approve là action chuyển `pending` sang `active`.

### 4.5 Route dễ bị ghi sai

| Nghiệp vụ | Route thật |
|---|---|
| Grant role | `POST /api/v1/admin/users/{userId}/roles/grant` |
| Revoke role | `POST /api/v1/admin/users/{userId}/roles/revoke` |
| Revoke device | `POST /api/v1/admin/devices/{deviceId}/revoke` |
| Internal note | `POST /api/v1/admin/service-requests/{requestId}/notes` |

### 4.6 Admin reason/idempotency

- Reason: trimmed, 10–500 ký tự.
- Internal note: trimmed, 1–2000 ký tự.
- Idempotency key: 8–200 ký tự.
- Same key + same payload: replay.
- Same key + different payload: conflict.
- Duplicate đang xử lý: conflict.

Key phải thuộc một user intent và giữ nguyên qua retry.

### 4.7 Health

Liveness:

```json
{ "status": "ok" }
```

Readiness:

```json
{
  "status": "ready",
  "checks": [
    { "name": "database", "status": "up" }
  ]
}
```

Health không chứa business metrics.

## 5. Phản biện file 1 — `open-questions-for-be-dev.md`

### 5.1 Điểm làm đúng

- Nhận ra số schema file thật không khớp plan.
- Nhận ra thiếu `assignment-recovery.schemas.ts` trong mapping.
- Nhận ra naming mismatch admin/notification.
- Đặt câu hỏi về cross-import và duplicate exports.
- Nhận ra root không có shared `tsconfig.json`.
- Nhận ra API phải khai báo workspace dependency.
- Tách public/browser API URL khỏi server-side API URL.

### 5.2 Điểm sai hoặc thiếu

#### Q2 scan sai vị trí

File nói không tìm thấy runtime controls. Thực tế có:

```text
apps/api/src/server/runtime-controls/
```

Nó không nằm dưới `src/features` và không phải HTTP schema cần chuyển.

#### Command scan import chưa đủ

Lệnh chỉ tìm `../` sẽ bỏ sót alias `@/...`. Repo dùng cả relative và alias imports.

#### Command scan test chưa đủ

Chỉ tìm `.schemas'` có thể bỏ sót:

- `.schema.ts` số ít;
- `.schemas.ts` số nhiều;
- double quotes;
- alias imports.

#### Q4 cần phân biệt UI và contract consumer

Web UI có trên `minh/mobile`, nhưng chưa import admin/notification schema vì chưa wire backend. Nói “web không tồn tại” là sai; nói “web chưa là contract consumer” mới đúng.

#### Package setup chưa bàn response contract

Câu hỏi tập trung vào việc move request schemas, nhưng Admin Web cần response schemas. Response types hiện nằm trong service files.

### 5.3 Verdict

File 1 là checklist tốt nhưng chưa phải quyết định kỹ thuật hoàn chỉnh. Dùng phần trả lời chính thức ở mục 8 của tài liệu này.

## 6. Phản biện file 2 — `be-dev-notes-phase0.md`

### 6.1 Repository setup

#### Stub package

Đúng: `packages/api-contract/package.json` tồn tại và là stub.

#### Manifest đề xuất

Các vấn đề:

- Zod `^3.23.0` lệch API `^3.24.0`.
- `main/types` trỏ raw `src/index.ts` không cần cho source-consumed workspace.
- wildcard `"./*": "./src/*.ts"` mở public surface quá rộng.
- root barrel dễ collision.
- thiếu package `typecheck` script.

Giải pháp:

- Zod `^3.24.0`;
- explicit subpath exports;
- standalone `tsconfig` + `noEmit`;
- không root barrel export toàn feature.

### 6.2 Mapping file cần move

Mapping plan không chính xác:

| Mục | Thực tế |
|---|---|
| `route-eta.schemas.ts` | Không có; có `route-eta.types.ts` |
| `retention.schemas.ts` | Không có; có `retention-policy.ts` |
| `runtime-controls.schemas.ts` | Không có; runtime code ở `src/server/runtime-controls` |
| `mechanic-profile.schemas.ts` | Không có file riêng; schemas nằm trong `motorcycle.schemas.ts` |
| `admin-operations.schemas.ts` | File thật là `admin.schemas.ts` |
| `notification.schemas.ts` | File thật là `notification-inbox.schemas.ts` |
| assignments | Plan bỏ sót `assignment-recovery.schemas.ts` |

### 6.3 “Copy nguyên nội dung” không khả thi

Một số schema import backend internals:

- auth schema phụ thuộc auth types và repository push providers;
- admin schema phụ thuộc auth và motorcycle schema;
- mechanic operations phụ thuộc assignment repository;
- diagnosis schema phụ thuộc component taxonomy;
- live tracking schema đọc `process.env`.

Copy nguyên file sẽ làm shared contract phụ thuộc backend hoặc Node runtime.

### 6.4 Chỉ move request schema không tạo contract đầy đủ

Admin response types nằm trong:

- `admin-user-management.service.ts`;
- `admin-mechanic-management.service.ts`;
- `admin-service-request.service.ts`;
- operational monitoring repository/service.

Frontend không thể parse response đúng nếu Phase 0 chỉ move input schemas.

### 6.5 Root barrel collision

Duplicate đã xác nhận:

```text
assignmentMediaPurposes
```

Nó được export từ mechanic operations và media upload schemas. `export *` mọi file sẽ gây collision/public API mơ hồ.

### 6.6 Delete schema files quá sớm

Không được xóa hàng loạt sau khi đổi một số imports. Phải:

1. migrate một domain;
2. scan mọi caller/test;
3. typecheck/test;
4. chỉ xóa định nghĩa cũ khi không còn reference.

### 6.7 Verification thiếu

API typecheck không bảo đảm package contract tự typecheck. Cần thêm:

```powershell
pnpm.cmd --filter @careonroad/api-contract typecheck
```

Và test response schema parse service output.

### 6.8 Verdict

Không thực thi notes này như một move-only recipe. Thay bằng admin-only HTTP contract extraction theo vertical slice.

## 7. Phản biện file 3 — `be-contract-refactor-and-admin-web.md`

### 7.1 Baseline Web/Mobile

Plan đúng khi target là `minh/mobile`:

- mock web `api-client.ts` có thật;
- marketing mock data có thật;
- Admin dashboard/components có thật;
- mobile API/service layer có thật;
- `app.config.ts`/`eas.json` có thật.

Plan không ghi rõ branch/commit, dẫn tới người đọc local branch cũ tưởng các file không tồn tại. Đây là lỗi governance/specification.

### 7.2 Phase 0

| Task | Verdict |
|---|---|
| T0.1 package | Đúng mục tiêu, sai manifest/export details |
| T0.2 move mọi schema | Quá rộng và thiếu response contract |
| T0.3 đổi mọi import | Rủi ro lớn; nên migrate từng domain |
| T0.4 workspace glob | Đúng rằng glob đã cover; vẫn phải khai báo `workspace:*` |
| T0.5 verify | Thiếu package typecheck và response contract tests |

Definition of Done “API không còn `*.schemas.ts`” không phải outcome có giá trị. Internal schemas không dùng bởi client vẫn có thể và nên ở API.

### 7.3 Phase 1 HTTP client

`apps/web/src/lib/api-client.ts` tồn tại nhưng là marketing content facade:

```text
getHeroHighlights
getHeroStats
listServiceCategories
listTestimonials
listNewsArticles
...
```

Không nên đổi các methods này thành admin backend calls. Giải pháp:

- giữ client marketing/mock;
- tạo `src/lib/api/server-client.ts`;
- tạo `src/lib/api/admin.ts`;
- server-only token boundary.

#### Error mapper sai

Plan/mobile reference dùng nested `error.code`; backend dùng top-level `error_code`.

#### Idempotency sai vòng đời

Generic HTTP client không được tự tạo key mỗi request attempt. Retry sẽ thành operation mới.

#### Auth stub không an toàn

Không đọc token tùy tiện từ localStorage/cookie. Dùng Supabase SSR official client và server verification.

### 7.4 Phase 2 read-only

Đúng:

- RSC/server-side fetch;
- server-only `API_BASE_URL`;
- users/mechanics/requests/operations endpoints.

Cần sửa:

- auth phải hoàn thành trước Phase 2;
- response phải parse Zod;
- dashboard component hiện có cần nhận typed props;
- readiness chỉ là health badge, không phải metrics source;
- không giữ admin table mock sau khi route được coi là live.

### 7.5 Phase 3 operations

Các component có thật và nên reuse. Tuy nhiên:

- `NeedsAttentionTable` và `BackgroundJobsTable` đang dùng hard-coded arrays;
- operational queues có item shapes khác nhau;
- không được unsafe-cast tất cả thành một type;
- backend cố ý redact payload/raw errors.

Mechanic filter phải dùng `active`, không `approved`.

### 7.6 Phase 4 mutations

Các route ghi sai:

| Plan | Route thật |
|---|---|
| `/users/{id}/grant-role` | `/users/{id}/roles/grant` |
| `/users/{id}/revoke-role` | `/users/{id}/roles/revoke` |
| `/users/{id}/devices/{deviceId}/revoke` | `/admin/devices/{deviceId}/revoke` |
| `/service-requests/{id}/internal-notes` | `/service-requests/{id}/notes` |

409 không luôn đồng nghĩa “request đã xử lý thành công”. Nó có thể là payload conflict hoặc in-progress conflict.

### 7.7 Phase 5 auth

Auth đặt sau read/mutations là sai dependency order. Admin pages không thể gọi protected endpoints đúng nếu chưa có:

- cookie session;
- token refresh;
- server verification;
- `/auth/me` role/status gate.

Auth phải chuyển lên trước mọi admin data wiring.

### 7.8 Mobile section

Đúng:

- mobile là workspace riêng;
- shared package root không tự ảnh hưởng mobile;
- mobile có hand-written types và drift thật.

Chưa tối ưu:

- merge mobile vào root workspace không cần thiết để sửa drift;
- Expo/React lane riêng là compatibility boundary có chủ ý;
- task Admin Web không nên kéo theo mobile migration.

Mobile drift đáng lưu ý:

- error body parser sai backend;
- `PaymentStatus` sai (`paid/expired` so với `succeeded/needs_review/created`);
- một số idempotency keys sinh lại mỗi service call;
- API base localhost cần LAN/device handling.

### 7.9 Ports

Remote API và mobile config đang dùng API port 3000. Web cũng mặc định 3000. Cách ít thay đổi nhất:

- API: 3000;
- Web: 3001.

### 7.10 Verdict

Giữ UI baseline và endpoint scope của plan, nhưng thay execution order và contract details. Không cần viết lại giao diện từ đầu.

## 8. Trả lời chính thức Q1–Q13

Phần này có thể gửi trực tiếp cho FE team.

### Q1 = 1d

Không move theo danh sách giả định. Chỉ extract HTTP contracts có consumer thật trong Admin Web:

- common error/pagination;
- auth actor;
- admin users;
- admin mechanics;
- admin service requests;
- admin operations;
- health.

Không đưa runtime-controls/retention/chatbot/route ETA vào Phase 0.

### Q2 = 2c + 2b về contract

Runtime controls đã implement tại:

```text
apps/api/src/server/runtime-controls/
```

Nó là backend runtime implementation, không phải client contract. Bỏ khỏi Phase 0 contract.

### Q3 = 3a có điều kiện

`apps/api/src/features/assignments/assignment-recovery.schemas.ts` có thật.

Nếu sau này assignment là client consumer, có thể export cùng assignments subpath với explicit names. Admin Web hiện chưa cần, nên không move trong admin-only phase.

### Q4

#### Q4a

Web trên `minh/mobile` chưa import admin/notification schemas vì chưa wire backend.

Backend imports:

- admin services/helpers → `admin.schemas.ts`;
- admin schema tests → `admin.schemas.ts`;
- notification inbox service → `notification-inbox.schemas.ts`.

#### Q4b

Migrate domain nào thì cập nhật source + tests domain đó trong cùng change. Public package dùng explicit subpath:

```ts
import { adminUserListQuerySchema } from "@careonroad/api-contract/admin/users";
```

Không cần đưa notifications vào Admin Web phase đầu.

### Q5 = 5a

Mechanic profile schemas nằm trong:

```text
apps/api/src/features/motorcycles/motorcycle.schemas.ts
```

Cụ thể `mechanicProfileUpdateSchema` và `mechanicAvailabilitySchema`. Không có file `mechanic-profile.schemas.ts` riêng.

### Q6 = 6a

Có cross-feature/backend imports. Ví dụ:

- admin → auth/motorcycles;
- service requests → motorcycles;
- mechanic operations → assignment repository;
- auth → user repository;
- diagnosis → component taxonomy.

Không chỉ đổi relative path; shared contract phải loại backend dependency.

### Q7

Có duplicate export:

```text
assignmentMediaPurposes
```

Dùng explicit subpath exports; không dùng root `export *`.

### Q8

Có nhiều source/test/helper import schema trực tiếp. Scan phải tìm:

```text
.schema
.schemas
relative imports
@/ alias imports
single/double quotes
```

Update tests song song với source.

### Q9a

Dùng Zod `^3.24.0`, khớp API. Không nâng major trong cùng refactor.

### Q9b

Không cần `@types/node` nếu contract đúng browser-safe. Nếu code cần Node type thì đó là dấu hiệu boundary sai.

### Q9c

Không dùng wildcard export. Dùng explicit subpaths:

```json
{
  "exports": {
    "./common": "./src/common.ts",
    "./auth": "./src/auth.ts",
    "./admin/users": "./src/admin-users.ts",
    "./admin/mechanics": "./src/admin-mechanics.ts",
    "./admin/service-requests": "./src/admin-service-requests.ts",
    "./admin/operations": "./src/admin-operations.ts",
    "./health": "./src/health.ts"
  }
}
```

### Q10a

Dùng standalone `tsconfig.json`; root không có shared tsconfig.

### Q10b

Không cần `composite`, declaration hoặc outDir trong source-consumed phase. Chỉ dùng `noEmit`.

### Q10c

API `tsc --noEmit` không thay thế package typecheck. Thêm:

```powershell
pnpm.cmd --filter @careonroad/api-contract typecheck
```

### Q11a

Có, API và Web phải khai báo:

```json
"@careonroad/api-contract": "workspace:*"
```

Workspace glob chỉ discover package, không tự khai báo dependency.

### Q11b

Người thực hiện Phase contract thêm dependency trong cùng atomic change, sau khi được phép cài/update lockfile.

### Q12

Trên `minh/mobile` có mock marketing API client nhưng chưa có admin client/env wiring.

Admin dùng:

```dotenv
API_BASE_URL=http://localhost:3000
```

Không dùng `NEXT_PUBLIC_API_BASE_URL` khi browser không gọi API trực tiếp.

### Q13a

- API: port 3000.
- Web: port 3001.

### Q13b

Tạo `apps/web/.env.example`:

```dotenv
API_BASE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Không thêm service-role key, worker secret hoặc database URL.

## 9. Trả lời open questions khác trong plan

### Supabase publishable key có cần không?

Có, nếu Web dùng Supabase login. Chỉ publishable key được đưa vào `NEXT_PUBLIC_*`. Không dùng service-role key.

### Admin có cần 2FA không?

Không trong scope hiện tại. Không tự mở rộng.

### `INTERNAL_WORKER_SECRET` có cần cho Admin Web không?

Không. Admin operations endpoints dùng admin JWT. Worker secret chỉ dành internal worker routes và không được xuất hiện trong web.

### Có nên dùng OpenAPI generate client?

Không trong phase này. Spec có 85 roadmap operations, rộng hơn UI/implemented subset cần dùng. Dùng allowlist adapter cho route đang tồn tại.

### Có nên merge mobile vào root workspace?

Không trong task Admin Web. Giữ Expo/React compatibility lane riêng.

## 10. Ma trận vấn đề, nguyên nhân và quyết định

| ID | Vấn đề | Nguyên nhân | Quyết định |
|---|---|---|---|
| F01 | Local thiếu FE nhưng plan có FE | Sai branch baseline | Base implementation từ `minh/mobile` |
| F02 | `main` tụt 12 commit | Branch governance chưa rõ | Chốt integration branch/PR trước code |
| F03 | Move toàn schema | Đồng nhất validation với contract | Admin-only HTTP contract |
| F04 | Thiếu response schemas | Types nằm trong services | Extract/define response schemas |
| F05 | Backend imports trong schema | Boundary không portable | Contract package thuần Zod/TS |
| F06 | Root export collisions | Barrel quá rộng | Explicit subpaths |
| F07 | Error parser sai | Dùng mobile/mock làm reference | Dùng backend `api-error.ts` |
| F08 | Pagination sai | Plan tự suy shape | Dùng `items/page` |
| F09 | Route mutations sai | Dựa roadmap/naming | Đối chiếu route files |
| F10 | Mechanic `approved` | Nhầm action với state | API `active`, UI label tùy chọn |
| F11 | Auth đặt Phase 5 | Sai dependency order | Auth-first |
| F12 | Token ở generic browser client | Boundary không an toàn | Server-only admin client |
| F13 | Idempotency key mỗi request | Nhầm request với user intent | Key giữ qua retry |
| F14 | Health làm metrics | Nhầm operational readiness | Chỉ health badge |
| F15 | Web/API cùng port | Hai Next dev defaults | API 3000, Web 3001 |
| F16 | Marketing client bị đổi semantics | Một facade cho hai domain | Giữ mock client; admin module riêng |
| F17 | Mobile merge kéo scope | Muốn giải type drift bằng workspace refactor | Tách mobile workstream |

## 11. Quyết định kiến trúc đề xuất

```text
minh/mobile hoặc successor
        │
        ├─ reuse Web/Admin UI hiện có
        │
        ├─ packages/api-contract
        │    └─ chỉ admin/auth/common/health contracts
        │
        ├─ Supabase SSR auth
        │    └─ /api/v1/auth/me xác nhận active admin
        │
        ├─ server-only admin API client
        │
        ├─ read-only pages
        │
        └─ mutations có stable idempotency key
```

Thứ tự đúng:

1. Chốt branch/base.
2. Admin-only contract.
3. Auth + server client.
4. Read-only dashboard/lists/details.
5. Mutations.
6. Verification.

Không thực hiện “all-feature schema move” trước khi có consumer.

## 12. Checklist quyết định cho FE/BE lead

### Branch

- [ ] Xác nhận `minh/mobile` hoặc successor là integration base.
- [ ] Không code từ `main@b762dc4` hoặc local `78c17c1`.
- [ ] Merge branch vào main là PR riêng, không force-push.

### Contract

- [ ] Chấp nhận admin-only scope.
- [ ] Chấp nhận explicit subpath exports.
- [ ] Chấp nhận response schema là bắt buộc.
- [ ] Zod giữ `^3.24.0`.
- [ ] API/Web khai báo `workspace:*`.

### Web

- [ ] Giữ marketing mock client.
- [ ] Admin client server-only.
- [ ] Auth thực hiện trước data wiring.
- [ ] API 3000, Web 3001.
- [ ] Reuse Admin components hiện có.

### Security

- [ ] `/auth/me` là app-role authority.
- [ ] Không service-role key/worker secret trong web.
- [ ] Không browser token logging/storage.
- [ ] Idempotency key theo user intent.

### Scope

- [ ] Không mobile migration.
- [ ] Không payment/maps/mechanic UI.
- [ ] Không generate toàn bộ OpenAPI client.

## 13. Kết luận cuối

Ba tài liệu FE không “sai toàn bộ”. Chúng mô tả đúng nhiều file trên branch `minh/mobile`, nhưng thiếu branch/commit context và có nhiều giả định contract không khớp backend thật.

Các phần giữ lại:

- UI Admin hiện có;
- nhu cầu shared contract;
- endpoint groups users/mechanics/service requests/operations;
- server-side fetch;
- reason/idempotency requirement;
- mobile nằm ngoài scope trực tiếp.

Các phần phải thay:

- all-feature schema move;
- root barrel/wildcard exports;
- error/pagination shapes;
- route mutation paths;
- mechanic status;
- generic idempotency generation;
- auth-last ordering;
- readiness-as-metrics;
- mobile merge proposal.

Quyết định tối ưu: **base đúng branch, contract hẹp nhưng đầy đủ, auth trước, admin fetch server-side, reuse UI, và chỉ mở mutation sau khi read-only flow đã pass.**

## 14. Nguồn bằng chứng

GitHub:

- `https://github.com/CareOnRoad/CareOnRoad-Application`
- `https://github.com/CareOnRoad/CareOnRoad-Application/tree/78f98c94a4043c4a90da50ed0d40aa892d0e1c28`
- `https://github.com/CareOnRoad/CareOnRoad-Application/commit/78f98c94a4043c4a90da50ed0d40aa892d0e1c28`
- `https://github.com/CareOnRoad/CareOnRoad-Application/commit/626626b2330da497d10685b81fef1d3bca727aaa`

Backend:

- `apps/api/src/lib/api-error.ts`
- `apps/api/src/features/auth/auth.types.ts`
- `apps/api/src/features/admin/admin.schemas.ts`
- `apps/api/src/features/admin/admin-user-management.service.ts`
- `apps/api/src/features/admin/admin-mechanic-management.service.ts`
- `apps/api/src/features/admin/admin-service-request.service.ts`
- `apps/api/src/features/operations/operational-monitoring.service.ts`
- `apps/api/src/features/health/health.service.ts`
- `apps/api/app/api/v1/admin/**/route.ts`

Frontend tại `minh/mobile`:

- `apps/web/src/lib/api-client.ts`
- `apps/web/src/lib/mock-data.ts`
- `apps/web/src/proxy.ts`
- `apps/web/src/app/admin/dashboard/page.tsx`
- `apps/web/src/components/admin/*`
- `apps/mobile/src/lib/api.ts`
- `apps/mobile/src/lib/*-service.ts`
- `apps/mobile/app.config.ts`
- `apps/mobile/eas.json`
