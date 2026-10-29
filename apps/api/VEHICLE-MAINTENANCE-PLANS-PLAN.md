# Mẫu nhắc bảo dưỡng + Gói Free/Advance/VIP — Implementation Plan (BE)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rider có gói Advance/VIP bật được mẫu nhắc bảo dưỡng do BE quy định, đánh dấu "đã làm", lưu thông tin VIP của xe;
admin cấp gói thủ công; `/auth/me` trả gói hiện tại.

**Architecture:** Không tạo bảng mới. Thêm cột vào `app_users` (gói), `reminder_rules` (`item_code`, `last_done_on`),
`motorcycles` (thông tin VIP). Danh mục mẫu nhắc là hằng số trong code. Gói hiệu lực được tính lúc đọc, không có worker.
Mọi endpoint mới đi theo đúng pattern service, route-handler và UnitOfWork đang có.

**Tech Stack:** Next.js route handlers, TypeScript, Zod, postgres.js, Vitest, `InMemoryUnitOfWork`.

**Spec:** `apps/api/VEHICLE-MAINTENANCE-PLANS-DESIGN.md`. Đọc spec trước. Các mục tham chiếu kiểu "5.3" là mục trong spec.

## Global Constraints

- Chỉ sửa `apps/api/**` và `supabase/migrations/**`. Không sửa `apps/mobile`, `apps/web`, `packages/api-contract`, `specs/**`.
- Không cài dependency mới.
- Không đưa các chữ `odometer`, `kilometer`, `mileage` vào migration (kể cả comment), và không đưa `Odometer|Kilometer|Mileage` vào `src/features/mechanic-operations`.
- Lỗi thiếu gói: HTTP `403`, `error_code: "FORBIDDEN"`, `details: { reason: "plan_required", required_plan: "advance" | "vip" }`.
- Giá trị thông tin VIP (số khung, số máy, số hợp đồng bảo hiểm, giá mua…) **không bao giờ** xuất hiện trong audit, outbox hay log.
  Chỉ được ghi tên cột vào `changed_fields`.
- Giờ nhắc là 09:00 giờ VN (`+07:00`), tương đương `02:00:00Z`. "Hôm nay" luôn tính theo giờ VN.
- Lệnh test một file (chạy trong `apps/api`): `pnpm.cmd exec vitest run <path>`.
- Lệnh verify toàn bộ (chạy ở root repo): `pnpm.cmd test`, `pnpm.cmd run typecheck`, `pnpm.cmd run lint`, `pnpm.cmd run build:api`.
- **Lỗi có sẵn trước khi làm, không sửa:** `src/features/admin/__tests__/admin-delivery-audit.test.ts:108` (1 test đỏ).
  Ngoài lỗi này, mọi test phải xanh sau mỗi batch.
- **Commit:** `AGENTS.md` cấm commit khi chưa được phép. Ở mỗi bước "Checkpoint", chỉ commit nếu user đã cho phép.
  Nếu chưa, dừng lại và báo cáo kết quả lệnh.

## Review Focus

1. **Đánh dấu "đã làm" cho lịch nhắc của xe đã archive.** Khi archive xe, rule bị tắt. Nếu `markRuleDone` đặt lại `enabled = true`,
   lịch nhắc của xe đã xoá sẽ sống lại. Kỳ vọng: trả 404 và rule vẫn tắt. Test ở Task 5.
2. **Ranh giới nửa đêm giờ VN.** Lúc 01:00 sáng VN ngày 19 (tức 18:00Z ngày 18), `done_on = "2026-10-19"` phải được chấp nhận
   và `"2026-10-20"` phải bị từ chối. Test ở Task 4.
3. **Thông tin VIP lộ sang thợ.** Màn job của thợ chỉ được lấy brand, model, năm, biển số. Test ở Task 6.
4. **PATCH lịch nhắc làm mất `item_code` / `last_done_on`.** Sửa tiêu đề hoặc chu kỳ của một mẫu nhắc phải giữ nguyên 2 trường này. Test ở Task 5.
5. **Gói hết hạn đúng thời điểm `now`.** Khi `plan_expires_at === now` thì gói hiệu lực phải là `free` (điều kiện là `>` chặt). Test ở Task 2.

---

## Batch 0: Dọn test nền

### Task 0: Sửa danh sách migration đang sai

**Files:**
- Modify: `apps/api/src/server/db/__tests__/all-migrations.static.test.ts:41` (dòng `"202606250033_user_profile_extended.sql"`)
- Modify: `apps/api/src/server/db/__tests__/migration-lifecycle.integration.test.ts:104` (danh sách đang dừng ở 046)

- [ ] **Step 1:** Chạy `pnpm.cmd exec vitest run src/server/db/__tests__/all-migrations.static.test.ts`.
  Kỳ vọng FAIL: `ENOENT ... 202606250033_user_profile_extended.sql`.
- [ ] **Step 2:** Ở `all-migrations.static.test.ts`, xoá dòng `"202606250033_user_profile_extended.sql"` và thêm
  `"202606250047_user_profile_extended.sql"` vào cuối mảng, sau `046`. Ở `migration-lifecycle.integration.test.ts`, thêm cùng tên đó vào cuối danh sách.
- [ ] **Step 3:** Chạy lại lệnh ở Step 1. Kỳ vọng PASS.
- [ ] **Step 4:** Chạy `pnpm.cmd test` ở root. Kỳ vọng chỉ còn `admin-delivery-audit.test.ts` đỏ (1 test).
- [ ] **Step 5: Checkpoint.** `fix(test): align migration list with 202606250047`

