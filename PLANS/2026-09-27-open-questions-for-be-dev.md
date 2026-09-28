# Open Questions cho BE Dev — Plan `2026-09-27-be-contract-refactor-and-admin-web.md`

**Ngày:** 2026-09-27
**Plan gốc:** [`2026-09-27-be-contract-refactor-and-admin-web.md`](./2026-09-27-be-contract-refactor-and-admin-web.md)
**Notes BE dev:** [`2026-09-27-be-dev-notes-phase0.md`](./2026-09-27-be-dev-notes-phase0.md)
**Trạng thái:** Đang chờ BE dev review. Chưa sửa/xóa/tạo file nào trong codebase.

---

## Bối cảnh

Khi khảo sát codebase thật để chuẩn bị Phase 0 (move schemas từ `apps/api/src/features/` → `packages/api-contract/`), tôi phát hiện **plan có một số giả định không khớp với code hiện tại**. Cần BE dev review và quyết định trước khi execute.

Bạn (BE dev) vui lòng:
1. Đọc qua 13 câu hỏi bên dưới.
2. Chọn option cho mỗi câu (bằng cách reply với ID + option, vd `Q1 = 1a`).
3. Hoặc ghi chú thêm nếu cần discuss.

Có **3 câu critical (Q1, Q2, Q4)** cần quyết trước khi tôi viết bất kỳ dòng code nào.

---

## Phase 0 — Schema mapping & missing files

### Q1 (CRITICAL) — 4 features không có `*.schemas.ts` riêng

Plan giả định có 21 file `*.schemas.ts` trong `apps/api/src/features/`. Thực tế chỉ có **16 files**. 4 features sau không có file schema riêng:

| Feature | Plan giả định | Thực tế trong codebase |
|---|---|---|
| `route-eta` | `route-eta.schemas.ts` | Chỉ có `route-eta.types.ts` (file TS types, không phải Zod) |
| `retention` | `retention.schemas.ts` | Chỉ có `retention-policy.ts` (policy logic) |
| `runtime-controls` | `runtime-controls.schemas.ts` | **Không có folder feature này** trong `apps/api/src/features/` |
| `chatbot` | `chatbot.ts` (gộp chung) | Có 3 files liên quan: `diagnosis.schema.ts` + `message.schema.ts` + `ai-provider.types.ts` |

**Cách xử lý mong muốn:**

- **1a.** Bỏ qua — keep nguyên tên trong BE, không move các file này vào contract (giữ scope Phase 0 = 16 files đã có schema).
- **1b.** Wrap vào contract dưới dạng types (vd `contract/route-eta.ts` chỉ re-export types từ `route-eta.types.ts`; tương tự cho retention).
- **1c.** Tạo schema Zod mới cho chúng trước, rồi mới move (mở rộng scope).
- **1d.** Cách khác — bạn tự đề xuất.

**Recommend:** `1a` (giữ scope Phase 0 = move-only, không tạo mới).

---

### Q2 (CRITICAL) — `runtime-controls` feature có tồn tại không?

Plan Phase 1 đề cập `runtime-controls` schemas, và `apps/api/src/lib/api-error.ts` có reference đến runtime controls trong AGENTS.md (xem phần "Shared Utilities → `src/server/runtime-controls/*`").

Tuy nhiên:
- ❌ Không có folder `apps/api/src/features/runtime-controls/`
- ❌ Không tìm thấy file schemas hay service nào ở root `apps/api/src/server/runtime-controls/` (AGENTS.md đề cập nhưng có thể chưa implement hoặc ở chỗ khác).

**Câu hỏi cụ thể:**
- **2a.** `runtime-controls` đã được implement chưa? Nếu rồi, ở path nào?
- **2b.** Nếu chưa implement → bỏ qua khỏi Phase 0 (không move gì).
- **2c.** Nếu đã có nhưng ở path khác → cho biết path để tôi explore.

---

### Q3 — File `assignment-recovery.schemas.ts` không có trong plan

Tôi phát hiện có 1 schema file **không có trong plan mapping**:

```
apps/api/src/features/assignments/assignment-recovery.schemas.ts
```

**Cách xử lý (đã xác nhận với user):**
- ✅ **3a.** Add vào `packages/api-contract/src/assignments.ts` cùng với `assignment.schemas.ts` (gộp chung vì cùng feature).

