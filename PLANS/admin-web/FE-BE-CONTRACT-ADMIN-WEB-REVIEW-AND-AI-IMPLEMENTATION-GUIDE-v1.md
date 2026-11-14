# Phản biện tài liệu FE–BE contract và hướng dẫn triển khai Admin Web


## 1. Mục tiêu và phạm vi

Tài liệu này ghi lại, kiểm chứng và phản biện ba tài liệu do frontend team cung cấp:

1. `2026-09-27-open-questions-for-be-dev.md`
2. `2026-09-27-be-dev-notes-phase0.md`
3. `2026-09-27-be-contract-refactor-and-admin-web.md`

Ba file trên được xem là **đầu vào cần review**, không phải mệnh lệnh thực thi. Khi có mâu thuẫn, thứ tự ưu tiên bằng chứng là:

1. Route, service, repository, test và migration đang chạy trong codebase.
2. Contract/spec đã được test khóa trong repo.
3. `AGENTS.md`, README và package configuration hiện tại.
4. Ba tài liệu FE nêu trên.

Phạm vi giải pháp tối ưu trong tài liệu này là:

- contract dùng chung **chỉ cho Admin Web và những kiểu HTTP thật sự được dùng**;
- xác thực Supabase theo hướng server-first;
- API client chỉ chạy phía server của Next.js;
- các trang quản trị người dùng, thợ, yêu cầu cứu hộ và operational monitoring;
- không refactor toàn bộ backend, không nhập mobile vào root workspace, không dựng trước payment/maps/mechanic UI.

## 2. Kết luận điều hành

### Quyết định

**Không triển khai kế hoạch trong ba file gốc theo nguyên trạng.** Kế hoạch đó có ý đúng về việc giảm drift contract, nhưng baseline và nhiều giả định triển khai không khớp codebase thật.

Phương án nên làm là:

1. Giữ nguyên ranh giới monorepo hiện tại.
2. Chỉ trích xuất contract HTTP cần cho Admin Web; không di chuyển hàng loạt schema của 16–21 feature.
3. Xây auth trước, rồi API client server-only, rồi trang read-only, cuối cùng mới mở mutation.
4. Dùng response/error/pagination thật của backend, không dùng shape do tài liệu FE suy đoán.
5. Không để frontend giữ `SUPABASE_SERVICE_ROLE_KEY` hoặc `INTERNAL_WORKER_SECRET`.
6. Không xem toàn bộ 85 operation trong OpenAPI roadmap là endpoint đã triển khai.

### Baseline đã kiểm chứng

- API typecheck/build đã qua.
- API unit/static/route suite đã qua: **164 test files, 512 tests**.
- Web lint/build đã qua ở trạng thái skeleton hiện tại.
- `apps/web` chỉ là Create Next App skeleton; chưa có admin UI, auth client, API client hay component nghiệp vụ.
- `apps/mobile` đang là mock UI boundary độc lập; chưa có service layer như tài liệu mô tả.
- `packages/api-contract/package.json` mới là stub; chưa phải package contract dùng được.

Kết quả pass ở trên chứng minh backend baseline hiện tại nhất quán với test của repo. Nó **không** chứng minh các giả định trong tài liệu FE là đúng.

## 3. Nội dung chính của ba tài liệu và verdict

### 3.1 `2026-09-27-open-questions-for-be-dev.md`

#### Nội dung được đề xuất

File này đặt câu hỏi về:

- feature/schema nào phải chuyển sang `packages/api-contract`;
- vị trí của `runtime-controls` và `route-eta`;
- file assignments schema;
- cách frontend đang import admin/notification schema;
- khả năng có dependency vòng;
- duplicate export;
- test nào đang import trực tiếp schema;
- phiên bản Zod, TypeScript config và package exports;
- cách workspace dependency hoạt động;
- biến môi trường và port của web/API.

#### Verdict

**Hữu ích về mặt checklist, nhưng một số câu hỏi xuất phát từ baseline sai và câu trả lời lựa chọn sẵn không đủ chính xác.** Đặc biệt:

- Q2 sai khi giả định `runtime-controls` không tồn tại hoặc chưa rõ vị trí.
- Lệnh dò import chỉ nhắm `../` sẽ bỏ sót alias `@/...`.
- Chỉ tìm `.schema` sẽ bỏ sót phần lớn file có hậu tố `.schemas.ts`.
- Câu hỏi về frontend import admin/notifications giả định một frontend nghiệp vụ đã tồn tại; thực tế web đang là skeleton.

Kết luận: giữ file này làm checklist thảo luận, nhưng dùng câu trả lời đã hiệu chỉnh tại mục 7 của tài liệu này.

### 3.2 `2026-09-27-be-dev-notes-phase0.md`

#### Nội dung được đề xuất

File này mô tả một Phase 0 để:

- tạo package contract dùng chung;
- chuyển/copy nhiều schema khỏi `apps/api`;
- cập nhật import backend;
- cấu hình Zod/TypeScript/package exports;
- xác minh typecheck/build.

#### Verdict

**Không thể thực thi an toàn theo nguyên trạng.** Các vấn đề chính:

- tham chiếu một số file hoặc tầng frontend không tồn tại;
- coi request schema như thể đã là contract đầy đủ, trong khi response type chủ yếu nằm trong service;
- không xử lý dependency backend-only trong schema;
- package manifest/exports chưa đủ chặt và có nguy cơ public raw TypeScript sai cách;
- DoD chưa kiểm tra package contract độc lập;
- không dự liệu duplicate symbol khi dùng barrel `export *`;
- phạm vi refactor quá rộng so với consumer hiện có.

Kết luận: thay Phase 0 “move all” bằng “extract admin-only HTTP contract” tại mục 9.

### 3.3 `2026-09-27-be-contract-refactor-and-admin-web.md`

#### Nội dung được đề xuất

File này kết hợp:

- refactor contract backend;
- tạo admin web;
- tạo API client, auth, dashboard và CRUD/mutation;
- dự kiến chỉnh mobile/service layer;
- định nghĩa error, pagination, health/metrics và idempotency.

#### Verdict

**Cần viết lại toàn bộ execution plan.** Danh sách endpoint backend ở mức cao tương đối gần với code thật, nhưng phần web/mobile/auth và nhiều shape HTTP không đúng:

- admin web được mô tả như đã có component và data layer, nhưng repo không có;
- mobile service files được mô tả như đã có, nhưng repo không có và lịch sử Git cũng không cho thấy từng có;
- error shape và pagination shape bị ghi sai;
- một số route mutation sai;
- trạng thái mechanic `approved` không tồn tại trong backend hiện tại;
- readiness bị dùng như business metrics;
- idempotency key bị đặt sai vòng đời;
- đề xuất merge mobile vào root workspace đi ngược ranh giới runtime hiện tại.

Kết luận: dùng kiến trúc và runbook tại mục 8–14 thay cho plan gốc.

### 3.4 Verdict theo từng task của plan gốc