---

## Batch 1: Schema

### Task 1: Migration 048 và kiểm tra schema

**Files:**
- Create: `supabase/migrations/202606250048_maintenance_presets_and_plans.sql`
- Modify: `apps/api/src/server/db/__tests__/all-migrations.static.test.ts` (danh sách và assertion enum)
- Modify: `apps/api/src/server/db/__tests__/migration-lifecycle.integration.test.ts` (thêm 048)
- Modify: `apps/api/src/server/db/backend-schema.mjs` (version và danh sách cột)

**Interfaces:**
- Produces: các cột `app_users.plan_code`, `app_users.plan_expires_at`, `reminder_rules.item_code`, `reminder_rules.last_done_on`,
  cùng 10 cột VIP trên `motorcycles` (spec 5.5). Các task sau dùng đúng những tên này.

- [ ] **Step 1: Viết test fail.** Thêm `"202606250048_maintenance_presets_and_plans.sql"` vào cuối `expectedMigrations`.
  Thêm vào test `"contains every closed enum and status value owned by implemented patches"`:

```ts
expect(migrationSql).toContain("plan_code in ('free', 'advance', 'vip')");
expect(migrationSql).toContain(
  "item_code in ('engine_oil', 'gear_oil', 'brake_fluid', 'coolant', 'insurance_renewal')"
);
expect(migrationSql).toContain("create unique index reminder_rules_motorcycle_item_uidx");
```

- [ ] **Step 2:** Chạy test static. Kỳ vọng FAIL vì chưa có file 048.
- [ ] **Step 3: Viết migration.** Viết đúng các chuỗi mà test ở Step 1 kiểm tra (chữ thường, có dấu cách sau dấu phẩy):

```sql
alter table app_users
  add column plan_code text not null default 'free',
  add column plan_expires_at timestamptz,
  add constraint app_users_plan_code_check check (plan_code in ('free', 'advance', 'vip')),
  add constraint app_users_plan_expiry_check check (
    (plan_code = 'free' and plan_expires_at is null)
    or (plan_code <> 'free' and plan_expires_at is not null));

alter table reminder_rules
  add column item_code text,
  add column last_done_on date,
  add constraint reminder_rules_item_code_check check (item_code is null or
    item_code in ('engine_oil', 'gear_oil', 'brake_fluid', 'coolant', 'insurance_renewal')),
  add constraint reminder_rules_last_done_requires_item check (last_done_on is null or item_code is not null);

create unique index reminder_rules_motorcycle_item_uidx
  on reminder_rules (motorcycle_id, item_code) where item_code is not null;
```

  Sau đó thêm vào `motorcycles` 10 cột nullable theo bảng ở spec 5.5:
  - text có check độ dài: `color` 1..50, `frame_number` 1..50, `engine_number` 1..50, `insurance_provider` 1..100,
    `insurance_policy_number` 1..100, `preferred_service_center` 1..200;
  - `date`: `purchase_date`, `insurance_expires_on`, `warranty_expires_on`;
  - `purchase_price_vnd numeric(12,0) check (purchase_price_vnd is null or purchase_price_vnd >= 0)`.

  Dùng đúng mẫu check của bảng `motorcycles` trong `202606250006`: `check (col is null or length(col) between 1 and N)`.
- [ ] **Step 4:** Ở `backend-schema.mjs`, đổi `REQUIRED_BACKEND_SCHEMA_VERSION` thành `"202606250048"`. Thêm vào danh sách cột bắt buộc
  (cùng chỗ với `('assignments', 'activated_at', ...)`) 3 dòng sau:
  `('app_users', 'plan_code', 'text')`, `('reminder_rules', 'item_code', 'text')`, `('motorcycles', 'frame_number', 'text')`.
  Một cột cho mỗi bảng là đủ, vì migration được áp dụng trọn gói. Thêm 048 vào `migration-lifecycle.integration.test.ts`.
- [ ] **Step 5:** Chạy `pnpm.cmd exec vitest run src/server/db/__tests__/all-migrations.static.test.ts`. Kỳ vọng PASS,
  kể cả test `"contains no refund, payout, or odometer schema"`.
- [ ] **Step 6:** Chạy `pnpm.cmd test`. Kỳ vọng như cuối Task 0.
- [ ] **Step 7: Checkpoint.** `feat(db): add plan, reminder preset and motorcycle detail columns`

> Sau batch này, server sẽ báo chưa sẵn sàng trên mọi DB chưa apply 047 + 048. **Không** apply lên production.
> Chỉ apply lên hosted dev khi user yêu cầu, theo `AGENTS.md`.

---

## Batch 2: Gói

### Task 2: Helper gói, repository user, `/auth/me`

**Files:**
- Create: `apps/api/src/features/plans/plan.ts`
- Test: `apps/api/src/features/plans/__tests__/plan.test.ts`
- Modify: `apps/api/src/server/repositories/contracts/user.repository.ts`
- Modify: `apps/api/src/server/repositories/postgres/user.repository.ts` (`UserRow`, mọi danh sách cột của `app_users` ở các dòng ~59, 76, 97, 106, 127, 170, 218, 240, và `mapUser` ở ~415)
- Modify: `apps/api/src/server/repositories/testing/in-memory-user.repository.ts`
- Modify: `apps/api/src/features/auth/auth.types.ts:18` (`RequestActor`), `apps/api/src/features/auth/auth.service.ts` (`toRequestActor` ~479, `getCurrentActor` ~34)
- Test: `apps/api/src/features/auth/__tests__/auth.service.test.ts`

