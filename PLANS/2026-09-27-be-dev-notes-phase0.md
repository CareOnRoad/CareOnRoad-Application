# Notes cho BE Dev: Refactor BE → `@careonroad/api-contract`

**Ngày:** 2026-09-27
**Plan đầy đủ:** [`PLANS/2026-09-27-be-contract-refactor-and-admin-web.md`](../PLANS/2026-09-27-be-contract-refactor-and-admin-web.md)
**Scope notes này:** Chỉ Phase 0 (refactor BE → contract package). Web dev đọc file khác.

---

## Mục tiêu Phase 0

Di chuyển toàn bộ Zod schemas + inferred TS types từ `apps/api/src/features/<feature>/<feature>.schemas.ts` ra `packages/api-contract/src/<feature>.ts`. BE đổi `import` path từ relative sang workspace package.

**Không thay đổi:**
- Field names, kiểu dữ liệu, enum value.
- HTTP status code, response wrapper.
- Validation rules (chỉ move code, không sửa logic).

**Không thêm dependency mới** ngoài `zod` (đã có trong `apps/api`).

---

## Repository setup

### 1. Kiểm tra stub hiện có
Trước khi tạo mới, kiểm tra stub:
```cmd
cat packages/api-contract/package.json
```

Nếu file chỉ có `name`, `version`, `private: true` → đã có stub, tiếp tục bước 2.
Nếu file không tồn tại → tạo mới theo bước 2.

### 2. Tạo / cập nhật `packages/api-contract/package.json`

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