| Task gốc | Verdict | Điều chỉnh bắt buộc |
|---|---|---|
| T0.1 tạo package | Đúng mục tiêu, sai chi tiết | Dùng Zod `^3.24.0`, tsconfig độc lập, explicit subpath exports, có script typecheck |
| T0.2 move toàn bộ schemas | Sai phạm vi | Chỉ extract admin HTTP contract có consumer; không giả lập 20 file đích |
| T0.3 đổi mọi import BE | Quá rộng | Migrate từng admin domain, test xanh rồi mới bỏ định nghĩa cũ |
| T0.4 workspace glob | Đúng một phần | Glob đã cover package nhưng consumer vẫn phải khai báo `workspace:*` |
| T0.5 verify BE | Thiếu | Thêm contract typecheck và web typecheck/build; `pnpm install` cần approval khi dependency thay đổi |
| T1.1 HTTP client browser/general | Sai boundary | Tạo server-only `apiFetch`; không phát token/client URL ra browser |
| T1.2 error mapper | Sai body | Đọc `error_code`, không phải `code`; không suy code từ status nếu backend đã trả controlled code |
| T1.3 switch mock/live | Không có baseline để giữ | `api-client.ts` và mock-data được mô tả không tồn tại; admin đi thẳng live server-side |
| T1.4 auth stub | Sai thứ tự và không an toàn | Không đọc token từ localStorage/cookie thủ công; làm Supabase SSR auth thật trước data wire |
| T2.1 admin API | Đúng hướng | Dùng contract subpaths thật và allowlist route hiện có |
| T2.2 RSC fetch | Đúng hướng | Dùng `API_BASE_URL`, token server-side, `no-store`, timeout và response parse |
| T2.3 dashboard components | Sai baseline và data source | Components không tồn tại; readiness chỉ làm health badge, không làm metrics |
| T2.4 users page | Hợp lý | Làm sau auth gate; dùng `items/page`, không dùng response giả |
| T3.1/T3.2 operations tables | Hợp lý về endpoint | Tạo UI mới thay vì “wire component hiện có”; không lộ event payload/raw worker errors |
| T3.3 mechanics | Hợp lý, sai enum | Filter `pending/active/rejected/suspended/banned`; `approved` chỉ là nhãn UI nếu cần |
| T3.4 service requests | Hợp lý | Đọc các endpoint detail phụ theo tab/nhu cầu, không tải mọi thứ mặc định |
| T4.1 mutation helpers | Đúng nhu cầu, sai idempotency | Key thuộc một user intent và phải giữ qua retry; không tự sinh mỗi HTTP attempt |
| T4.2 mechanic actions | Hợp lý | Render action theo state/permission backend; validate reason bằng schema thật |
| T4.3 user actions | Sai path | Dùng `/roles/grant`, `/roles/revoke`, `/admin/devices/{deviceId}/revoke` |
| T4.4 request actions | Sai notes path | Dùng `/notes`, không dùng `/internal-notes` |
| T4.5 error handling | Chưa đủ | Tách 401/403/404/409/429/timeout/schema mismatch; 409 không luôn có nghĩa “đã xử lý” |
| T5.1/T5.2 auth cuối plan | Sai thứ tự | Auth phải đứng trước mọi admin data fetch và mutation |
| T5.3 verify | Đúng hướng | Chạy đúng script thật; root `typecheck` hiện chỉ kiểm tra API nên phải thêm web/contract riêng |
| T5.4 update docs/script | Optional thật sự | Chỉ làm sau implementation; không tạo contract checker phức tạp nếu typecheck/test đã đủ |
| Phase 6 mobile merge | Không chấp nhận trong scope | Mobile có workspace/runtime compatibility lane riêng và các file được viện dẫn không tồn tại |

### 3.5 Verdict cho notes Phase 0

- “Kiểm tra stub trước khi ghi”: đúng và đã xác nhận stub tồn tại.
- Manifest dùng raw `main/types/index.ts` + wildcard exports: không nên dùng cho thiết kế này.
- Tạo root `index.ts` export mọi feature: rủi ro collision và public API phình to.
- Mapping file move: sai ở mechanic-profile, notification/admin naming, các feature không có schema, và bỏ sót assignment recovery.
- “Copy nguyên nội dung”: không khả thi với file import backend internals hoặc `process.env`.
- Typecheck sau mỗi feature: đúng thực hành, nhưng cần contract typecheck riêng.
- Xóa schema cũ ngay sau đổi import: chỉ làm sau khi `rg` + test chứng minh không còn caller; không xóa hàng loạt.
- Commit sau nhiều feature: kém cô lập; nên commit theo vertical domain nhỏ.
- Wire-shape inspect thủ công: chưa đủ; cần response schema/route test.
- Pitfalls P1–P5: nhận diện đúng nhóm rủi ro, nhưng command scan cần hỗ trợ Windows, alias import và cả `.schema.ts`/`.schemas.ts`.

## 4. Bằng chứng codebase có thật

### 4.1 Web chưa có admin implementation

`apps/web` hiện chỉ có các file ứng dụng chính:

- `apps/web/src/app/page.tsx`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/globals.css`
- asset mặc định trong `apps/web/public`

`apps/web/src/app/page.tsx:3` vẫn là trang Home mặc định. Không tồn tại:

- `src/lib/api-client.ts`;
- `src/lib/supabase/*`;
- `src/components/admin/*`;
- `AdminLayout`;
- `MetricsBento`;
- route `/admin/*`;
- mock-data nghiệp vụ được mô tả trong plan.

`apps/web/package.json` chỉ có dependency cơ bản Next/React; chưa có Zod hay Supabase SDK.

Lịch sử Git trên các branch local/remote đã được dò và không cho thấy các đường dẫn admin/API client nói trên từng tồn tại.

**Hệ quả:** không được viết task dạng “refactor/replace existing admin client”. Đây là greenfield admin UI trên một skeleton.

### 4.2 Mobile chưa có service layer như mô tả

Không tìm thấy các file được tài liệu giả định như:

- `api.ts`;
- thư mục services với 19 wrapper;
- `PaymentStatus`;
- `eas.json`;
- `app.config.ts`.

Mobile hiện dùng `app.json`, mock data/types/utils và có ranh giới Expo/React riêng. README cũng ghi frontend chưa được nối lại backend và mobile được giữ như một compatibility lane riêng.

**Hệ quả:** không được thêm “Phase merge mobile into root workspace” vào công việc Admin Web.

### 4.3 Contract package hiện chỉ là stub

`packages/api-contract/package.json` hiện chỉ khai báo name/version/private. Nó chưa có:

- source files;
- exports;
- typecheck script;
- dependency Zod;
- consumer dependency trong API/web.

Root workspace có `apps/api`, `apps/web`, `packages/*`, nhưng pnpm workspace discovery **không tự động biến package thành dependency**. Mỗi consumer vẫn phải khai báo `"@careonroad/api-contract": "workspace:*"`.

### 4.4 Schema hiện tại không phải HTTP contract hoàn chỉnh

Codebase có 16 file `*.schemas.ts`, cộng thêm chatbot `diagnosis.schema.ts` và `message.schema.ts`. Tuy nhiên:

- phần lớn là input/query validation;
- response type thường nằm trong service;
- một số schema import backend repository type;
- một số schema đọc `process.env`;
- barrel export toàn bộ sẽ gây collision.

Ví dụ dependency không portable:

- `apps/api/src/features/auth/auth.schemas.ts:3-4` phụ thuộc auth type và `pushProviders` từ repository.
- `apps/api/src/features/admin/admin.schemas.ts:3-4` phụ thuộc auth type và motorcycle schema.
- `apps/api/src/features/service-requests/service-request.schemas.ts:3` phụ thuộc motorcycle schema.
- `apps/api/src/features/mechanic-operations/mechanic-operations.schemas.ts:3-4` phụ thuộc assignment repository.
- `apps/api/src/features/chatbot/diagnosis.schema.ts:3` phụ thuộc component taxonomy.
- `apps/api/src/features/live-tracking/live-tracking.schemas.ts:21+` đọc `process.env` khi tạo schema.

Response type admin hiện nằm trong:

- `apps/api/src/features/admin/admin-user-management.service.ts:27+`;
- `apps/api/src/features/admin/admin-mechanic-management.service.ts:32+`;
- `apps/api/src/features/admin/admin-service-request.service.ts:39+`.

**Hệ quả:** “copy schema folder sang package” không đủ; phải thiết kế contract tại HTTP boundary gồm request, query, response, error và pagination.

### 4.5 Duplicate export có thật

Tên `assignmentMediaPurposes` xuất hiện ở cả:

- `apps/api/src/features/mechanic-operations/mechanic-operations.schemas.ts:98`;
- `apps/api/src/features/media-uploads/media-upload.schemas.ts:9`.

**Hệ quả:** root barrel `export *` từ mọi feature có thể lỗi hoặc tạo public API mơ hồ. Dùng explicit subpath exports.

### 4.6 Error body thật

`apps/api/src/lib/api-error.ts:30-47` trả:

```json
{
  "error_code": "INVALID_INPUT",
  "message": "...",
  "request_id": "optional",
  "details": "optional"
}
```

Không phải `{ "code": "..." }`.

**Hệ quả:** API client phải ưu tiên `error_code`; dùng `code` sẽ làm mất semantic error và phá UX mapping.

### 4.7 Pagination thật

Các admin list service trả dạng:

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

Không phải `{ "data": [], "next_cursor": "..." }`.

**Hệ quả:** table loader, cursor navigation và response schema phải dùng `items` + `page`.

### 4.8 Route mutation và status thật

Các route bị ghi sai/không chính xác trong plan:

| Nghiệp vụ | Route đúng |
|---|---|
| Grant role | `POST /api/v1/admin/users/{userId}/roles/grant` |
| Revoke role | `POST /api/v1/admin/users/{userId}/roles/revoke` |
| Revoke device | `POST /api/v1/admin/devices/{deviceId}/revoke` |
| Add internal note | `POST /api/v1/admin/service-requests/{requestId}/notes` |

Mechanic status backend hiện dùng:

```text
pending | active | rejected | suspended | banned
```

Không có status `approved`; `approve` là action chuyển mechanic sang `active`.

### 4.9 Runtime controls và route ETA

`runtime-controls` đã tồn tại ở `apps/api/src/server/runtime-controls/*`, gồm in-memory/PostgreSQL store, rate limiter, circuit breaker, factory và test. Đây là runtime implementation backend, không phải HTTP contract cho frontend.

`route-eta` có `route-eta.types.ts` nhưng chưa có lý do để đưa vào Admin Web contract nếu UI admin chưa sử dụng endpoint đó.

**Hệ quả:** loại cả hai khỏi Phase 0 Admin Web. Chỉ thêm route ETA contract khi có consumer thật.

### 4.10 OpenAPI là roadmap rộng hơn implementation cần dùng

`specs/003-careonroad-admin-operations/contracts/admin-api.yaml` tồn tại và test đang khóa 85 operation. Nó là nguồn tham khảo tốt cho naming và roadmap, nhưng không được hiểu rằng cả 85 operation đều là phạm vi Admin Web hiện tại.

**Hệ quả:** allowlist client theo route files đang tồn tại; không generate/bật UI cho toàn bộ spec.

### 4.11 Auth actor thật

`GET /api/v1/auth/me` trả `RequestActor`:

```ts
type RequestActor = {
  id: string;
  display_name?: string;
  roles: ("rider" | "mechanic" | "admin")[];
  status: "active" | "suspended" | "archived";
};
```

Backend tự xác thực Bearer JWT và trả 401/403/404 theo trạng thái. Frontend không được chỉ nhìn metadata trong cookie để tự kết luận user là admin; nó phải gọi `/api/v1/auth/me` và kiểm tra `roles.includes("admin")` cùng `status === "active"`.

## 5. Ma trận phản biện chi tiết

| ID | Nhận định/đề xuất trong tài liệu FE | Verdict | Nguyên nhân | Giải pháp tối ưu |
|---|---|---|---|---|
| R01 | Admin web/component/API client đã có để refactor | Sai | `apps/web` chỉ là skeleton; Git history không có các file nêu ra | Lập task greenfield, bắt đầu từ auth và server API client |
| R02 | Mobile có 19 service wrapper và payment status | Sai | Không có file/path tương ứng | Loại mobile khỏi scope Admin Web; không “sửa” code chưa tồn tại |
| R03 | Chuyển toàn bộ feature schema vào shared package | Không tối ưu | Request schema không chứa response contract; nhiều dependency backend-only | Extract admin-only HTTP boundary contract |
| R04 | `runtime-controls` là schema cần tìm/chuyển | Sai | Nó là backend runtime store/circuit/rate-limit | Giữ ở API; không export cho browser |
| R05 | Route ETA/retention phải nằm Phase 0 | Chưa có nhu cầu | Admin UI hiện chưa có consumer | YAGNI; thêm khi có màn hình dùng thật |
| R06 | Root barrel `export *` là đủ | Sai/rủi ro | Có duplicate symbol, dễ vô tình public internal type | Dùng explicit package subpath exports |
| R07 | Error body dùng `code` | Sai | Backend dùng `error_code` | Chuẩn hóa `ApiErrorBody` theo code hiện tại |
| R08 | List response dùng `data/next_cursor` | Sai | Service trả `items/page` | Dùng `CursorPage<T>` đúng shape |
| R09 | Role/device/note route theo đường dẫn rút gọn | Sai | Route files dùng `/roles/grant`, `/admin/devices`, `/notes` | Adapter dùng path đúng; route-level smoke test |
| R10 | Mechanic status `approved` | Sai | Backend status là `active`; approve là action | Filter `active`, label UI có thể hiển thị “Đã duyệt” |
| R11 | Health readiness dùng làm dashboard metrics | Sai mục đích | Health chỉ trả deployment/config/database readiness đã redact | Hiển thị status badge; metrics nghiệp vụ lấy từ list/ops hoặc endpoint riêng sau này |
| R12 | Tạo idempotency key bên trong generic retry wrapper | Sai semantic | Mỗi lần retry sinh key mới thì backend không thể replay cùng operation | Sinh key một lần cho user intent, giữ qua retry, thay khi bắt đầu intent mới |
| R13 | Đặt worker secret/service-role key ở web | Nguy hiểm | Đây là quyền vượt user auth | Cấm đưa vào web; operational reads dùng admin JWT |
| R14 | Dùng public env cho API base URL | Không tối ưu ban đầu | API client nên server-only; public URL mở thêm attack surface/coupling | Dùng `API_BASE_URL` server-only |
| R15 | Web/API cùng port 3000 | Sai vận hành | Cả hai script mặc định dùng `next dev` | Web 3000, API 3001 |
| R16 | Workspace tự link package contract | Sai | pnpm chỉ link dependency được khai báo | Thêm `workspace:*` vào từng consumer |
| R17 | Chỉ chạy API typecheck là đủ | Sai | Package contract và web có thể lỗi độc lập | Mỗi package có typecheck; build API + web |
| R18 | Import scan `../` và `.schema` là đủ | Sai | Alias `@/` và hậu tố `.schemas.ts` phổ biến | Dò cả alias, package import, `.schema` và `.schemas` |
| R19 | Merge mobile vào root workspace | Không phù hợp | Mobile đang là compatibility lane Expo/React riêng | Giữ ranh giới; chỉ thay khi có dự án migration riêng |
| R20 | Generate client cho mọi OpenAPI operation | Rủi ro | Spec rộng hơn phạm vi implemented/current UI | Allowlist route hiện có; bổ sung theo vertical slice |

## 6. Nguyên nhân gốc

Các sai lệch không đến từ một lỗi đơn lẻ, mà từ bốn nguyên nhân:

1. **Baseline không được kiểm chứng trước khi lập kế hoạch.** Tên component/file được viết như thể đã tồn tại.
2. **Đồng nhất “validation schema” với “API contract”.** Contract HTTP phải chứa cả input, output, error, pagination và semantic action.
3. **Trộn roadmap với hiện trạng.** OpenAPI/plan rộng hơn route cần triển khai ngay.
4. **Trộn ba boundary độc lập.** Backend runtime, Admin Web và Expo mobile có lifecycle/dependency khác nhau.

Fix gốc là thu nhỏ phạm vi theo một vertical slice chạy được: **admin auth → read-only lists/details → mutation có idempotency**.

## 7. Trả lời đầy đủ các câu hỏi trong tài liệu FE

### Q1. Chuyển schema feature nào vào contract package?

Chọn phương án tương đương **1d: không di chuyển theo một danh sách giả định**. Chỉ trích xuất HTTP contract có consumer hiện tại.

Phase đầu chỉ cần:

- common error/pagination;
- auth actor;
- admin users;
- admin mechanics;
- admin service requests;
- admin operations;
- health status nếu dashboard hiển thị badge.

Không đưa retention/runtime-controls vào. Route ETA chỉ thêm khi client thật sự dùng. Chatbot giữ boundary riêng.

### Q2. `runtime-controls` ở đâu?

Nó tồn tại ở `apps/api/src/server/runtime-controls/*` và là backend-only. Không chuyển vào contract package.

### Q3. Assignments schema có tồn tại không?

Có `apps/api/src/features/assignments/assignment-recovery.schemas.ts`. Về mapping, **3a là hợp lý** nếu assignment recovery trở thành contract client cần dùng: đặt cùng subpath assignments nhưng export có tên rõ ràng. Tuy nhiên Admin Web phase đầu không nên kéo file này sang package nếu chưa có consumer. Collision thật cần chú ý ở hiện tại là `assignmentMediaPurposes` giữa mechanic operations và media upload.

### Q4. Naming `admin.schemas.ts` và `notification-inbox.schemas.ts` xử lý thế nào?

Q4a: web không import hai schema này vì web chưa có nghiệp vụ. Trong backend, admin services/helpers import `./admin.schemas`; `admin-schemas.test.ts` import `../admin.schemas`; notification inbox service import `./notification-inbox.schemas`.

Q4b: khi trích xuất domain nào thì phải cập nhật source và test của domain đó trong cùng change. Tên public ổn định nên là subpath kiểu:

```ts
import { adminUserListQuerySchema } from "@careonroad/api-contract/admin";
```

Notification chưa cần đưa vào phase Admin Web đầu tiên.

### Q5. `mechanic-profile.schemas.ts` nằm ở đâu?

Chọn **5a**. Không có file riêng; `mechanicProfileUpdateSchema` và `mechanicAvailabilitySchema` nằm trong `apps/api/src/features/motorcycles/motorcycle.schemas.ts:23-48`. Nếu sau này đưa chúng vào shared contract thì có thể đặt dưới domain motorcycles/mechanics theo HTTP ownership đã chọn; không tạo một file nguồn backend giả chỉ để khớp plan.

### Q6. Có dependency chéo không?

Có. Ví dụ admin → auth/motorcycles, service-request → motorcycles; một số schema còn phụ thuộc repository type. Dò chỉ `../` là thiếu vì repo dùng alias `@/`.

### Q7. Có duplicate export không?

Có: `assignmentMediaPurposes`. Tránh root barrel rộng. Mỗi domain dùng subpath export rõ ràng.

### Q8. Test nào import schema trực tiếp?

Có ít nhất 10 feature tests, 2 repository tests và helper import trực tiếp schema theo kết quả scan trước đó. Khi migration phải tìm cả hai pattern `.schema` và `.schemas`.

### Q9a. Phiên bản Zod?

Dùng cùng major/minor với API hiện tại: `^3.24.0`. Không nâng Zod trong cùng PR contract extraction.

### Q9b. Có cần `@types/node` trong contract package không?

Không, nếu package thuần/browser-safe đúng thiết kế. Không dùng `node:*`, `process.env`, Buffer, repository hoặc Next type.

### Q9c. Package exports thế nào?

Không dùng wildcard/barrel toàn cục. Dùng explicit subpaths. Nếu workspace source-consumed, không cần khai báo `main/types` trỏ vào raw TS; để TypeScript/bundler theo `exports`.

### Q10a. Có cần tsconfig riêng?

Có.

### Q10b. Có cần `composite`, declaration, outDir?

Không trong phase source-consumed. Chỉ cần `noEmit` typecheck. Thêm build/declaration khi package cần publish hoặc consumer không transpile workspace source.

### Q10c. API typecheck có kiểm tra package không?

Không đảm bảo. Package contract phải có script `typecheck` riêng và được chạy trực tiếp.

### Q11. Workspace dependency có tự động link không?

Không. Thêm `"@careonroad/api-contract": "workspace:*"` vào `apps/api/package.json` và `apps/web/package.json`. `workspace:*` buộc resolution về local workspace package và tránh vô tình tải package cùng tên từ registry. Tham khảo [pnpm workspace protocol](https://pnpm.io/workspaces).

### Q12. Web đã có env/API client chưa?

Chưa. Nên dùng `API_BASE_URL` server-only trước; không dùng `NEXT_PUBLIC_API_BASE_URL` trừ khi có use case browser gọi thẳng API được phê duyệt.

### Q13a. Port nào?

- Admin Web: `3000`.
- API: `3001`.

### Q13b. Cần env example nào?

Tạo `apps/web/.env.example` gồm tên biến, không điền secret thật:

```dotenv
API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

### Câu hỏi auth/security bổ sung trong plan

- Dùng Supabase publishable key cho browser; không bao giờ dùng service-role key.
- 2FA không thuộc scope hiện tại.
- `INTERNAL_WORKER_SECRET` không được đưa vào web; các route operations read-only dùng admin JWT.

## 8. Kiến trúc đích tối thiểu

```text
Browser
  │  Supabase cookie session
  ▼
Next.js Admin Web :3000
  ├─ Server Components: read data
  ├─ Server Actions: mutations
  ├─ Supabase SSR server client: refresh/verify session
  └─ server-only apiFetch: Bearer access token + Zod response parse
          │
          ▼
Next.js API :3001
  ├─ Supabase JWT verification
  ├─ GET /api/v1/auth/me: app actor + admin role
  ├─ /api/v1/admin/**
  └─ PostgreSQL repositories / audit / outbox / idempotency
```

Các nguyên tắc bắt buộc:

- Browser không gọi API backend trực tiếp trong phase đầu.
- Token không đi vào Client Component props, localStorage hoặc log.
- Web không có service-role key và worker secret.
- Backend vẫn là nơi quyết định authorization; layout guard chỉ là UX/early redirect.
- Response từ API được parse ở trust boundary trước khi render.
- Không tạo BFF route trùng lặp nếu Server Component/Server Action đã đáp ứng.

Supabase khuyến nghị Next.js SSR dùng cookie-based auth và tách browser/server clients. Với authorization phía server, không tin session payload chưa verify; dùng cơ chế xác minh server phù hợp rồi vẫn gọi `/api/v1/auth/me` để lấy app role. Tham khảo:

- [Supabase SSR guide](https://supabase.com/docs/guides/auth/server-side)
- [Creating Supabase clients for Next.js](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs&queryGroups=framework)

## 9. Runbook cực chi tiết cho AI code của frontend team

> Phần này là chỉ dẫn triển khai. AI phải làm theo phase, dừng ở gate lỗi, không tự mở rộng scope.

### 9.0 Quy tắc vận hành trước khi sửa code

AI phải:

1. Đọc `AGENTS.md` ở root và `apps/web/AGENTS.md` nếu có.
2. Chạy `git status --short` và ghi nhận file dirty; không sửa/revert file ngoài scope.
3. Xác nhận các path được giao tồn tại bằng `rg --files`.
4. Xác nhận route backend bằng route files, không suy từ tài liệu này nếu code đã thay đổi.
5. Không cài dependency khi chưa được người phụ trách cho phép.
6. Không sửa `apps/mobile`.
7. Không sửa behavior backend nếu task chỉ giao frontend; báo BE prerequisite thay vì tự vá API.
8. Không commit/push/deploy nếu chưa được yêu cầu.

Stop condition:

- Nếu route/schema thực tế đã khác tài liệu này, dừng phase đó và báo diff bằng file/line.
- Nếu chưa được phép cài `@supabase/supabase-js`, `@supabase/ssr` hoặc Zod cho web, hoàn thành phần không cần dependency rồi yêu cầu approval.
- Nếu không có admin test account hoặc Supabase env, vẫn build được UI/contract nhưng phải đánh dấu auth E2E là chưa xác minh; không hardcode bypass.

### 9.1 Phase A — BE prerequisite: contract admin-only

**Owner đề xuất:** BE hoặc người được phép sửa cross-package. FE AI không tự làm phase này nếu chỉ được giao `apps/web`.

#### File tối thiểu

```text
packages/api-contract/
  package.json
  tsconfig.json
  src/
    common.ts
    auth.ts
    admin-users.ts
    admin-mechanics.ts
    admin-service-requests.ts
    admin-operations.ts
    health.ts
```

Không tạo `src/index.ts` export mọi thứ. Không tạo factory/codegen/generator.

#### `package.json` mục tiêu

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

Giữ phiên bản TypeScript đồng bộ với workspace thực tế tại thời điểm làm; không nâng dependency chỉ vì ví dụ trên.

#### `tsconfig.json` mục tiêu

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

Không bật `composite`, `declaration`, `outDir` trong phase này.

#### Contract common bắt buộc

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
  z.object({
    items: z.array(item),
    page: pageMetaSchema
  });
```

Không ép `details` về một object cụ thể nếu backend chưa bảo đảm shape chung.

#### Contract auth bắt buộc

Định nghĩa schema/type cho `RequestActor` đúng như mục 4.11. Không import `AuthError`, repository type hoặc Next type.

#### Quy tắc response contract

Với mỗi admin endpoint FE dùng:

1. Đọc return type từ service thật.
2. Tạo Zod response schema trong package.
3. Backend route/service dùng type/schema đó hoặc có test chứng minh output parse được.
4. FE server client parse response bằng cùng schema.

Không dùng `z.any()`. Chỉ dùng `z.unknown()` ở trường thực sự opaque như `details`.

#### Migration an toàn

1. Thêm package dependency bằng `workspace:*` cho API và web.
2. Tạo contract mới không phá code cũ.
3. Chuyển một domain admin mỗi lần.
4. Cập nhật import backend.
5. Chạy test domain đó + package typecheck + API typecheck.
6. Chỉ xóa định nghĩa cũ sau khi `rg` chứng minh không còn import.

#### Gate A

Phase A chỉ hoàn thành khi:

- package tự typecheck;
- API typecheck/test/build pass;
- không có import từ `apps/api` vào `packages/api-contract`;
- không có `node:*`, `process.env`, Next, repository hoặc database import trong contract;
- web có thể import mỗi subpath mà không dùng root barrel.

### 9.2 Phase B — Port, env và package scripts cho Web

#### Port

- `apps/web`: port 3000.
- `apps/api`: port 3001.

API dev script nên được gọi với port 3001 bằng cấu hình/script đã thống nhất của repo; không để hai Next app tranh port 3000.

#### `apps/web/.env.example`

```dotenv
API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Không thêm:

```text
SUPABASE_SERVICE_ROLE_KEY
INTERNAL_WORKER_SECRET
DATABASE_URL
PAYOS_*
OPENROUTER_*
GEMINI_*
```

#### Script

Thêm script `typecheck` cho web nếu chưa có:

```json
"typecheck": "tsc --noEmit"
```

#### Gate B

- `.env.example` chỉ chứa placeholder.
- `rg` không tìm thấy secret backend trong `apps/web`.
- web typecheck/lint/build pass trước khi làm auth.

### 9.3 Phase C — Supabase SSR auth

#### Dependency

Sau khi được phép, cài vào **apps/web**, không phải root tùy tiện:

```text
@supabase/supabase-js
@supabase/ssr
```

Không thêm auth framework thứ hai.

#### File đề xuất

```text
apps/web/src/lib/supabase/client.ts
apps/web/src/lib/supabase/server.ts
apps/web/src/proxy.ts
apps/web/src/app/login/page.tsx
apps/web/src/app/login/actions.ts
apps/web/src/app/admin/layout.tsx
apps/web/src/lib/auth/require-admin.ts
```

Kiểm tra version Next hiện tại và official Supabase guide trước khi chọn chính xác tên/signature `proxy.ts`; Next.js 16 dùng proxy convention thay middleware convention cũ.

#### Trách nhiệm từng file

`client.ts`:

- chỉ tạo browser client;
- dùng publishable key;
- không đọc service role;
- chỉ import trong Client Component cần login/logout.

`server.ts`:

- dùng `cookies()` của Next;
- tạo server client cho Server Component/Server Action;
- xử lý cookie get/set theo API hiện tại của `@supabase/ssr`;
- không cache client ở module global.

`proxy.ts`:

- refresh token/session theo official pattern;
- không tự quyết role admin;
- loại trừ static asset và Next internals bằng matcher tối thiểu;
- không log token/cookie.

`require-admin.ts`:

1. Lấy/verify user session bằng Supabase server client.
2. Nếu không có user/token hợp lệ, redirect `/login`.
3. Gọi backend `GET /api/v1/auth/me` bằng Bearer token.
4. Nếu actor không `active` hoặc không có role `admin`, trả trang 403/redirect an toàn.
5. Trả `{ actor, accessToken }` chỉ cho server-side caller; không truyền `accessToken` vào Client Component.

#### Login action

- Validate email/password tối thiểu ở server action.
- Gọi Supabase password sign-in.
- Không phân biệt “email tồn tại” và “mật khẩu sai” trong thông báo công khai.
- Sau login, gọi/để admin layout gọi `/auth/me`.
- Nếu không phải admin, sign out hoặc redirect forbidden theo quyết định UX; không cho render admin shell.
- `redirect("/admin")` chỉ sau khi gate pass.

#### Gate C

Kiểm thử thủ công tối thiểu:

| Trường hợp | Kỳ vọng |
|---|---|
| Không cookie | `/admin` chuyển `/login` |
| Cookie hết hạn | proxy refresh hoặc chuyển login, không loop |
| Rider đăng nhập | 403/redirect, không thấy admin data |
| Admin suspended | bị chặn theo `/auth/me` |
| Admin active | vào admin shell |
| Logout | cookie bị xóa và `/admin` bị chặn |

### 9.4 Phase D — Server-only API client

#### File đề xuất

```text
apps/web/src/lib/api/server-client.ts
apps/web/src/lib/api/admin.ts
```

Gắn `import "server-only";` ở đầu module giữ token/API base URL.

#### API client bắt buộc hỗ trợ

- base URL từ `API_BASE_URL`;
- path phải bắt đầu bằng `/`;
- `Authorization: Bearer <token>`;
- JSON request/response;
- `cache: "no-store"` cho admin operational data;
- timeout qua `AbortController`;
- schema parse cho success response;
- parse `ApiErrorBody` cho non-2xx;
- giữ HTTP status, `error_code`, message, request_id;
- không log token, request body nhạy cảm hoặc raw response.

Interface tối thiểu:

```ts
type ApiRequestOptions<T> = {
  accessToken: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  idempotencyKey?: string;
  schema: import("zod").ZodType<T>;
  timeoutMs?: number;
};

export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions<T>
): Promise<T>;
```

Không tạo class, factory, interceptor framework hoặc client generator. Một function generic + domain adapter là đủ.

#### Error class tối thiểu

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
  }
}
```

#### Quy tắc error UX

| Status/code | UX |
|---|---|
| 400 / `INVALID_INPUT` | Hiển thị lỗi form có kiểm soát |
| 401 | Chuyển login; không retry vô hạn |
| 403 | Trang không đủ quyền |
| 404 | Not found state |
| 409 | Thông báo conflict; không tự sinh intent mới |
| 429 | Báo thử lại sau; tôn trọng header nếu có |
| 5xx/timeout | Error state + nút retry GET; mutation retry giữ cùng idempotency key |
| Response schema invalid | Báo contract mismatch; không render partial data |

#### Gate D

- Module client không xuất token ra browser bundle.
- Một request GET thật parse thành công.
- 401/403/409/schema-invalid có nhánh xử lý khác nhau.
- Timeout được cleanup trong `finally`.

### 9.5 Phase E — Admin route adapter theo allowlist

Chỉ tạo function cho màn hình sắp làm. Danh sách route hiện có:

#### Users

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

#### Mechanics

| Method | Path |
|---|---|
| GET | `/api/v1/admin/mechanics` |
| GET | `/api/v1/admin/mechanics/{mechanicId}` |
| GET | `/api/v1/admin/mechanics/{mechanicId}/work-history` |
| GET | `/api/v1/admin/mechanics/{mechanicId}/performance` |
| POST | `/approve`, `/reject`, `/suspend`, `/ban`, `/reactivate` dưới mechanic ID |
| POST | `/api/v1/admin/mechanics/{mechanicId}/force-unavailable` |
| PUT | `/api/v1/admin/mechanics/{mechanicId}/skills` |
| PUT | `/api/v1/admin/mechanics/{mechanicId}/service-radius` |

#### Service requests

| Method | Path |
|---|---|
| GET | `/api/v1/admin/service-requests` |
| GET | `/api/v1/admin/service-requests/{requestId}` |
| GET | `/timeline`, `/media`, `/assignment`, `/quotes` dưới request ID |
| POST | `/api/v1/admin/service-requests/{requestId}/cancel` |
| POST | `/api/v1/admin/service-requests/{requestId}/manual-escalate` |
| POST | `/api/v1/admin/service-requests/{requestId}/notes` |

#### Operations và health

| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/admin/operations/outbox-dead-letters` | Admin JWT |
| GET | `/api/v1/admin/operations/payments-needs-review` | Admin JWT |
| GET | `/api/v1/admin/operations/dispatch-stuck` | Admin JWT |
| GET | `/api/v1/admin/operations/worker-runs` | Admin JWT |
| GET | `/api/v1/internal/health/live` | Public probe |
| GET | `/api/v1/internal/health/ready` | Public probe |

Không gọi route `/api/v1/internal/workers/**` từ Admin Web.

Query phải serialize bằng `URLSearchParams`; bỏ field `undefined`/empty; không nối chuỗi thủ công. Status mechanic filter dùng `active`, không dùng `approved`.

### 9.6 Phase F — UI read-only trước

#### Route structure tối thiểu

```text
apps/web/src/app/
  login/
    page.tsx
    actions.ts
  admin/
    layout.tsx
    page.tsx
    users/
      page.tsx
      [userId]/page.tsx
    mechanics/
      page.tsx
      [mechanicId]/page.tsx
    service-requests/
      page.tsx
      [requestId]/page.tsx
    operations/
      page.tsx
```

Chỉ thêm component dùng lại khi đã có ít nhất hai caller thật. Không dựng design-system package.

#### Server/Client boundary

- Page/layout mặc định là Server Component.
- Filter có thể dùng URL search params và form GET, không cần global state.
- Chỉ modal/form tương tác, nút confirm, toast cần Client Component.
- Không fetch bằng `useEffect` nếu Server Component làm được.
- Không thêm React Query/SWR trong phase đầu.

#### Dashboard

Dashboard đầu tiên nên hiển thị:

- actor/admin đang đăng nhập;
- health liveness/readiness badge;
- link đến 4 operational queues;
- các count chỉ khi có thể lấy đúng và chi phí hợp lý từ endpoint thật.

Không biến readiness checks thành user/mechanic/request totals. Nếu backend chưa có aggregate endpoint, bỏ metrics cards; không tải toàn bộ list chỉ để đếm.

#### List pages

Mỗi list page phải có:

- filter form theo query backend thật;
- table semantic (`table`, `thead`, `th`, `tbody`);
- empty state;
- controlled error state;
- cursor next action dựa vào `page.has_more` + `page.next_cursor`;
- link tới detail;
- status label mapping tách display label khỏi API value.

Không tạo client-side pagination index giả cho cursor pagination.

#### Detail pages

- Fetch resource chính server-side.
- Fetch tab phụ chỉ khi tab được mở hoặc chi phí chấp nhận được.
- 404 dùng `notFound()`/not-found UI.
- Field nhạy cảm phải theo response redaction backend; frontend không tìm cách “mở khóa”.

#### Accessibility tối thiểu

- Mọi input có label.
- Nút icon có accessible name.
- Dialog giữ focus và có confirm/cancel rõ ràng.
- Không chỉ dùng màu để truyền status.
- Loading/error text được đọc được bằng screen reader.

### 9.7 Phase G — Mutation và idempotency đúng

Chỉ bắt đầu sau khi read-only pages pass.

#### Mẫu luồng mutation

1. User mở dialog cho một action cụ thể.
2. Server/client tạo một UUID cho **intent đó**.
3. UUID nằm trong hidden field hoặc server-side state phù hợp.
4. User nhập reason/body.
5. Server Action validate input.
6. Server Action gọi backend với `X-Idempotency-Key` là UUID trên.
7. Nếu timeout/network error, retry cùng key.
8. Nếu thành công, `revalidatePath` đúng list/detail.
9. Khi dialog đóng và user bắt đầu action mới, tạo key mới.

Không tạo key bên trong `apiFetch` cho mỗi HTTP attempt.

#### Validation

Dùng contract schema thật. Theo backend hiện tại, reason mutation phải tuân constraint cụ thể của schema; tài liệu/UX nên chuẩn bị vùng 10–500 ký tự nơi applicable. Internal note body theo schema backend, thường tối đa 2000 ký tự. AI phải đọc schema hiện tại trước khi hardcode limit.

#### Double submit

- Disable submit khi pending.
- Vẫn dựa vào idempotency backend; disable button không thay thế concurrency protection.
- Với 409, hiển thị message từ controlled error. Không tự retry bằng key mới.

#### Revalidation

Chỉ revalidate các path bị ảnh hưởng. Không dùng `revalidatePath("/", "layout")` cho mọi mutation.

### 9.8 Phase H — Verification

Chạy từ root bằng `pnpm.cmd` trên Windows:

```powershell
pnpm.cmd --filter @careonroad/api-contract typecheck
pnpm.cmd run typecheck
pnpm.cmd test
pnpm.cmd run build:api
pnpm.cmd --filter @careonroad/web typecheck
pnpm.cmd run lint:web
pnpm.cmd run build:web
```

Nếu root chưa có `build:web`, dùng filter/script thật trong `apps/web/package.json`; không bịa command.

Không cần chạy mobile build nếu không chạm mobile. Nếu Phase A thay contract mà mobile chưa consume package, mobile cũng không nên bị kéo vào.

#### Manual smoke matrix

1. Khởi động API ở 3001, web ở 3000.
2. Mở `/admin` khi chưa login.
3. Login bằng rider và xác nhận bị chặn.
4. Login bằng admin active.
5. Mở từng list; thử filter; next cursor.
6. Mở detail user/mechanic/request.
7. Thử một mutation hợp lệ.
8. Double click/retry request cùng intent và xác minh không nhân đôi side effect.
9. Thử reason invalid và xác minh 400 hiển thị đúng.
10. Thử actor mất role/suspended và xác minh 403/redirect.
11. Tắt API, xác minh timeout/error state không làm web crash.
12. Kiểm tra browser network/source không có service-role key, worker secret hoặc access token trong rendered HTML.

#### Gate H / Definition of Done

- Tất cả command phù hợp pass.
- Không có TypeScript `any` được thêm để né contract.
- Không có secret trong diff/log/client bundle.
- Không có route giả hoặc status giả.
- Không sửa mobile.
- Không có dependency ngoài danh sách đã duyệt.
- Auth gate được backend `/auth/me` xác nhận.
- Mutation giữ idempotency key đúng vòng đời.
- Có screenshot hoặc checklist smoke cho các state chính.

## 10. Thứ tự PR tối ưu

Không dồn mọi thứ vào một mega-PR. Chia theo khả năng rollback và review:

1. **PR 1 — Admin HTTP contract only**  
   Package contract, backend import, contract tests. Không UI.
2. **PR 2 — Web auth + server API client**  
   Env, port, Supabase SSR, `/auth/me` guard, error handling.
3. **PR 3 — Read-only admin pages**  
   Users, mechanics, requests, operations, health badge.
4. **PR 4 — Admin mutations**  
   Reason forms, idempotency, revalidation, conflict UX.

Nếu team nhỏ và không dùng PR, vẫn giữ bốn checkpoint commit độc lập. Không bắt đầu checkpoint sau khi checkpoint trước đang đỏ.

## 11. Những thứ cố ý không làm

Đây là quyết định tối ưu, không phải thiếu sót:

- Không trích xuất contract cho mọi feature.
- Không generate client từ toàn bộ OpenAPI.
- Không tạo SDK class/factory/interceptor framework.
- Không thêm React Query/SWR/global state.
- Không tạo dashboard business metrics giả.
- Không gọi worker routes từ web.
- Không đưa route ETA/live tracking/payment UI vào Admin Web phase đầu.
- Không merge Expo mobile vào root workspace.
- Không thêm 2FA.
- Không đổi Zod major hoặc dependency versions ngoài nhu cầu.

Chỉ mở rộng khi có màn hình/consumer và acceptance criteria cụ thể.

## 12. Prompt giao việc sẵn cho AI frontend

Copy phần dưới cho AI thực thi. Người giao việc phải thay `[PHASE ĐƯỢC GIAO]` và chỉ cấp quyền đúng phase.

```text
Bạn đang làm trong monorepo CareOnRoad. Hãy đọc đầy đủ:
1) AGENTS.md ở root;
2) apps/web/AGENTS.md nếu tồn tại;
3) FE-BE-CONTRACT-ADMIN-WEB-REVIEW-AND-AI-IMPLEMENTATION-GUIDE.md;
4) các route/service/schema/test backend liên quan trực tiếp đến phase.

Nhiệm vụ: triển khai [PHASE ĐƯỢC GIAO] trong guide, không triển khai phase khác.

Quy tắc bắt buộc:
- Xem route/service/test/migration hiện tại là source of truth; nếu khác guide, báo file/line trước khi tiếp tục.
- Chạy git status trước khi sửa; giữ nguyên mọi thay đổi có sẵn ngoài scope.
- Không sửa apps/mobile.
- Không cài dependency nếu chưa có approval rõ ràng.
- Không đưa SUPABASE_SERVICE_ROLE_KEY, INTERNAL_WORKER_SECRET, database URL hoặc raw env vào code/log/docs/client bundle.
- Không dùng NEXT_PUBLIC_API_BASE_URL nếu browser không cần gọi API trực tiếp.
- Không tạo endpoint, response field, status hoặc component giả định.
- Error body backend là { error_code, message, request_id?, details? }.
- Cursor page là { items, page: { limit, has_more, next_cursor? } }.
- Mechanic status API dùng pending|active|rejected|suspended|banned; “Đã duyệt” chỉ là label cho active.
- Auth admin phải được xác nhận bằng GET /api/v1/auth/me; cookie check chỉ là bước đầu.
- API client chứa token phải là server-only.
- Mutation phải giữ cùng X-Idempotency-Key qua retry của cùng một user intent.
- Không gọi /api/v1/internal/workers/** từ web.
- Dùng Server Components cho reads và Server Actions cho mutations khi phù hợp; không thêm state/data-fetch library nếu native Next đủ dùng.
- Chỉ tạo abstraction sau khi có ít nhất hai caller thật.

Quy trình:
1. Nêu ngắn gọn baseline thực tế và file sẽ sửa.
2. Kiểm tra các route/schema liên quan bằng rg.
3. Triển khai diff nhỏ nhất hoàn thành phase.
4. Chạy đúng gate/command trong guide.
5. Sửa lỗi trong phạm vi phase; không dùng any hoặc bỏ validation để làm build xanh.
6. Báo: file đã đổi, behavior đạt được, command/result, manual checks, phần chưa xác minh và lý do.

Stop và hỏi người phụ trách nếu:
- cần dependency mới;
- cần thay contract/behavior backend nhưng bạn chỉ được giao frontend;
- cần credential/admin test account;
- code thật mâu thuẫn với route/shape trong guide;
- action có thể ghi dữ liệu ngoài test/dev.

Definition of Done: phase gate pass, không lộ secret, không route giả, không sửa ngoài scope, và kết quả có thể review độc lập.
```

## 13. Checklist review cho tech lead

### Contract

- [ ] Shared package không import backend internals.
- [ ] Có response schema, không chỉ request schema.
- [ ] Error/pagination đúng shape.
- [ ] Explicit subpath exports; không wildcard collision.
- [ ] API và web khai báo `workspace:*`.

### Auth/security

- [ ] Supabase SSR theo official current API.
- [ ] `/auth/me` xác nhận active admin.
- [ ] Token chỉ ở server boundary.
- [ ] Không service role/worker secret trong web.
- [ ] Không log body/token/cookie.

### Admin UI

- [ ] Route adapter khớp route files.
- [ ] Status/filter khớp backend.
- [ ] List dùng cursor page thật.
- [ ] Empty/loading/error/403/404 states tồn tại.
- [ ] Accessibility cơ bản pass.

### Mutations

- [ ] Reason/body validate bằng contract.
- [ ] Idempotency key giữ qua retry.
- [ ] 409 không bị retry bằng key mới.
- [ ] Revalidation có phạm vi.
- [ ] Double-submit được chặn ở UI và backend semantic.

### Verification

- [ ] Contract typecheck.
- [ ] API typecheck/test/build.
- [ ] Web typecheck/lint/build.
- [ ] Auth smoke matrix.
- [ ] Không có mobile diff ngoài thay đổi có sẵn trước task.
- [ ] Không có secret hoặc raw `.env.local` trong diff.

## 14. Kết luận cuối

Ba tài liệu FE đã xác định đúng nhu cầu tổng quát: cần contract dùng chung và cần Admin Web. Sai lệch nằm ở baseline, phạm vi refactor và một số contract chi tiết. Nếu triển khai nguyên trạng, team có nguy cơ xây UI trên file/route/shape không tồn tại, đồng thời tạo một shared package chứa backend internals nhưng vẫn thiếu response contract.

Giải pháp ít rủi ro và hiệu quả nhất là **admin-only contract + auth-first + server-only client + read-before-write**. Cách này tận dụng backend đang có, tạo feedback sớm, giữ mobile độc lập và tránh refactor hàng chục feature chưa có consumer.

---

### Nguồn ngoài chính thức

- [pnpm workspaces và workspace protocol](https://pnpm.io/workspaces)
- [Supabase server-side auth](https://supabase.com/docs/guides/auth/server-side)
- [Supabase client setup cho Next.js](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs&queryGroups=framework)

### Nguồn nội bộ tiêu biểu

- `apps/api/src/lib/api-error.ts`
- `apps/api/src/features/auth/auth.types.ts`
- `apps/api/src/features/auth/auth.route-handlers.ts`
- `apps/api/src/features/admin/admin-user-management.service.ts`
- `apps/api/src/features/admin/admin-mechanic-management.service.ts`
- `apps/api/src/features/admin/admin-service-request.service.ts`
- `apps/api/src/features/admin/admin.schemas.ts`
- `apps/api/src/features/mechanic-operations/mechanic-operations.schemas.ts`
- `apps/api/src/features/media-uploads/media-upload.schemas.ts`
- `apps/api/src/server/runtime-controls/*`
- `apps/api/app/api/v1/admin/**/route.ts`
- `specs/003-careonroad-admin-operations/contracts/admin-api.yaml`
- `apps/web/package.json`
- `apps/web/src/app/page.tsx`
- `README.md`