**Interfaces:**
- Produces, trong `plan.ts`:
  - `export const planCodes = ["free", "advance", "vip"] as const;` và `export type PlanCode = (typeof planCodes)[number];`
  - `export type PlanHolder = { planCode?: PlanCode; planExpiresAt?: Date };` (`undefined` nghĩa là `free`)
  - `effectivePlan(holder: PlanHolder, now: Date): PlanCode`: trả `planCode` khi `planExpiresAt > now` (so chặt), ngược lại trả `"free"`.
  - `hasPlan(holder: PlanHolder, minimum: PlanCode, now: Date): boolean`: so theo hạng `free 0 < advance 1 < vip 2`.
  - `nextPlanExpiry(holder: PlanHolder, plan: "advance" | "vip", duration: "month" | "year", now: Date): Date`:
    tháng là 30 ngày, năm là 365 ngày. Nếu `effectivePlan(holder, now) === plan` thì cộng nối từ `planExpiresAt`, ngược lại cộng từ `now`.
  - `planRequiredDetails(required: "advance" | "vip"): { reason: "plan_required"; required_plan: "advance" | "vip" }`
- Produces, trong user contract:
  - `ApplicationUser` có thêm `planCode?: PlanCode; planExpiresAt?: Date;`
  - `UserRepository.updatePlan(id: string, planCode: PlanCode, planExpiresAt: Date | undefined, updatedAt: Date): Promise<ApplicationActor>`
- Produces: `RequestActor` có thêm `plan_code?: PlanCode; plan_expires_at?: string`. Để optional trong type vì có chỗ tạo object
  `RequestActor` thủ công, nhưng `toRequestActor` **luôn** đặt `plan_code`.

- [ ] **Step 1: Viết test fail** `plan.test.ts`, với `now = new Date("2026-10-18T03:00:00Z")`:
  - `effectivePlan({}, now)` là `"free"`;
  - `effectivePlan({ planCode: "advance", planExpiresAt: new Date(now.getTime() + 1) }, now)` là `"advance"`;
  - **(Review Focus 5)** `effectivePlan({ planCode: "vip", planExpiresAt: now }, now)` là `"free"`;
  - `hasPlan({ planCode: "vip", planExpiresAt: future }, "advance", now)` là `true`, còn
    `hasPlan({ planCode: "advance", planExpiresAt: future }, "vip", now)` là `false`;
  - `nextPlanExpiry({ planCode: "advance", planExpiresAt: new Date("2026-11-01T00:00:00Z") }, "advance", "month", now)`
    là `2026-12-01T00:00:00.000Z` (cộng nối);
  - `nextPlanExpiry({ planCode: "advance", planExpiresAt: future }, "vip", "year", now)` là `now + 365 ngày`
    (`2027-10-18T03:00:00.000Z`);
  - `nextPlanExpiry({ planCode: "advance", planExpiresAt: past }, "advance", "month", now)` là `now + 30 ngày`.
- [ ] **Step 2:** Chạy test. Kỳ vọng FAIL (module chưa có).
- [ ] **Step 3:** Cài đặt `plan.ts` theo các interface ở trên.
- [ ] **Step 4:** Thêm `plan_code, plan_expires_at` vào `UserRow` và **mọi** danh sách cột `app_users` trong postgres user repository.
  Map trong `mapUser`: `planCode: row.plan_code`, `planExpiresAt: row.plan_expires_at ?? undefined`.
  Cài `updatePlan` theo đúng mẫu `updateStatus` (update rồi trả actor kèm roles), và cài tương ứng cho in-memory repository.
- [ ] **Step 5: Viết test fail** trong `auth.service.test.ts`, gọi `getCurrentActor` với 3 trường hợp:
  - user không có gói: `plan_code: "free"` và không có `plan_expires_at`;
  - `planCode: "advance"` với `planExpiresAt = now + 1 ngày`: `plan_code: "advance"` và có `plan_expires_at` dạng ISO;
  - gói đã hết hạn: `plan_code: "free"` nhưng `plan_expires_at` vẫn có.
- [ ] **Step 6:** Đổi thành `toRequestActor(actor, now = new Date())`. Hàm luôn đặt `plan_code: effectivePlan(actor, now)`,
  và chỉ đặt `plan_expires_at` khi `actor.planExpiresAt` có giá trị. Trong `getCurrentActor`, truyền
  `this.options.now?.() ?? new Date()`. Các chỗ gọi khác giữ nguyên tham số mặc định.
- [ ] **Step 7:** Chạy `plan.test.ts` và `auth.service.test.ts`, rồi `pnpm.cmd run typecheck`. Kỳ vọng PASS.
  Nếu test nào đang `toEqual` toàn bộ object actor bị đỏ vì có thêm `plan_code`, sửa kỳ vọng cho có thêm `plan_code: "free"`.
- [ ] **Step 8: Checkpoint.** `feat(api): add rider plan fields and expose plan in /auth/me`

### Task 3: Admin cấp hoặc gia hạn gói