### 3. Tạo `packages/api-contract/tsconfig.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "composite": true
  },
  "include": ["src/**/*"]
}
```

> Lưu ý: Nếu root không có `tsconfig.json` chung, dùng:
> ```json
> {
>   "compilerOptions": {
>     "target": "ES2022",
>     "module": "ESNext",
>     "moduleResolution": "Bundler",
>     "strict": true,
>     "esModuleInterop": true,
>     "skipLibCheck": true,
>     "declaration": true,
>     "outDir": "./dist",
>     "rootDir": "./src"
>   },
>   "include": ["src/**/*"]
> }
> ```

### 4. Tạo `packages/api-contract/src/index.ts`

Re-export tất cả features:

```ts
export * from './auth';
export * from './motorcycles';
export * from './mechanic-profile';
export * from './mechanic-operations';
export * from './service-requests';
export * from './dispatch';
export * from './assignments';
export * from './mechanic-diagnosis';
export * from './quotes';
export * from './payments';
export * from './reminders';
export * from './notifications';
export * from './media-uploads';
export * from './reviews';
export * from './live-tracking';
export * from './route-eta';
export * from './retention';
export * from './runtime-controls';
export * from './admin-operations';
export * from './chatbot';
export * from './common';
```

### 5. Verify workspace config

Root `pnpm-workspace.yaml` đã có `packages/*` → tự động cover `packages/api-contract`. Không cần đổi.

```cmd
pnpm.cmd install
```

Sau lệnh này, `apps/api` sẽ resolve được `@careonroad/api-contract` qua `workspace:*`.

---

## Mapping file cần move

| File nguồn (apps/api/src/features/...) | File đích (packages/api-contract/src/...) |
|---|---|
| `auth/auth.schemas.ts` | `auth.ts` |
| `motorcycles/motorcycle.schemas.ts` | `motorcycles.ts` |
| `motorcycles/mechanic-profile.schemas.ts` | `mechanic-profile.ts` |
| `mechanic-operations/mechanic-operations.schemas.ts` | `mechanic-operations.ts` |
| `service-requests/service-request.schemas.ts` | `service-requests.ts` |
| `dispatch/dispatch.schemas.ts` | `dispatch.ts` |
| `assignments/assignment.schemas.ts` | `assignments.ts` |
| `mechanic-diagnosis/mechanic-diagnosis.schemas.ts` | `mechanic-diagnosis.ts` |
| `quotes/quote.schemas.ts` | `quotes.ts` |
| `payments/payment.schemas.ts` | `payments.ts` |
| `reminders/reminder.schemas.ts` | `reminders.ts` |
| `notifications/notification.schemas.ts` | `notifications.ts` |
| `media-uploads/media-upload.schemas.ts` | `media-uploads.ts` |
| `reviews/review.schemas.ts` | `reviews.ts` |
| `live-tracking/live-tracking.schemas.ts` | `live-tracking.ts` |
| `route-eta/route-eta.schemas.ts` | `route-eta.ts` |
| `retention/retention.schemas.ts` | `retention.ts` |
| `runtime-controls/runtime-controls.schemas.ts` | `runtime-controls.ts` |
| `admin-operations/admin-operations.schemas.ts` (trong admin feature) | `admin-operations.ts` |
| chatbot schemas (trong diagnosis.service.ts hoặc types) | `chatbot.ts` |
| `common/api-error.ts` (error codes) | `common.ts` |

> Lưu ý: Một số feature có thể đã split schema thành nhiều file (request/response/error). Move tất cả các file đó vào cùng file đích (vd `service-requests.ts` chứa cả create request, response, list query).

---

## Quy trình di chuyển (lặp lại cho mỗi feature)

### Bước 1 — Đọc schemas hiện tại
```cmd
# Windows
type apps\api\src\features\service-requests\service-request.schemas.ts
```

### Bước 2 — Tạo file đích copy nguyên nội dung
```cmd
# Tạo file mới
notepad packages\api-contract\src\service-requests.ts
```

Dán **nguyên văn** nội dung file cũ vào. KHÔNG sửa, KHÔNG tối ưu, KHÔNG đổi tên schema.

**Lưu ý về internal imports trong schema:**

Nếu schema có import từ file khác cùng feature (vd `service-requests.ts` import từ `common.ts`):
- Trước: `import { X } from '../common';`
- Sau: `import { X } from './common';` (vì giờ cùng package)

Nếu schema có import từ feature khác:
- Trước: `import { X } from '../auth/auth.schemas';`
- Sau: `import { X } from '../auth';` (vì giờ cùng package, dùng barrel-style)

### Bước 3 — Đổi imports ở BE
Mở tất cả file trong `apps/api/src/features/<feature>/` dùng schema đó:

```ts
// Trước
import { CreateServiceRequestSchema } from './service-request.schemas';
import { ServiceRequestListQuery } from './service-request.schemas';

// Sau
import { CreateServiceRequestSchema, ServiceRequestListQuery } from '@careonroad/api-contract';
```

**Tìm tất cả file dùng schema:**
```cmd
grep -r "from './service-request.schemas'" apps\api\src\
grep -r "from './service-requests/service-request.schemas'" apps\api\src\
```

### Bước 4 — Type-check ngay sau khi đổi 1 feature
```cmd
pnpm.cmd --filter @careonroad/api typecheck
```

**Không chuyển feature tiếp theo nếu lệnh trên fail.** Fix ngay.

### Bước 5 — Xóa file schema cũ
Sau khi typecheck pass:
```cmd
del apps\api\src\features\service-requests\service-request.schemas.ts
```

Re-run typecheck lần nữa để chắc chắn:
```cmd
pnpm.cmd --filter @careonroad/api typecheck
```

### Bước 6 — Commit (khi xong nhiều features)
Commit theo nhóm feature, ví dụ:
```
refactor(api): move auth + motorcycles schemas to @careonroad/api-contract
refactor(api): move service-requests + dispatch + assignments schemas
refactor(api): move payments + reminders + notifications schemas
...
```

---

## Checklist Phase 0

Lặp lại cho từng feature theo bảng mapping:

- [ ] **auth** — file đích `packages/api-contract/src/auth.ts`
- [ ] **motorcycles** — file đích `motorcycles.ts`
- [ ] **mechanic-profile** — file đích `mechanic-profile.ts`
- [ ] **mechanic-operations** — file đích `mechanic-operations.ts`
- [ ] **service-requests** — file đích `service-requests.ts`
- [ ] **dispatch** — file đích `dispatch.ts`
- [ ] **assignments** — file đích `assignments.ts`
- [ ] **mechanic-diagnosis** — file đích `mechanic-diagnosis.ts`
- [ ] **quotes** — file đích `quotes.ts`
- [ ] **payments** — file đích `payments.ts`
- [ ] **reminders** — file đích `reminders.ts`
- [ ] **notifications** — file đích `notifications.ts`
- [ ] **media-uploads** — file đích `media-uploads.ts`
- [ ] **reviews** — file đích `reviews.ts`
- [ ] **live-tracking** — file đích `live-tracking.ts`
- [ ] **route-eta** — file đích `route-eta.ts`
- [ ] **retention** — file đích `retention.ts`
- [ ] **runtime-controls** — file đích `runtime-controls.ts`
- [ ] **admin-operations** — file đích `admin-operations.ts`
- [ ] **chatbot** — file đích `chatbot.ts`
- [ ] **common** — file đích `common.ts`

---

## Verify toàn bộ Phase 0

```cmd
pnpm.cmd install
pnpm.cmd run typecheck
pnpm.cmd run lint
pnpm.cmd test
pnpm.cmd run build:api
```

**Phải pass 100%.** Đây là test quan trọng nhất vì Phase 0 là move-only, không đổi behavior.

Nếu có test fail:
- **Typecheck fail**: thường do quên đổi import ở 1 file → grep `from '@careonroad/api-contract'` và grep tên schema cũ để tìm chỗ sót.
- **Test fail**: thường do file schema cũ bị xóa nhưng vẫn còn reference → restore file tạm, fix reference, xóa lại.
- **Lint fail**: import order hoặc unused import → fix theo lint message.

### Kiểm tra wire shape không đổi

Spot-check 3 endpoint đại diện bằng cách gọi qua `pnpm.cmd run dev:api` rồi `curl` (hoặc Postman):

1. `GET /api/v1/auth/me` (với token rider1@gmail.com từ seed) → response shape giống cũ.
2. `POST /api/v1/service-requests` → vẫn require `X-Idempotency-Key`, response có `id`, `request_code`, `status`.
3. `GET /api/v1/admin/users?limit=5` → vẫn trả `{ data: [...], next_cursor: ... }`.

---

## Pitfalls thường gặp

### P1 — Quên file schema phụ
Một số feature có file schemas phụ (vd `errors.ts`, `internal.ts`). Grep cẩn thận:
```cmd
grep -r "Schema" apps\api\src\features\<feature>\ --include="*.ts"
```

### P2 — Schema reference chéo giữa features
Vd: `payment.schemas.ts` import từ `quote.schemas.ts`. Khi move sang contract, cả 2 cùng nằm trong package → đổi thành relative `./quotes`.

### P3 — Test dùng schema cũ
Test trong `apps/api/src/features/<feature>/__tests__/*.test.ts` có thể import trực tiếp schema cũ. Cần đổi sang `@careonroad/api-contract` luôn.

### P4 — Re-export trùng tên
Nếu 2 feature export cùng tên (vd `ErrorResponse`), file barrel `index.ts` sẽ conflict. Cần rename hoặc dùng namespace:
```ts
// thay vì
export * from './auth';
export * from './payments';

// dùng
export * as AuthSchemas from './auth';
export * as PaymentSchemas from './payments';
```
Và import bên BE:
```ts
import { AuthSchemas } from '@careonroad/api-contract';
const X = AuthSchemas.LoginSchema;
```

### P5 — Zod version mismatch
`apps/api` và `packages/api-contract` phải dùng cùng `zod` version. Check:
```cmd
cat apps\api\package.json | findstr "zod"
cat packages\api-contract\package.json | findstr "zod"
```

Nếu khác → chỉnh `packages/api-contract/package.json` cho khớp, rồi `pnpm.cmd install`.

---

## Sau Phase 0 — chuyển sang Phase 1

Phase 0 xong → bàn giao cho **web dev** (Phase 1 trở đi). BE dev không cần làm gì thêm trong plan này.

Nếu trong tương lai cần migrate **mobile** sang dùng `@careonroad/api-contract`:
- Mobile đang ở workspace riêng (`apps/mobile/pnpm-workspace.yaml` chỉ cover `"."`).
- Cần gộp mobile vào root workspace (xóa file đó, thêm `"apps/mobile"` vào root `pnpm-workspace.yaml`).
- Đó là Phase 6 — ngoài scope plan này.

---

## Tóm tắt 1 dòng

**Move 21 file schemas từ `apps/api/src/features/*/` sang `packages/api-contract/src/`, đổi imports ở BE, xóa file cũ, verify build pass.** Không thay đổi gì khác.