→ **Cần BE dev confirm:** `assignments.ts` trong contract hiện đang được `index.ts` export kiểu nào? Nếu dùng `export *` thì có nguy cơ trùng tên schema (xem Q7).

---

### Q4 (CRITICAL) — Naming mismatch giữa plan và code thật

Plan dùng tên file khác với thực tế:

| Plan nói | Thực tế |
|---|---|
| `admin-operations.ts` | `admin.schemas.ts` |
| `notifications.ts` | `notification-inbox.schemas.ts` |

**Đã xác nhận với user:** giữ nguyên tên file thật trong contract → `admin.ts` + `notification-inbox.ts`.

**Câu hỏi bổ sung cho BE dev:**
- **4a.** Có schema nào trong `admin.schemas.ts` hoặc `notification-inbox.schemas.ts` đang được import từ web/admin UI không? (Nếu có → đổi tên trong BE trước khi move, tránh break external consumers.)
- **4b.** Các test file `__tests__/*.test.ts` có import schema từ path cũ không? (Nếu có → sửa test imports luôn.)

→ Đề nghị BE dev chạy nhanh:
```cmd
grep -r "from './admin.schemas'" apps\api\src\
grep -r "from './notification-inbox.schemas'" apps\api\src\
grep -r "@careonroad/admin" apps\web\src\ 2>nul
```

---

### Q5 — `mechanic-profile.schemas.ts` không tìm thấy

Plan Phase 0 mapping có `mechanic-profile.schemas.ts`. Tôi grep không thấy file này — chỉ thấy `motorcycle.schemas.ts` chứa cả motorcycle + mechanic profile schemas?

**Cần BE dev confirm:**
- **5a.** Schema mechanic-profile có nằm trong `motorcycle.schemas.ts` không? (Nếu có → move cùng vào `contract/motorcycles.ts`.)
- **5b.** Hay tách riêng ở file khác mà tôi chưa tìm ra? (Cho biết path.)

---

### Q6 — Schema có reference chéo giữa features?

Plan ghi chú (pitfall P2): schema có thể import từ feature khác (vd `payment.schemas.ts` import từ `quote.schemas.ts`).

**Cần BE dev chạy trước:**
```cmd
grep -r "^import.*from '\.\./" apps\api\src\features\**\*.schemas.ts
```

Trả lời:
- **6a.** Có n file bị cross-import → tôi sẽ đổi sang relative path trong package (vd `from './quotes'` thay vì `from '../quotes/quote.schemas'`).
- **6b.** Không có → đơn giản hóa move step.

---

### Q7 — Pitfall P4 (re-export trùng tên)

Plan có đề cập: nếu 2 feature export cùng tên (vd `ErrorResponse`), `index.ts` barrel sẽ conflict.

**Cần BE dev check nhanh:**
```cmd
grep -h "^export " apps\api\src\features\**\*.schemas.ts | awk '{print $2}' | sort | uniq -d
```

→ Nếu có trùng → tôi sẽ dùng namespace pattern (xem plan P4) thay vì `export *`.

---

### Q8 — Test files có import trực tiếp schema file không?

Plan pitfall P3: test trong `__tests__/*.test.ts` có thể import trực tiếp schema cũ.

**Cần BE dev scan:**
```cmd
grep -rl "\.schemas'" apps\api\src\features\**\__tests__\
```

→ Nếu có → tôi sẽ update test imports song song với source imports.

---

## Phase 0 — Package setup

### Q9 — `packages/api-contract/package.json` hiện tại

File hiện tại rất minimal:
```json
{
    "name": "@careonroad/api-contract",
    "version": "0.0.0",
    "private": true
}
```

Plan đề xuất thêm:
- `"type": "module"`
- `"main": "./src/index.ts"`
- `"types": "./src/index.ts"`
- `"exports": { ".": "./src/index.ts", "./*": "./src/*.ts" }`
- `"dependencies": { "zod": "^3.23.0" }`

**Câu hỏi:**
- **9a.** BE dev OK với `zod: ^3.23.0` không? (apps/api dùng `^3.24.0` — có thể bump lên `^3.24.0` để khớp.)
- **9b.** Có cần thêm `devDependencies` nào (vd `@types/node`) không?
- **9c.** Workspace pattern `"exports": { "./*": "./src/*.ts" }` có cần thiết không, hay chỉ `"."` là đủ?