**Files:**
- Modify: `apps/api/src/features/admin/admin.schemas.ts` (thêm `adminPlanChangeSchema`, cạnh `adminReasonSchema` ở dòng 16)
- Modify: `apps/api/src/features/admin/admin-user-management.service.ts` (method mới, mẫu `changeStatus` ~279; `toUserResponse` ~610)
- Modify: `apps/api/src/features/admin/admin-user.route-handlers.ts` (type dependencies và handler, mẫu `suspendUser` ~93)
- Create: `apps/api/app/api/v1/admin/users/[userId]/plan/route.ts` (copy cấu trúc của `.../suspend/route.ts`, POST)
- Test: `apps/api/src/features/admin/__tests__/admin-user-management.service.test.ts`, `admin-user.route-handlers.test.ts`

**Interfaces:**
- Consumes: `nextPlanExpiry`, `planCodes`, `PlanCode` (Task 2); `users.updatePlan` (Task 2).
- Produces: `changeUserPlan(identity: VerifiedSupabaseIdentity, userId: string, input: unknown, idempotencyKey: string): Promise<AdminUserSummaryResponse>`.
  `AdminUserSummaryResponse` có thêm `plan_code: PlanCode` và `plan_expires_at?: string`. Đây là **giá trị đang lưu trong DB**,
  không phải gói hiệu lực, nên không cần đồng hồ.

- [ ] **Step 1: Viết test fail** trong service test. Fixture: một admin, một rider active, một mechanic không có role rider, `now` cố định.
  - `{ plan_code: "advance", duration: "month", reason }`: response có `plan_code: "advance"` và `plan_expires_at = now + 30 ngày`.
    Có 1 audit với `action: "admin.user.plan_changed"` và metadata chứa `previous_plan_code: "free"`, `plan_code: "advance"`.
  - Gọi lại cùng body với key mới: `plan_expires_at = now + 60 ngày` (cộng nối).
  - `{ plan_code: "vip", duration: "year" }`: `plan_expires_at = now + 365 ngày`.
  - `{ plan_code: "free" }`: `plan_code: "free"` và không có `plan_expires_at`.
  - Gửi cho mechanic: `409 CONFLICT`. Thiếu `duration` khi gói advance: `400`. Có `duration` khi gói free: `400`. Thiếu `reason`: `400`.
  - Gửi lại cùng key và cùng body: response giống hệt và vẫn chỉ có 1 audit.
- [ ] **Step 2:** Chạy test. Kỳ vọng FAIL.
- [ ] **Step 3:** Thêm schema:
  `adminPlanChangeSchema = z.object({ reason: adminReasonValueSchema, plan_code: z.enum(planCodes), duration: z.enum(["month", "year"]).optional() }).strict()`,
  kèm `superRefine`: `plan_code === "free"` khi và chỉ khi không có `duration`.
- [ ] **Step 4:** Cài `changeUserPlan` theo đúng các bước của `changeStatus`:
  `parseUuid` → parse schema (lỗi → `invalid`) → `loadActiveAdminActor` → `prepareCommand` với scope `"admin.user.plan"`
  và payload `{ user_id, plan_code, duration, reason }` → `findActorForUpdate` (không có → `notFound`) →
  target không có role `rider` hoặc không `active` → `conflict` → tính `expires`
  (`free` thì `undefined`, còn lại `nextPlanExpiry(target, plan, duration, now)`) → `users.updatePlan` → `toUserResponse` →
  `recordMutation` với action `"admin.user.plan_changed"`, metadata
  `{ user_id, previous_plan_code: target.planCode ?? "free", plan_code, plan_expires_at: expires?.toISOString() ?? null }` → `completeCommand`.
  Trong `toUserResponse`, thêm `plan_code: user.planCode ?? "free"` và thêm `plan_expires_at` khi có.
- [ ] **Step 5:** Thêm handler `changeUserPlan: (request, userId) => mutationOperation(...)` theo mẫu `suspendUser`, và tạo file route.
  Thêm 1 test route-handler, mô phỏng test của `suspendUser`: handler phải chuyển đúng `userId`, `body` và idempotency key.
- [ ] **Step 6:** Chạy 2 file test admin user. Kỳ vọng PASS. Nếu test nào `toEqual` toàn bộ summary bị đỏ, thêm `plan_code: "free"` vào kỳ vọng.
- [ ] **Step 7:** Chạy `pnpm.cmd test` và `pnpm.cmd run typecheck`.
- [ ] **Step 8: Checkpoint.** `feat(admin): grant and extend rider plans`

---

## Batch 3: Mẫu nhắc

### Task 4: Ngày giờ VN và danh mục mẫu nhắc (hàm thuần)

**Files:**
- Create: `apps/api/src/lib/vietnam-date.ts`
- Test: `apps/api/src/lib/__tests__/vietnam-date.test.ts`
- Create: `apps/api/src/features/reminders/reminder-presets.ts`
- Test: `apps/api/src/features/reminders/__tests__/reminder-presets.test.ts`

**Interfaces:**
- Produces, trong `vietnam-date.ts`:
  - `vietnamToday(now: Date): string`: ngày `YYYY-MM-DD` theo giờ VN (`now + 7h`).
  - `isIsoDate(value: string): boolean`: khớp `^\d{4}-\d{2}-\d{2}$` và là ngày có thật (round-trip qua `Date.UTC`).
  - `vietnamMorningUtc(date: string, offsetDays = 0): Date`: `Date.UTC(y, m - 1, d + offsetDays, 2, 0, 0)`.
  - `isPastOrTodayVietnam(date: string, now: Date, maxAgeDays: number): boolean`: `isIsoDate`, không sau `vietnamToday(now)`,
    và không sớm hơn `vietnamToday(now) - maxAgeDays`.
- Produces, trong `reminder-presets.ts`:
  - `reminderItemCodes = ["engine_oil", "gear_oil", "brake_fluid", "coolant", "insurance_renewal"] as const` và `ReminderItemCode`.
  - `usageLevels = ["light", "normal", "heavy"] as const`, `UsageLevel`, `KM_PER_DAY = { light: 15, normal: 30, heavy: 100 }`.
  - `UNKNOWN_LAST_DONE_DUE_DAYS = 7`, `MAX_DONE_AGE_DAYS = 3650`.
  - `type ReminderPreset = { itemCode; title; requiredPlan: "advance" | "vip"; basisKm?: number; maxDays: number; leadDays: number }`.
  - `reminderPresets: readonly ReminderPreset[]` với giá trị lấy **nguyên văn** từ spec 5.3 (title) và 11.2:
    - `engine_oil`: basisKm 3000, maxDays 180;
    - `gear_oil`: basisKm 10000, maxDays 730;
    - `brake_fluid`: maxDays 730;
    - `coolant`: maxDays 1095;
    - `insurance_renewal`: maxDays 365, leadDays 14, requiredPlan `"vip"`.
  - `findPreset(code: ReminderItemCode): ReminderPreset` (code đã qua Zod nên luôn tồn tại).
  - `intervalDaysFor(preset: ReminderPreset, level: UsageLevel): number`. Thuật toán:
    `basisKm ? Math.max(30, Math.floor(Math.min(basisKm / KM_PER_DAY[level], maxDays) / 30) * 30) : maxDays`.
  - `computeNextDueAt(input: { lastDoneOn?: string; intervalDays: number; leadDays: number; now: Date }): Date`:
    - không có `lastDoneOn`: `vietnamMorningUtc(vietnamToday(now), UNKNOWN_LAST_DONE_DUE_DAYS)`;
    - có `lastDoneOn`: `due = vietnamMorningUtc(lastDoneOn, intervalDays - leadDays)`, và nếu `due <= now` thì
      `vietnamMorningUtc(vietnamToday(now), 1)`.
  - `toPresetResponse(preset)`, trả về:
    `{ item_code, title, required_plan, interval_days: { light, normal, heavy }, lead_days }`.

- [ ] **Step 1: Viết test fail** `vietnam-date.test.ts`:
  - `vietnamToday(new Date("2026-10-18T16:59:59Z"))` là `"2026-10-18"`, còn `vietnamToday(new Date("2026-10-18T17:00:00Z"))` là `"2026-10-19"`;
  - `isIsoDate("2026-02-30")` là `false`;
  - **(Review Focus 2)** với `now = new Date("2026-10-18T18:00:00Z")`: `isPastOrTodayVietnam("2026-10-19", now, 3650)` là `true`,
    `isPastOrTodayVietnam("2026-10-20", now, 3650)` là `false`, `isPastOrTodayVietnam("2010-01-01", now, 3650)` là `false`.
- [ ] **Step 2: Viết test fail** `reminder-presets.test.ts`:
  - bảng `intervalDaysFor` đúng spec 11.2 (`light / normal / heavy`):
    - `engine_oil` → `180 / 90 / 30`
    - `gear_oil` → `660 / 330 / 90`
    - `brake_fluid` → `730 ×3`
    - `coolant` → `1095 ×3`
    - `insurance_renewal` → `365 ×3`
  - `computeNextDueAt`, với `now = new Date("2026-10-18T03:00:00Z")`:
    - `{ lastDoneOn: "2026-09-01", intervalDays: 90, leadDays: 0 }` → `"2026-11-30T02:00:00.000Z"`;
    - không có `lastDoneOn` → `"2026-10-25T02:00:00.000Z"`;
    - `{ lastDoneOn: "2026-01-01", intervalDays: 90, leadDays: 0 }` (đã quá hạn) → `"2026-10-19T02:00:00.000Z"`;
    - `{ lastDoneOn: "2026-03-15", intervalDays: 365, leadDays: 14 }` → `"2027-03-01T02:00:00.000Z"`;
  - mọi `title` có độ dài ≤ 200;
  - mỗi `reminderItemCodes` xuất hiện trong nội dung file `supabase/migrations/202606250048_maintenance_presets_and_plans.sql`
    (đọc bằng `readFileSync`, đường dẫn giống `all-migrations.static.test.ts`).
- [ ] **Step 3:** Chạy 2 test. Kỳ vọng FAIL.
- [ ] **Step 4:** Cài đặt 2 file theo các interface ở trên.
- [ ] **Step 5:** Chạy 2 test. Kỳ vọng PASS.
- [ ] **Step 6: Checkpoint.** `feat(reminders): add maintenance preset catalog`

### Task 5: Repository reminder, API bật mẫu nhắc và API "đã làm"

**Files:**
- Modify: `apps/api/src/server/repositories/contracts/reminder.repository.ts`
- Modify: `apps/api/src/server/repositories/postgres/reminder.repository.ts` (`ReminderRuleRow` ~14, `createRule` ~90, `mapRule` ~293, method mới)
- Modify: `apps/api/src/server/repositories/testing/in-memory-reminder.repository.ts`
- Modify: `apps/api/src/features/reminders/reminder.schemas.ts`, `reminder.service.ts`, `reminder.route-handlers.ts`
- Create: `apps/api/app/api/v1/reminder-presets/route.ts` (GET)
- Create: `apps/api/app/api/v1/motorcycles/[motorcycleId]/reminder-presets/route.ts` (POST)
- Create: `apps/api/app/api/v1/reminders/[reminderId]/done/route.ts` (POST)
- Test: `apps/api/src/features/reminders/__tests__/reminder.service.test.ts`, `reminder.routes.test.ts`