**Recommend:** `9a` bump lên `^3.24.0` cho khớp với BE.

---

### Q10 — `packages/api-contract/tsconfig.json`

Plan đề xuất:
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

**Nhưng:** root repo KHÔNG có `tsconfig.json` chung. Mỗi app có tsconfig riêng (`apps/api/tsconfig.json`, `apps/web/tsconfig.json`).

**Câu hỏi:**
- **10a.** Nên dùng tsconfig độc lập (không extends) cho package? (Plan có fallback.)
- **10b.** Có cần `"composite": true` không? (Dùng cho project references — chỉ cần khi build đa package với `tsc -b`.)
- **10c.** `apps/api/tsc --noEmit` không cần build package thật → chỉ cần `index.ts` resolve được là đủ. Confirm?

**Recommend:** `10a` + `10c` — dùng tsconfig standalone, không cần composite.

---

### Q11 — `apps/api` cần thêm dependency `@careonroad/api-contract` không?

Sau khi move schema xong, BE sẽ import như:
```ts
import { LoginSchema } from '@careonroad/api-contract';
```

Workspace đã có `packages/*` trong `pnpm-workspace.yaml`, nhưng **`apps/api/package.json` chưa declare dependency với `packages/api-contract`**.

**Câu hỏi:**
- **11a.** Workspace protocol: có cần `"@careonroad/api-contract": "workspace:*"` trong `apps/api/package.json` không, hay pnpm tự resolve qua workspace?
- **11b.** Sau khi BE dev verify, tôi tự thêm dependency hay bạn thêm?

**Recommend:** `11a` + tôi tự thêm (để phase 0 là atomic change).

---

## Phase 1+ — Web wire (không thuộc Phase 0, nhưng cần confirm sớm)

### Q12 — `NEXT_PUBLIC_API_BASE_URL` đã có chưa?

Plan Phase 1.3 nói web đọc `NEXT_PUBLIC_API_BASE_URL` để switch mock/live.

**Câu hỏi:**
- **12a.** `apps/web/.env.local` đã có biến này chưa? Cho giá trị hiện tại (nếu có).
- **12b.** Nếu chưa có → BE dev có muốn đặt convention cụ thể (vd `http://localhost:3001` cho local dev)?

---

### Q13 — Server-side fetch trong RSC — `API_BASE_URL` (không PUBLIC)

Plan Phase 2.2 nói admin RSC pages cần `API_BASE_URL` (server-side, không `NEXT_PUBLIC_`).

**Câu hỏi:**
- **13a.** Có convention port nào cho dev api không? (Default Next.js là 3000, nhưng apps/api dùng port khác?)
- **13b.** Có file env example nào (`.env.example`) cho web không? Nếu có → add biến vào đó.

---

## Summary checklist cho BE dev

Khi review xong, BE dev reply với format:
```
Q1 = <option>
Q2 = <option>
Q3 = OK (hoặc ghi chú)
...
```

Tôi sẽ **chỉ bắt đầu viết code** sau khi có confirm cho **Q1, Q2, Q4** (3 câu critical).

Các câu Q3, Q5-Q13 có thể quyết trong lúc execute Phase 0 từng bước, không block.

---

## Phụ lục — Trạng thái workspace trước khi pause

Tôi đã làm (read-only, không sửa file):
- Khảo sát `pnpm-workspace.yaml`, root `package.json`.
- Verify `packages/api-contract`, `packages/domain`, `packages/config` đều là stubs trống.
- Grep 16 file `*.schemas.ts` thật trong `apps/api/src/features/`.
- Grep `@careonroad/api-contract` — confirm không có file nào import (safe để setup).
- Khởi tạo TodoList tracking 9 bước Phase 0.

Tôi CHƯA làm:
- Chưa tạo file mới nào trong `packages/api-contract/src/`.
- Chưa sửa imports ở `apps/api/`.
- Chưa xóa file schemas cũ.
- Chưa chạy `pnpm install`.
- Chưa chạy typecheck/test/build.

→ **Codebase hiện tại không bị thay đổi gì.** Workspace sạch sẽ để BE dev review từ đầu.