**Interfaces:**
- Consumes: mọi export của Task 4; `hasPlan`, `planRequiredDetails` (Task 2).
- Produces, trong reminder contract:
  - `ReminderRule` có thêm `itemCode?: ReminderItemCode; lastDoneOn?: string /* YYYY-MM-DD */`. `CreateReminderRule` tự có thêm 2 trường này qua `Omit`.
  - `findRuleByMotorcycleItem(motorcycleId: string, itemCode: ReminderItemCode): Promise<ReminderRule | undefined>`
  - `markRuleDone(input: { id: string; lastDoneOn: string; nextDueAt: Date; updatedAt: Date }): Promise<ReminderRule | undefined>`.
    Method này đặt `last_done_on`, `next_due_at`, `snoozed_until = null`, `enabled = true`.
- Produces, trong service:
  - `listReminderPresets(identity): Promise<{ unknown_last_done_due_days: number; items: ReturnType<typeof toPresetResponse>[] }>`
  - `applyReminderPresets(identity, motorcycleId: string, input: unknown): Promise<{ items: Array<ReminderRuleResponse & { created: boolean }> }>`
  - `markReminderDone(identity, reminderId: string, input: unknown): Promise<ReminderRuleResponse>`
  - `ReminderRuleResponse` có thêm `item_code?` và `last_done_on?`.

- [ ] **Step 1: Viết test fail** trong service test. Thêm tham số gói cho fixture `activeUser(id, plan?)`.
  Thêm 1 xe của rider đã archive (`archivedAt: now`). Các trường hợp:
  - `listReminderPresets`: trả 5 item, `unknown_last_done_due_days: 7`.
  - rider free gọi apply `engine_oil` → `403`, `details: { reason: "plan_required", required_plan: "advance" }`.
  - rider advance gọi apply `{ usage_level: "normal", items: [{ item_code: "engine_oil", last_done_on: "2026-09-01" }, { item_code: "gear_oil" }] }`
    → 2 item `created: true`. `engine_oil` có `interval_days: 90`, `next_due_at` đúng công thức Task 4, `last_done_on: "2026-09-01"`,
    `title` đúng như trong catalog. Snapshot có 2 audit `reminder.rule.created`.
  - rider advance gọi apply `insurance_renewal` → `403`, `required_plan: "vip"`.
  - gọi apply lần hai cho `engine_oil` → `created: false` và rule giữ nguyên.
  - `items` trùng `item_code` → `400`. Xe của rider khác → `403` (theo `loadOwnedMotorcycle` hiện có). Xe đã archive → `404`.
    `last_done_on` ở tương lai → `400`.
  - `markReminderDone({ done_on: "2026-10-18" })` → `last_done_on` được cập nhật, `next_due_at` tính lại, snooze bị xoá,
    có audit `reminder.rule.updated`.
  - gọi done cho lịch nhắc tay (không có `item_code`) → `400`. Gói đã hết hạn → `403`.
  - **(Review Focus 1)** gọi done cho rule của xe đã archive (rule seed `enabled: false`, `itemCode: "engine_oil"`) → `404`, rule vẫn `enabled: false`.
  - **(Review Focus 4)** `updateReminderRule` trên một mẫu nhắc → response vẫn còn `item_code` và `last_done_on`.
  - Sau khi apply: `new MotorcycleService(unitOfWork, { now: () => now }).getMotorcycle(identity(riderId), motorcycleId)`
    có `next_maintenance_at` bằng `next_due_at` sớm nhất trong các rule vừa tạo (spec 5.4). Mẫu nhắc tự động được tính vào ngày bảo dưỡng của xe.
- [ ] **Step 2:** Chạy test. Kỳ vọng FAIL.
- [ ] **Step 3: Repository.**
  - Postgres: thêm `item_code, last_done_on` vào câu insert trong `createRule` (`${input.lastDoneOn ?? null}::date`).
    Thêm `item_code: string | null; last_done_on: Date | string | null` vào `ReminderRuleRow`.
  - Trong `mapRule`, đổi về `YYYY-MM-DD` bằng một helper cục bộ một dòng:
    `typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10)`.
  - **Không** sửa `updateRule`, để PATCH giữ nguyên 2 cột mới.
  - Cài 2 method mới cho cả postgres và in-memory.
  - Nếu `pnpm.cmd run typecheck` báo còn implementation nào khác của `ReminderRepository`, thêm 2 method vào đó.
- [ ] **Step 4: Schema.**
  - `reminderPresetApplySchema = z.object({ usage_level: z.enum(usageLevels), items: z.array(z.object({ item_code: z.enum(reminderItemCodes), last_done_on: z.string().optional() }).strict()).min(1).max(5) }).strict()`,
    kèm `refine` kiểm `item_code` không trùng.
  - `reminderDoneSchema = z.object({ done_on: z.string() }).strict()`.
- [ ] **Step 5: Service.**
  - `applyReminderPresets` chạy theo thứ tự: parse (`400`) → `loadRiderActor` → `loadOwnedMotorcycle` → tính gói yêu cầu cao nhất
    trong `items`; nếu `!hasPlan` thì `ReminderError("FORBIDDEN", ..., 403, planRequiredDetails(...))` → mỗi `last_done_on` phải qua
    `isPastOrTodayVietnam(..., MAX_DONE_AGE_DAYS)`, sai thì `400` → với từng item: `findRuleByMotorcycleItem`. Có rồi thì trả
    `{ ...toReminderRuleResponse(rule), created: false }`. Chưa có thì `createRule` với `title`, `interval_days` (`intervalDaysFor`),
    `next_due_at` (`computeNextDueAt`), `enabled: true`, `itemCode`, `lastDoneOn`, rồi gọi `appendReminderAuditOutbox` với
    `"reminder.rule.created"`.
  - `markReminderDone` chạy theo thứ tự: parse → `loadRiderActor` → `loadOwnedReminderRule` → không có `itemCode` thì `400` →
    `loadOwnedMotorcycle(rule.motorcycleId)` (archive thì `404`) → kiểm gói → kiểm ngày → `markRuleDone` → audit `"reminder.rule.updated"`.
  - `listReminderPresets`: gọi `loadRiderActor`, rồi trả `{ unknown_last_done_due_days: UNKNOWN_LAST_DONE_DUE_DAYS, items: reminderPresets.map(toPresetResponse) }`.
- [ ] **Step 6: Route.**
  - Thêm 3 method vào type `ReminderRouteDependencies.reminderService` và 3 handler theo mẫu `snoozeReminderRule`. Cả 3 trả `200`.
  - Tạo 3 file route, copy cấu trúc của `reminders/[reminderId]/snooze/route.ts`.
  - Trong `reminder.routes.test.ts`, thêm 3 test với service giả:
    - mỗi route gọi đúng method và truyền đúng id;
    - một service ném lỗi 403 có `details` → body JSON chứa `details.required_plan`.
- [ ] **Step 7:** Chạy `pnpm.cmd exec vitest run src/features/reminders`. Kỳ vọng PASS, kể cả test cũ từ chối `odometer_km` ở dòng 84.
- [ ] **Step 8:** Chạy `pnpm.cmd test` và `pnpm.cmd run typecheck`.
- [ ] **Step 9: Checkpoint.** `feat(reminders): apply maintenance presets and mark done`

---

## Batch 4: Thông tin VIP

### Task 6: `PATCH /motorcycles/{id}/details`

**Files:**
- Modify: `apps/api/src/server/repositories/contracts/motorcycle.repository.ts`
- Modify: `apps/api/src/server/repositories/postgres/motorcycle.repository.ts` (`MotorcycleRow`, `mapMotorcycle`, method mới. **Không đụng** câu SQL `update` ở dòng 60–75)
- Modify: `apps/api/src/server/repositories/testing/in-memory-motorcycle.repository.ts`
- Modify: `apps/api/src/features/motorcycles/motorcycle.schemas.ts`, `motorcycle.service.ts`, `motorcycle.route-handlers.ts`
- Create: `apps/api/app/api/v1/motorcycles/[motorcycleId]/details/route.ts` (PATCH)
- Test: `apps/api/src/features/motorcycles/__tests__/motorcycle.service.test.ts`, `motorcycle.routes.test.ts`,
  `apps/api/src/features/mechanic-operations/__tests__/mechanic-job-list.service.test.ts`

**Interfaces:**
- Consumes: `hasPlan`, `planRequiredDetails` (Task 2); `isIsoDate`, `isPastOrTodayVietnam` (Task 4).
- Produces:
  - `type MotorcycleDetails = { color?: string; frameNumber?: string; engineNumber?: string; purchaseDate?: string; purchasePriceVnd?: number; insuranceProvider?: string; insurancePolicyNumber?: string; insuranceExpiresOn?: string; warrantyExpiresOn?: string; preferredServiceCenter?: string }`.
    `Motorcycle` có thêm `details?: MotorcycleDetails`. Để optional nên các fixture cũ không phải sửa.
  - `type MotorcycleDetailsPatch = { [K in keyof MotorcycleDetails]?: MotorcycleDetails[K] | null }`
    (`undefined` thì giữ nguyên, `null` thì xoá).
  - `MotorcycleRepository.updateDetails(input: { id: string; patch: MotorcycleDetailsPatch; updatedAt: Date }): Promise<Motorcycle | undefined>`
  - Service: `updateMotorcycleDetails(identity, motorcycleId: string, input: unknown): Promise<MotorcycleResponse>`.
  - `MotorcycleResponse` có thêm `details: Record<string, string | number>`, **luôn có**, chỉ chứa các key snake_case khác null (có thể là `{}`).

- [ ] **Step 1: Viết test fail** trong motorcycle service test:
  - rider free gửi `{ color: "Đỏ" }` → `403`, `required_plan: "vip"`.
  - rider free gửi `{ color: null }` → `200` (xoá luôn được phép, D14).
  - rider vip gửi `{ frame_number: "RLHJF1234", purchase_price_vnd: 32000000 }` → response
    `details: { frame_number: "RLHJF1234", purchase_price_vnd: 32000000 }`. Gửi tiếp `{ color: "Đỏ" }` → giữ `frame_number`, thêm `color`.
  - sau đó gọi `updateMotorcycle` (PATCH cơ bản) → `details` vẫn còn đủ (không bị xoá).
  - `purchase_date` ở tương lai → `400`. `purchase_price_vnd: -1` hoặc `1.5` → `400`. Body `{}` → `400`.
    Key lạ → `400` (schema strict).
  - audit và outbox `motorcycle.details_updated` có `changed_fields: ["frame_number", "purchase_price_vnd"]`.
    `JSON.stringify(snapshot.outboxEvents) + JSON.stringify(snapshot.auditLogs)` **không chứa** `"RLHJF1234"` và `"32000000"`.
- [ ] **Step 2: (Review Focus 3)** Trong `mechanic-job-list.service.test.ts`, seed xe có `details: { frameNumber: "RLHSECRET1" }`.
  Kỳ vọng `JSON.stringify(jobs)` không chứa `"RLHSECRET1"`.
- [ ] **Step 3:** Chạy các test trên. Kỳ vọng FAIL ở test service; test của thợ có thể PASS ngay, vì nó chỉ khoá hành vi hiện tại.
- [ ] **Step 4: Schema.** Thêm `motorcycleDetailsPatchSchema` (strict, mỗi trường `.nullable().optional()`):
  - chuỗi được `.trim()` rồi `min(1)`, `max` theo spec 5.5;
  - ngày: `z.string().refine(isIsoDate)`;
  - `purchase_price_vnd: z.number().int().min(0).max(999_999_999_999)`;
  - `refine`: có ít nhất 1 key khác `undefined`.
- [ ] **Step 5: Repository.**
  - Postgres: thêm 10 cột vào `MotorcycleRow`. Trong `mapMotorcycle`, chỉ đặt `details` khi có cột khác null:
    numeric dùng `Number(...)` như payment repository; ngày dùng cùng helper `YYYY-MM-DD` như Task 5.
  - `updateDetails` dùng `update motorcycles set ${this.sql(row)}, updated_at = ${updatedAt} where id = ${id} and archived_at is null returning *`.
    Trong đó `row` là object snake_case **chỉ gồm key khác `undefined`** (giá trị `null` vẫn giữ để xoá cột).
  - Cài tương ứng cho in-memory.
- [ ] **Step 6: Service.** `updateMotorcycleDetails` chạy theo thứ tự:
  parse → `loadRiderActor` → `loadOwnedMotorcycle` → `purchase_date` phải qua `isPastOrTodayVietnam` (giới hạn 36500 ngày),
  sai thì `400` → có giá trị khác null mà `!hasPlan(actor, "vip", now)` thì
  `MotorcycleError("FORBIDDEN", ..., 403, planRequiredDetails("vip"))` → `updateDetails` → outbox và audit
  `motorcycle.details_updated`, payload `{ resource_id, rider_id, changed_fields }` → trả response.
  Trong `toMotorcycleResponse`, thêm `details` (snake_case, bỏ key undefined).
- [ ] **Step 7: Route.** Thêm handler `updateMotorcycleDetails(request, motorcycleId)` theo mẫu handler PATCH xe, và tạo file route.
  Thêm 1 test route: chuyển đúng id/body; lỗi 403 có `details`.
- [ ] **Step 8:** Chạy `pnpm.cmd exec vitest run src/features/motorcycles src/features/mechanic-operations`. Kỳ vọng PASS.
- [ ] **Step 9:** Chạy `pnpm.cmd test` và `pnpm.cmd run typecheck`.
- [ ] **Step 10: Checkpoint.** `feat(motorcycles): VIP vehicle details with partial update`

---

## Batch 5: Tài liệu và verify cuối

### Task 7: Cập nhật `AGENTS.md` và chạy toàn bộ

**Files:**
- Modify: `AGENTS.md` (chỉ các mục backend: Backend MVP Status, API Routes, Core Services)

- [ ] **Step 1:** Trong `AGENTS.md`:
  - thêm 1 gạch đầu dòng vào Backend MVP Status: migration 048, gói tính lúc đọc, admin cấp gói, không có thanh toán gói;
  - thêm 5 route mới vào API Routes, mỗi route 1–2 dòng:
    - `GET /api/v1/reminder-presets`
    - `POST /api/v1/motorcycles/[motorcycleId]/reminder-presets`
    - `POST /api/v1/reminders/[reminderId]/done`
    - `PATCH /api/v1/motorcycles/[motorcycleId]/details`
    - `POST /api/v1/admin/users/[userId]/plan`
  - ghi `/auth/me` có thêm `plan_code` và `plan_expires_at`;
  - trỏ tới `apps/api/VEHICLE-MAINTENANCE-PLANS-DESIGN.md`.
- [ ] **Step 2:** Ở root, chạy `pnpm.cmd test`, `pnpm.cmd run typecheck`, `pnpm.cmd run lint`, `pnpm.cmd run build:api`.
  Kỳ vọng tất cả xanh, trừ lỗi có sẵn ở `admin-delivery-audit.test.ts:108`.
- [ ] **Step 3:** Grep lần cuối: `grep -rn -i -E "odometer|kilometer|mileage" ../../supabase/migrations/202606250048_*` không ra kết quả nào.
- [ ] **Step 4: Checkpoint.** `docs: document maintenance presets and rider plans`. Báo cáo cho user:
  danh sách route mới, kết quả từng lệnh, và nhắc rằng cần apply 047 + 048 lên hosted dev trước khi deploy.

---

## Không làm (theo spec mục 8)

Không làm các phần sau:
- thanh toán gói;
- admin chỉnh giá và chu kỳ gói;
- ảnh xe;
- linh kiện tự đặt tên;
- hạn đăng kiểm;
- lịch sử từng lần "đã làm";
- tự đánh dấu "đã làm" khi thợ hoàn tất job;
- sửa lỗi PATCH xe làm mất ghi chú (spec mục 10, chờ leader);
- cập nhật OpenAPI trong `specs/**`.
