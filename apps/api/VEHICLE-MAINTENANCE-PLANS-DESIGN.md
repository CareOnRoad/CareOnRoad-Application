# Thiết kế BE: Mẫu nhắc bảo dưỡng theo linh kiện + Gói Free / Advance / VIP

- **Trạng thái:** bản nháp, chờ leader duyệt. Chưa code gì.
- **Ngày:** 2026-10-18
- **Người đọc:** Cursor và Claude Code (cả hai làm theo cùng tài liệu này).
- **Phạm vi:** CHỈ backend: `apps/api/**`, `supabase/migrations/**`, và các mục backend trong `AGENTS.md`.
  **Không** sửa `apps/mobile`, `apps/web`, `packages/api-contract`.
- **Luôn tuân theo `AGENTS.md`.** Nếu tài liệu này mâu thuẫn với `AGENTS.md`, dừng lại và hỏi.

---

## 1. Bối cảnh và lý do

Đề xuất gốc (file Cursor `cursor_vehicle_management_feature_enhan.md`) muốn:
- cho rider nhập "lần thay gần nhất" của từng linh kiện, kèm số km;
- chia gói Free / Advance / VIP theo mức chi tiết thông tin xe.

Sau khi phản biện, team chốt lại như sau:

1. **Không theo dõi số km.** Bắt user nhập km thường xuyên rất phiền và dễ khiến họ xoá app.
   Repo cũng đang cố ý cấm schema km (xem mục 4).
2. **Theo dõi linh kiện theo thời gian, dựa trên lịch nhắc (`reminder_rules`) có sẵn.**
   Backend quy định chu kỳ nhắc.
3. **Gộp các món mòn theo km vào lịch thay nhớt.** Đó là phanh, lốp, sên/dây curoa, bugi, lọc gió.
   Khi đến hạn thay nhớt, thông báo sẽ nhắc user nhờ thợ kiểm tra luôn các món này.
4. **Gói làm theo file Cursor:** Free < Advance < VIP. Phần thanh toán gói **tạm bỏ qua**.
   Trong lúc chưa có thanh toán, admin cấp gói thủ công.
5. **Khi gói hết hạn hoặc bị hạ: không xoá, không ẩn, chỉ khoá phần thêm/sửa** những thứ thuộc gói cao.

### 1.1 Đề xuất tracking của team (ý chính, giữ nguyên tinh thần)

- **Bỏ "Số km" và "Màu" ở lúc nhập/hiển thị xe**, vì BE không lưu hai trường này. Hiện chúng đang hiện số giả "0 km" và "—".
  Đây là việc phía mobile, không làm trong tài liệu này. Phần của BE là **không** thêm cột km vào bảng xe.
  Màu chỉ có ở gói VIP (mục 5.5).
- **Form linh kiện điền thời gian là hợp lý.** User điền lần làm gần nhất, BE nhắc sau một khoảng thời gian **do BE quy định**.
- **Không tracking km.** Nếu tracking km thì ngày nào cũng phải hỏi user đi bao nhiêu km. Phiền như vậy thì user sẽ xoá app.
- **Các món thay theo km thì gộp vào lời nhắc thay nhớt.** Khi hệ thống nhắc đến hạn thay nhớt, nhắc luôn user nhờ thợ kiểm tra
  phanh, lốp, curoa…

**Vì sao cách gộp này hợp lý**
1. **Khớp với thói quen thật.** Người đi xe ở VN ra tiệm chủ yếu để thay nhớt. Đó là lúc thợ tiện xem luôn phanh, lốp, curoa,
   user không phải làm thêm việc gì.
2. **Ít thông báo hơn.** Chỉ còn vài lịch nhắc thay vì 6–7 lịch riêng, nên user ít có lý do tắt thông báo.
3. **Có lợi cho doanh thu.** Thợ kiểm tra thấy má phanh mòn thì có thêm một hạng mục trong báo giá.
4. **Không cần kênh thông báo mới.** Worker gửi thông báo có tiêu đề cố định "Đến lịch bảo dưỡng xe", còn nội dung chính là
   `rule.title` (`reminder.worker.ts:110-111`). Vì vậy câu "nhờ thợ kiểm tra luôn…" chỉ cần nằm trong `title`, tối đa 200 ký tự.

**Câu hỏi "đi xe ít / vừa / nhiều"**
- Shipper và xe công nghệ có thể chạy 3.000 km trong 2 tháng, nên dùng một chu kỳ chung cho mọi người sẽ nhắc họ quá trễ.
- Cách xử lý vẫn không cần tracking km: lúc bật mẫu nhắc, hỏi user **một câu duy nhất** về mức đi xe (`usage_level`).
  Mỗi xe chỉ hỏi một lần. Cách quy đổi ra số ngày ở mục 11.2.
- Phương án đã cân nhắc nhưng chưa làm: hỏi km mỗi lần thay nhớt (không phải mỗi ngày). Cách này chính xác hơn nhưng vẫn cần
  dữ liệu km, nên để sau.

### 1.2 Luồng sử dụng mong muốn (ngữ cảnh client, không làm ở BE)

Phần này mô tả màn hình để BE biết client sẽ gọi API nào. **Không** sửa mobile trong tài liệu này.

```
Bạn đi xe nhiều không?   ( ) Ít   (•) Vừa   ( ) Nhiều

Bạn muốn app nhắc gì cho xe Honda Vision?

☑ Thay nhớt máy (kèm kiểm tra má phanh, lốp, ắc quy, bugi, lọc gió, curoa/sên)
      mỗi 3 tháng      Lần gần nhất: [01/09/2026]
☑ Thay nhớt láp (xe ga)         mỗi 11 tháng   Lần gần nhất: [Không nhớ]
☐ Thay dầu phanh (phanh đĩa)    mỗi 2 năm
☐ Thay nước làm mát (két nước)  mỗi 3 năm
🔒 Gia hạn bảo hiểm (gói VIP)   Ngày hết hạn: [15/03/2027]

                    [ Bỏ qua ]   [ Bật nhắc ]
```

Số tháng hiển thị đổi theo mức đi xe (bảng 5.3). Mục có ổ khoá là mục user chưa đủ gói.

| Bước | Client làm gì | API BE |
|---|---|---|
| 1 | User thêm xe | `POST /api/v1/motorcycles` (có sẵn) |
| 2 | Hiện màn gợi ý: tên mục, chu kỳ theo mức đi xe, gói yêu cầu | `GET /api/v1/reminder-presets`, và gói hiện tại lấy từ `GET /api/v1/auth/me` |
| 3 | User chọn mức đi xe, tick mục, nhập "lần gần nhất" hoặc "Không nhớ", bấm **Bật nhắc** | `POST /api/v1/motorcycles/{id}/reminder-presets` |
| 4 | Đến hạn, user nhận thông báo "Đến lịch bảo dưỡng xe" với nội dung là `title` | Worker nhắc lịch có sẵn |
| 5 | User thay xong, bấm "Đã làm" | `POST /api/v1/reminders/{id}/done`, BE tính lần nhắc tiếp theo |
| 6 | User bấm **Bỏ qua** | Không gọi gì. User vẫn tự tạo lịch nhắc tay như hiện nay (Free) |

**Riêng bảo hiểm:** màn hình hỏi **ngày hết hạn**, còn API nhận `last_done_on`. Client gửi
`last_done_on = ngày hết hạn − 365 ngày`, tức ngày hợp đồng bắt đầu. BE sẽ nhắc trước hạn 14 ngày (`lead_days`).

### 1.3 Thay đổi so với đề xuất ban đầu (đọc kỹ để tránh làm theo bản cũ)

| Đề xuất ban đầu | Hiện tại | Lý do |
|---|---|---|
| "Dùng lại lịch nhắc có sẵn, không sửa database, không cần sửa BE" | **Có** sửa DB: thêm `item_code` và `last_done_on` cho `reminder_rules`, thêm cột gói cho `app_users`, thêm các cột VIP cho `motorcycles` | Team chốt thêm 3 việc: chu kỳ do BE quy định, chia gói (cần khoá theo gói), và lưu "lần làm gần nhất". Cả ba đều cần BE biết rule nào là mẫu nhắc linh kiện |
| Danh sách chu kỳ để trong mobile | Danh mục là hằng số ở BE, trả về qua `GET /api/v1/reminder-presets` | User muốn "BE quy định" thời gian |
| Chu kỳ nhớt 3 / 2 / 1 tháng (ít / vừa / nhiều) | 6 / 3 / 1 tháng | Tính lại theo khuyến cáo của hãng (mục 11) |
| Có mẫu "Kiểm tra ắc quy" riêng | Gộp vào lời nhắc thay nhớt | Honda kiểm tra ắc quy ở mỗi kỳ bảo dưỡng (mục 11) |
| Có mẫu "Kiểm tra lốp, phanh mỗi 3 tháng" và "Thay dây curoa" riêng | Gộp vào lời nhắc thay nhớt | Quyết định gộp các món mòn theo km (D3) |
| Không có mẫu dầu phanh | Thêm `brake_fluid` (2 năm) | Honda quy định thay định kỳ 2 năm |
| Bảo hiểm có ở mọi gói | Bảo hiểm thuộc gói VIP | Làm theo cách chia gói trong file Cursor (xem lại ở mục 9) |

## 2. Mục tiêu, không làm, điều cấm

**Mục tiêu**
- Rider có gói Advance trở lên bật được các mẫu nhắc bảo dưỡng do BE quy định cho từng xe,
  và đánh dấu được "đã làm" để BE tính lại lần nhắc tiếp theo.
- Rider có gói VIP lưu được thông tin chi tiết của xe (mục 5.5).
- Admin cấp, gia hạn và hạ gói cho rider.
- `GET /api/v1/auth/me` trả về gói hiện tại.

**Không làm trong đợt này**
- Thanh toán gói (Google Play Billing hay payOS vẫn chưa chốt).
- Cho admin chỉnh giá và chu kỳ gói. Phần này chỉ có ý nghĩa khi có thanh toán, xem mục 8.
- Ảnh xe, linh kiện tự đặt tên, hạn đăng kiểm (lý do ở mục 8).
- Mọi thứ liên quan đến km/odometer.
- Mọi sửa đổi ở mobile, web hoặc contract package.

**Điều cấm (làm vậy là sai, dù code chạy được)**
- Xoá hoặc ẩn dữ liệu user đã nhập khi gói hết hạn.
- Đưa giá trị nhạy cảm (số khung, số máy, số hợp đồng bảo hiểm, giá mua) vào audit, outbox hoặc log.
- Lách guard odometer, ví dụ đặt tên cột `current_mileage_km` để regex không bắt được.
  Không dùng các chữ `odometer`, `kilometer`, `mileage` ở bất kỳ đâu trong migration, kể cả comment.
- Làm hỏng các tính năng Free đang có. Rider Free vẫn tự tạo lịch nhắc tay như hiện nay.

## 3. Bảng quyết định

| # | Quyết định | Ai quyết |
|---|---|---|
| D1 | Không tracking km, không thêm cột km | User/leader |
| D2 | Tracking linh kiện = mẫu nhắc theo thời gian, chu kỳ do BE quy định | User/leader |
| D3 | Phanh, lốp, sên/curoa, bugi, lọc gió được gộp vào nội dung nhắc thay nhớt | User/leader |
| D4 | Gói Free < Advance < VIP theo file Cursor, gói cao có đủ quyền của gói thấp | User/leader |
| D5 | Thời hạn gói tính theo tháng, admin có thể chọn tháng hoặc năm | User/leader |
| D6 | Thanh toán gói tạm bỏ qua | User/leader |
| D7 | Hết hạn hoặc hạ gói thì không xoá, không ẩn, chỉ khoá thêm/sửa | Claude (user giao quyết) |
| D8 | Lịch nhắc đã bật vẫn chạy sau khi hết hạn | Claude, xem mục 9 |
| D9 | Không có job chạy ngầm để "hết hạn gói"; gói hiệu lực tính lúc đọc | Claude |
| D10 | 1 tháng = 30 ngày, 1 năm = 365 ngày | Claude |
| D11 | Admin đổi sang gói khác thì có hiệu lực ngay, không tính bù số ngày còn dư | Claude |
| D12 | Gia hạn cùng gói khi còn hạn thì cộng nối từ ngày hết hạn cũ | Claude |
| D13 | Thông tin VIP dùng endpoint riêng có ngữ nghĩa sửa một phần, không đi qua PATCH xe hiện tại | Claude, xem mục 4 |
| D14 | Xoá (gửi `null`) thông tin VIP luôn được phép, kể cả khi hết gói | Claude |
| D15 | Lỗi thiếu gói dùng mã `FORBIDDEN` có sẵn kèm `details`, không thêm mã lỗi mới | Claude |

## 4. Hiện trạng codebase (đã kiểm ngày 2026-10-18)

**Lịch nhắc**
- Bảng `reminder_rules` (`supabase/migrations/202606250011_reminders.sql`) có:
  `motorcycle_id`, `title`, `interval_days`, `next_due_at`, `snoozed_until`, `enabled`, `last_completed_at`.
- `last_completed_at` là **lúc worker bắn nhắc** (`src/server/workers/reminder.worker.ts:73-75`),
  **không phải** lúc user thay nhớt. Vì vậy cần một cột riêng `last_done_on`.
- Worker bắn nhắc rồi tự lùi `next_due_at` thêm `interval_days` (`nextRecurringDueAt`, `reminder.worker.ts:97`).
- Thông báo có tiêu đề cố định "Đến lịch bảo dưỡng xe", còn nội dung là `rule.title`
  (`reminder.worker.ts:110-111`). Vì vậy câu "nhờ thợ kiểm tra luôn..." đặt trong `title` là đủ.
- `reminderRuleInputSchema` (`src/features/reminders/reminder.schemas.ts`) là schema strict.
  Test `reminder.service.test.ts:84` bắt buộc từ chối `odometer_km`. Giữ nguyên test này.

**Xe**
- `PATCH /api/v1/motorcycles/{id}` hiện **thay toàn bộ**: trường optional nào không gửi lên sẽ bị ghi `null`
  (`src/server/repositories/postgres/motorcycle.repository.ts:60-75`).
  Nếu nhét thông tin VIP vào endpoint này, một lần sửa tên xe sẽ xoá sạch thông tin VIP. Đây là lý do của D13.
- `motorcycles` có policy `motorcycles_owner_select` (`202606250014_indexes_constraints_rls.sql:178`).

**Guard chống km (giữ nguyên, không lách)**
- `src/server/db/__tests__/all-migrations.static.test.ts:240`: không migration nào được chứa `odometer|kilometer|mileage`.
- `src/features/mechanic-operations/__tests__/mechanic-operations-scope.static.test.ts:35`
- `src/features/reminders/__tests__/reminder.service.test.ts:84`

**Admin**
- Pattern cho mutation admin (reason + `X-Idempotency-Key` + audit):
  `src/features/admin/admin-user-management.service.ts` (`suspendUser`) và `admin-user.route-handlers.ts`.

**Mã lỗi**
- `src/lib/api-error.ts` chưa có mã lỗi nào cho gói. Dùng `FORBIDDEN` kèm `details` (D15).

**Kiểm tra schema khi release**
- `src/server/db/backend-schema.mjs` có `REQUIRED_BACKEND_SCHEMA_VERSION = "202606250046"` và một danh sách cột bắt buộc.

**Test nền đang đỏ sẵn trước khi làm (không phải do thiết kế này)**
Chạy `vitest run` ngày 2026-10-18 cho kết quả **789/790 test qua, 2 file đỏ**:
1. `all-migrations.static.test.ts`: danh sách `expectedMigrations` vẫn ghi `202606250033_user_profile_extended.sql`,
   nhưng file thật tên là `202606250047_user_profile_extended.sql`. Sửa ở Batch 0.
2. `admin-delivery-audit.test.ts:108`: một assertion `toMatchObject` lệch. Không thuộc phạm vi, chỉ ghi nhận, không sửa.

## 5. Thiết kế chi tiết

### 5.1 Gói của user

**Lưu trữ:** thêm 2 cột vào `app_users`. Không tạo bảng gói riêng.

```sql
plan_code text not null default 'free' check (plan_code in ('free','advance','vip')),
plan_expires_at timestamptz,
check ((plan_code = 'free' and plan_expires_at is null)
    or (plan_code <> 'free' and plan_expires_at is not null))
```

**Gói hiệu lực (tính lúc đọc, không cần worker):**
- `effectivePlan = plan_code` nếu `plan_expires_at > now`, ngược lại là `'free'`.
- Thứ hạng: `free (0) < advance (1) < vip (2)`. `hasPlan(actor, min, now)` trả `true` khi hạng gói hiệu lực ≥ hạng `min`.

**Vị trí code:** `src/features/plans/plan.ts`. Chỉ gồm type `PlanCode`, bảng hạng, `effectivePlan` và `hasPlan`.
Không viết thêm class hay wrapper.

**Lỗi khi thiếu gói:** service của từng feature tự ném lỗi của mình, ví dụ `ReminderError` hoặc `MotorcycleError`:
- status `403`, `error_code: "FORBIDDEN"`
- `details: { reason: "plan_required", required_plan: "advance" | "vip" }`

**Quy tắc hết hạn / hạ gói (D7, D8):**

| Thứ gì | Khi gói hiệu lực thấp hơn yêu cầu |
|---|---|
| Đọc dữ liệu (xe, chi tiết VIP, lịch nhắc có `item_code`) | Luôn trả đầy đủ |
| Áp dụng mẫu nhắc mới, đánh dấu "đã làm" | 403 |
| Đặt giá trị khác `null` cho trường VIP | 403 |
| Xoá trường VIP (gửi `null`) | Cho phép (D14) |
| Worker bắn lịch nhắc đã có | Vẫn chạy, không kiểm tra gói |
| PATCH, snooze, tắt một lịch nhắc đã có | Cho phép như hiện nay, để user luôn tắt được nhắc |

**`GET /api/v1/auth/me`:** thêm 2 trường.
- `plan_code`: gói **hiệu lực**.
- `plan_expires_at`: lấy từ DB, chỉ trả khi khác `null`. FE tự nhận ra "đã hết hạn" khi `plan_code = "free"` mà `plan_expires_at` vẫn có.

Code nằm ở `getCurrentActor` (`src/features/auth/auth.route-handlers.ts:59-62` → auth service).

### 5.2 Admin cấp hoặc gia hạn gói

`POST /api/v1/admin/users/{userId}/plan`. Header `X-Idempotency-Key` là bắt buộc.

```json
{ "plan_code": "advance", "duration": "month", "reason": "Cap goi demo cho tester" }
```

- `plan_code`: `free | advance | vip`.
- `duration`: `month | year`, bắt buộc khi `plan_code` khác `free`, bị cấm khi là `free`.
- `reason`: theo đúng schema reason của các mutation admin hiện có.

**Logic:**
- Người được cấp phải có role `rider` và đang `active`. Nếu không, trả `409 CONFLICT`.
- `free`: đặt `plan_code = 'free'`, `plan_expires_at = null`.
- Cùng gói và còn hạn: `expires = plan_expires_at + N` (D12).
- Còn lại (gói khác, hoặc đã hết hạn): `expires = now + N` (D11).
- `N` là 30 ngày cho tháng, 365 ngày cho năm (D10).
- Audit: `admin.user.plan_changed`, metadata `{ resource_id, previous_plan_code, plan_code, plan_expires_at }`.
  Dùng helper ghi admin action và idempotency đang có, theo đúng `suspendUser`.
- Trả về bản tóm tắt user đã redact, giống các mutation admin user khác, có thêm `plan_code` và `plan_expires_at`.

Nên thêm `plan_code` và `plan_expires_at` vào response chi tiết user của admin để admin thấy được mình đã cấp gì.

### 5.3 Danh mục mẫu nhắc (BE quy định)

**File:** `src/features/reminders/reminder-presets.ts`. Là hằng số trong code, không lưu trong DB.

| `item_code` | `title` (cũng chính là nội dung thông báo) | Gói tối thiểu | `interval_days` light / normal / heavy | `lead_days` |
|---|---|---|---|---|
| `engine_oil` | Thay nhớt máy. Nhờ thợ kiểm tra luôn má phanh, lốp, ắc quy, bugi, lọc gió, dây curoa (xe ga) hoặc sên (xe số). | advance | 180 / 90 / 30 | 0 |
| `gear_oil` | Thay nhớt láp (xe tay ga). | advance | 660 / 330 / 90 | 0 |
| `brake_fluid` | Thay dầu phanh (xe phanh đĩa). | advance | 730 / 730 / 730 | 0 |
| `coolant` | Thay nước làm mát (xe có két nước). | advance | 1095 / 1095 / 1095 | 0 |
| `insurance_renewal` | Gia hạn bảo hiểm TNDS bắt buộc. | vip | 365 / 365 / 365 | 14 |

- **Các chu kỳ được tính từ khuyến cáo của hãng.** Cách tính và nguồn ở mục 11.
  Muốn sửa số thì chỉ cần sửa hằng số, không cần migration.
- **Bỏ mẫu `battery` riêng.** Honda kiểm tra ắc quy ở mỗi kỳ 6.000 km hoặc hằng năm (mục 11), nên việc này đã được gộp vào lời nhắc thay nhớt.
- **Thêm mẫu `brake_fluid`.** Honda quy định thay định kỳ 2 năm.
- `usage_level` là `light | normal | heavy` ("đi xe ít / vừa / nhiều"). Giá trị này chỉ dùng để chọn
  `interval_days` lúc tạo, không lưu lại. Bảng quy đổi km/ngày ở mục 11.
- Mỗi `title` phải ≤ 200 ký tự (giới hạn của DB), có test kiểm.

**Công thức tính `next_due_at`** (hàm thuần, có test riêng):
- Giờ nhắc là 09:00 giờ Việt Nam, tức `YYYY-MM-DDT09:00:00+07:00` (VN không đổi giờ theo mùa).
- Có `last_done_on`: `due = last_done_on + interval_days - lead_days` (lúc 09:00).
- Không có `last_done_on` ("không nhớ"): `due = hôm nay + 7 ngày` (hằng số `UNKNOWN_LAST_DONE_DUE_DAYS = 7`),
  để user đi kiểm tra sớm.
- Nếu `due <= now` (đã quá hạn): `due = ngày mai` lúc 09:00.
- Kiểm tra `last_done_on` / `done_on`: đúng định dạng `YYYY-MM-DD`, không sau hôm nay (giờ VN),
  không sớm hơn hôm nay trừ 3650 ngày. Sai thì trả 400 `INVALID_INPUT`.

### 5.4 Thay đổi `reminder_rules` và các API mới

**Migration:**

```sql
alter table reminder_rules
  add column item_code text check (item_code is null or item_code in
    ('engine_oil','gear_oil','brake_fluid','coolant','insurance_renewal')),
  add column last_done_on date,
  add constraint reminder_rules_last_done_requires_item check (last_done_on is null or item_code is not null);
create unique index reminder_rules_motorcycle_item_uidx
  on reminder_rules (motorcycle_id, item_code) where item_code is not null;
```

**Repository** (contract, postgres và in-memory đều phải sửa):
- `ReminderRule` có thêm `itemCode?` và `lastDoneOn?`. Định dạng của `lastDoneOn` theo cách repo đang map cột `date`, kiểm trước khi chọn.
- `createRule` nhận thêm `itemCode?` và `lastDoneOn?`.
- Method mới `findRuleByMotorcycleItem(motorcycleId, itemCode)`.
- Method mới `markRuleDone({ id, lastDoneOn, nextDueAt, updatedAt })`. Method này cũng đặt `snoozed_until = null` và `enabled = true`.
- `ReminderRuleResponse` có thêm `item_code?` và `last_done_on?`.

**API 1: xem danh mục**

`GET /api/v1/reminder-presets`, chỉ cần rider đã đăng nhập.

```json
{
  "unknown_last_done_due_days": 7,
  "items": [
    { "item_code": "engine_oil", "title": "Thay nhớt máy. Nhờ thợ kiểm tra luôn ...",
      "required_plan": "advance",
      "interval_days": { "light": 90, "normal": 60, "heavy": 30 }, "lead_days": 0 }
  ]
}
```

**API 2: bật mẫu nhắc cho một xe**

`POST /api/v1/motorcycles/{motorcycleId}/reminder-presets`

```json
{
  "usage_level": "normal",
  "items": [
    { "item_code": "engine_oil", "last_done_on": "2026-09-01" },
    { "item_code": "gear_oil" }
  ]
}
```

- Schema strict. `items` có 1–5 phần tử, `item_code` không được trùng nhau.
- Xe phải thuộc rider và chưa bị archive. Nếu không, trả 404 giống cách hiện tại.
- Rider phải có gói ≥ gói yêu cầu **cao nhất** trong `items`. Nếu không, trả 403 (mục 5.1).
- Mỗi item:
  - nếu đã có rule `(motorcycle_id, item_code)` thì **giữ nguyên**, trả về rule đó với `"created": false`;
  - nếu chưa có thì tạo rule với `title`, `interval_days` lấy từ danh mục, `next_due_at` theo công thức ở 5.3,
    `enabled = true`, `item_code`, `last_done_on`.
- Tất cả nằm trong **một transaction**. Mỗi rule mới ghi audit/outbox bằng `appendReminderAuditOutbox`
  với action `reminder.rule.created` có sẵn.
- Hai request chạy song song có thể đụng unique index và nhận lỗi DB conflict qua cơ chế map lỗi hiện có. Chấp nhận điều này.
- Trả về `200 { "items": [ { ...ReminderRuleResponse, "created": true } ] }`.
- Không cần `X-Idempotency-Key`: gọi lại nhiều lần cho kết quả giống nhau nhờ quy tắc "đã có thì giữ nguyên".

**API 3: đánh dấu đã làm**

`POST /api/v1/reminders/{reminderId}/done`

```json
{ "done_on": "2026-10-18" }
```

- Rule phải thuộc rider. Nếu không, trả 404.
- Rule phải có `item_code`. Nếu không, trả 400 `INVALID_INPUT`. Lịch nhắc tay không dùng API này.
- Gói hiệu lực phải ≥ gói yêu cầu của `item_code`. Nếu không, trả 403.
- `done_on` kiểm theo 5.3. Tính `next_due_at` bằng cùng công thức, với `last_done_on = done_on`.
- Gọi `markRuleDone`. Ghi audit/outbox với action `reminder.rule.updated` có sẵn.
- Trả về `ReminderRuleResponse`.

**API cũ giữ nguyên:**
- `POST /api/v1/reminders` vẫn dùng schema strict cũ. Client **không** tự gửi `item_code` được, mẫu nhắc chỉ tạo qua API 2.
- `PATCH /api/v1/reminders/{id}` giữ nguyên `item_code` và `last_done_on` của rule.
- Rule có `item_code` tự động được tính vào `next_maintenance_at` của xe vì đã nằm trong `reminder_rules`.
  Kiểm lại bằng test.

### 5.5 Thông tin chi tiết xe (VIP)

**Migration:** thêm vào `motorcycles`, tất cả nullable.

| Cột | Kiểu | Ràng buộc |
|---|---|---|
| `color` | text | 1..50 ký tự |
| `frame_number` (số khung) | text | 1..50 |
| `engine_number` (số máy) | text | 1..50 |
| `purchase_date` | date | |
| `purchase_price_vnd` | numeric(12,0) | ≥ 0 |
| `insurance_provider` | text | 1..100 |
| `insurance_policy_number` | text | 1..100 |
| `insurance_expires_on` | date | |
| `warranty_expires_on` | date | |
| `preferred_service_center` | text | 1..200 |

File Cursor đặt tên `vin_number`. Đổi thành `frame_number` vì xe máy ở VN dùng "số khung".

**API:** `PATCH /api/v1/motorcycles/{motorcycleId}/details`, là endpoint **riêng** (D13).
- Ngữ nghĩa **sửa một phần**: không gửi trường thì giữ nguyên, gửi `null` thì xoá, gửi giá trị thì ghi.
- Schema strict, phải có ít nhất 1 trường. Trim chuỗi. `purchase_date` không được ở tương lai.
- Có **ít nhất một giá trị khác `null`** thì phải có gói VIP hiệu lực, nếu không trả 403.
  Request chỉ toàn `null` thì luôn được phép (D14).
- Repository: method mới `updateDetails(id, patch, updatedAt)`, chỉ đụng các cột ở bảng trên.
  **Không sửa câu SQL `update` cơ bản hiện có**, để PATCH xe cũ không bao giờ đụng tới thông tin VIP.
- Audit/outbox: action và topic `motorcycle.details_updated`.
  Payload **chỉ chứa** `{ resource_id, rider_id, changed_fields: [...tên cột] }`, **không chứa giá trị**.

**Response xe** (`GET /motorcycles`, `GET /motorcycles/{id}`, POST, PATCH và PATCH details) có thêm
`details: { ...các trường khác null }`. Chỉ chủ xe thấy.

**Admin không được thấy thông tin VIP:** kiểm các read model admin có dùng dữ liệu xe
(`grep -rn "motorcycle" src/features/admin src/server/repositories/postgres/admin*`) để bảo đảm chúng
không map các cột mới. Nếu có chỗ nào `select *` rồi map toàn bộ, phải chặn lại.

### 5.6 Migration và kiểm tra schema

- File mới: `supabase/migrations/202606250048_maintenance_presets_and_plans.sql`, gồm phần `app_users` (5.1),
  `reminder_rules` (5.4) và `motorcycles` (5.5).
- Không dùng các chữ `odometer`, `kilometer`, `mileage` ở bất kỳ đâu trong file.
- `all-migrations.static.test.ts`: thêm `202606250048_...` vào `expectedMigrations`, và thêm assertion cho
  các giá trị closed enum mới (`plan_code`, `item_code`).
- `src/server/db/backend-schema.mjs`:
  - thêm các cột mới vào danh sách cột bắt buộc;
  - đổi `REQUIRED_BACKEND_SCHEMA_VERSION` thành `"202606250048"`.
- **Cảnh báo:** sau khi đổi version, readiness sẽ báo fail trên DB nào chưa apply 047 + 048.
  Theo `AGENTS.md`, phải apply và verify trên hosted dev (`npx.cmd supabase db push --dry-run`, rồi `db push`)
  trước khi deploy. **Không bao giờ apply lên production trong lúc test.**

## 6. Test cần có

- `plan.test.ts`: `effectivePlan` cho các trường hợp còn hạn, hết hạn, free; thứ hạng gói.
- `reminder-presets.test.ts`:
  - công thức có `last_done_on`, không có, đã quá hạn, và `lead_days` của bảo hiểm;
  - mọi `title` ≤ 200 ký tự;
  - các `item_code` trong hằng số khớp với check trong migration.
- Reminder service và route:
  - apply với gói free → 403; gói advance → tạo rule; item cần vip mà chỉ có advance → 403;
  - apply trùng → giữ nguyên rule cũ, `created: false`; xe của người khác hoặc đã archive → 404; transaction rollback khi có item lỗi;
  - done: rule tay → 400; gói hết hạn → 403; ngày ở tương lai → 400; tính lại `next_due_at`; xoá snooze;
  - test cũ từ chối `odometer_km` vẫn qua.
- Motorcycle service và route:
  - details sửa một phần (không gửi → giữ, `null` → xoá khi không có gói, giá trị → cần VIP);
  - **PATCH xe cơ bản không xoá details**;
  - audit/outbox không chứa giá trị nhạy cảm.
- Admin: cấp gói, gia hạn cùng gói (cộng nối), đổi sang gói khác, về free, replay idempotency, người được cấp không phải rider → 409, thiếu reason → 400.
- Auth: `/auth/me` trả `plan_code` hiệu lực và `plan_expires_at`.
- Static: danh sách migration, closed enum, không có chữ km.

## 7. Thứ tự làm

Mỗi batch phải xanh rồi mới sang batch tiếp. Lệnh chạy trong `apps/api`:
`pnpm.cmd test`, `pnpm.cmd run typecheck`, `pnpm.cmd run lint`. Batch cuối chạy thêm `pnpm.cmd run build:api`.

| Batch | Nội dung | Xong khi |
|---|---|---|
| 0 | Sửa `expectedMigrations`: `033_user_profile_extended` → `047_user_profile_extended` | `all-migrations.static.test.ts` xanh. Chỉ còn lỗi có sẵn ở `admin-delivery-audit.test.ts` |
| 1 | Migration 048, static test, `backend-schema.mjs` | Static test xanh |
| 2 | Gói: users repository (contract, postgres, in-memory), `plan.ts`, `/auth/me`, API admin cấp gói | Test gói, admin, auth xanh |
| 3 | Danh mục mẫu nhắc, API 1/2/3, repository reminder | Test reminder xanh |
| 4 | Thông tin VIP: schema, repository `updateDetails`, endpoint details, response, kiểm admin redaction | Test motorcycle xanh |
| 5 | Cập nhật `AGENTS.md` (routes, migration 048, mô tả gói), chạy toàn bộ lệnh verify | Mọi lệnh xanh, trừ lỗi có sẵn đã ghi ở mục 4 |

Không commit, push hay deploy khi chưa được phép (theo `AGENTS.md`).

## 8. Hoãn lại và lý do

| Hạng mục | Lý do |
|---|---|
| Thanh toán gói | Chưa chốt dùng Google Play Billing (app lên Google Play, gói mở khoá tính năng số) hay đổi gói thành gói dịch vụ để dùng payOS. `payment_orders` hiện bắt buộc có `quote_id` và `assignment_id` (`202606250020_payments.sql:22-24`) |
| Admin chỉnh giá và chu kỳ gói | Nếu dùng Play Billing thì giá nằm trên Play Console. Nếu dùng payOS thì tái sử dụng `admin_operation_configs` (`202606250045_admin_dispatch_configuration.sql:21`, có version và reason). Chờ quyết định thanh toán |
| Ảnh xe | Media upload hiện chỉ nhận `service_request` và `assignment` (`src/features/media-uploads/*.schemas.ts:13`). Muốn có ảnh xe phải mở rộng phần upload |
| Linh kiện tự đặt tên | Lịch nhắc tay đang có (miễn phí) đã đáp ứng nhu cầu này |
| Hạn đăng kiểm | Xe máy hiện chưa có hạn đăng kiểm định kỳ như ô tô. Thêm trường này dễ gây hiểu nhầm |
| Lịch sử từng lần "đã làm" | Chỉ lưu `last_done_on` (lần gần nhất). Khi cần lịch sử thì thêm bảng nhật ký sau |
| Tự đánh dấu "đã làm" khi thợ hoàn tất job | Dòng quote hiện chỉ có `description` dạng chữ tự do (`src/features/quotes/quote.schemas.ts:7`), cần thêm mã linh kiện |
| Nhắc trước khi gói hết hạn | Không cần cho đến khi có thanh toán |

## 9. Các quyết định Claude tự chọn, leader nên xem lại

- **D8, lịch nhắc vẫn chạy sau khi hết hạn.** Lý do: nhắc lịch kéo user đặt bảo dưỡng, mà đặt bảo dưỡng là nguồn doanh thu chính.
  Nếu leader muốn ngừng nhắc khi hết hạn, worker phải kiểm tra gói, tức thêm một điều kiện trong `reminder.worker.ts`.
- **`insurance_renewal` thuộc VIP,** theo đúng file Cursor. Nếu muốn có ở Free vì là bảo hiểm bắt buộc, chỉ cần đổi `required_plan` trong hằng số.
- **Các chu kỳ trong bảng 5.3** tính theo khuyến cáo của hãng (mục 11). Mốc thay nhớt chọn 3.000 km,
  là mức an toàn giữa Yamaha (2.000–3.000 km) và Honda (6.000 km). Leader có thể chọn nghiêng về Honda để nhắc thưa hơn.
- **Bỏ mẫu ắc quy riêng** vì việc kiểm tra ắc quy đã gộp vào lời nhắc thay nhớt.
- **Đổi tên `vin_number` thành `frame_number`, bỏ hạn đăng kiểm, hoãn ảnh xe** (mục 8).
- **Admin hạ gói có hiệu lực ngay.** Quy tắc "hạ gói có hiệu lực khi hết kỳ" chỉ áp dụng khi có thanh toán.

## 10. Phát hiện thêm, chưa đưa vào phạm vi (cần leader quyết)

- **PATCH xe đang xoá ghi chú.** `PATCH /api/v1/motorcycles/{id}` thay toàn bộ, trong khi client hiện tại
  không gửi `notes` khi sửa xe, nên ghi chú bị xoá mỗi lần sửa.
  Cách sửa ở BE là chuyển sang "không gửi thì giữ nguyên, gửi `null` thì xoá". Cách này đổi ngữ nghĩa API,
  nên cần leader đồng ý trước khi làm.

## 11. Nghiên cứu chu kỳ bảo dưỡng (2026-10-18)

Các chu kỳ ở bảng 5.3 được tính từ khuyến cáo của hãng dưới đây. Mỗi mẫu xe có lịch riêng, còn app dùng một mức chung cho mọi xe.
Vì vậy câu nhắc chỉ mang tính gợi ý, user vẫn nên đối chiếu sổ bảo dưỡng của xe mình.

### 11.1 Khuyến cáo của hãng

| Hạng mục | Honda | Yamaha / khác | App dùng |
|---|---|---|---|
| Dầu máy | Honda VN: thay sau 1.000 km đầu, sau đó khoảng **6.000 km/lần**; đi trên 1.000 km/tháng thì nên rút ngắn [1]. Sổ hướng dẫn PCX: thay mỗi 6.000 km và hằng năm [2] | Yamaha VN: lần đầu sau 500–1.000 km, sau đó **2.000–3.000 km/lần** [1] | Mốc **3.000 km**, tối đa **6 tháng** → `engine_oil` |
| Dầu láp (xe ga) | Honda VN: khoảng **2 năm/lần** [1]. Sổ PCX: thay định kỳ 2 năm [2] | Yamaha: lần đầu sau 500–1.000 km, sau đó **mỗi 10.000 km** [1] | Mốc **10.000 km**, tối đa **2 năm** → `gear_oil` |
| Dây curoa (xe ga) | Sổ PCX: kiểm tra ở 12.000 km, **thay ở 24.000 km** [2] | – | Gộp phần kiểm tra vào `engine_oil` |
| Bugi | Sổ PCX: **thay mỗi 12.000 km** [2] | – | Gộp vào `engine_oil` |
| Lọc gió | Sổ PCX: **thay mỗi 18.000 km**, sớm hơn nếu đường bụi hoặc ẩm [2] | – | Gộp vào `engine_oil` |
| Má phanh, lốp, ắc quy | Sổ PCX: **kiểm tra** mỗi 6.000 km và hằng năm [2] | – | Gộp vào `engine_oil` |
| Dầu phanh | Sổ PCX: **thay định kỳ 2 năm** [2] | – | `brake_fluid`, 730 ngày |
| Nước làm mát | Sổ PCX: **thay định kỳ 3 năm** [2] | – | `coolant`, 1095 ngày |
| Xe điện | – | VinFast: kiểm tra sau 1.000 km hoặc 1 tháng đầu, sau đó **mỗi 5.000 km hoặc 6 tháng** [1] | Chưa có mẫu riêng vì app chưa phân loại xe (mục 8) |
| Bảo hiểm TNDS | – | Hợp đồng có hạn 1 năm | `insurance_renewal`, nhắc trước 14 ngày |

**Vì sao chọn 3.000 km cho dầu máy:** đây là mức an toàn khi app phải dùng chung cho mọi hãng. Yamaha khuyên 2.000–3.000 km,
còn Honda khuyên 6.000 km nhưng kèm điều kiện "đi trên 1.000 km/tháng thì rút ngắn". Các yếu tố đường bụi, trời nóng và chở nặng
ở VN cũng là lý do nên chọn mức thấp.

### 11.2 Quy đổi từ km sang ngày

Dùng mốc **1.000 km/tháng** mà Honda nêu làm ranh giới giữa đi "vừa" và đi "nhiều".

| `usage_level` | km/ngày | Khoảng km/tháng | Ví dụ |
|---|---|---|---|
| `light` | 15 | ~450 | Đi gần, chủ yếu cuối tuần |
| `normal` | 30 | ~900 | Đi làm hằng ngày, dưới mốc 1.000 km/tháng của Honda |
| `heavy` | 100 | ~3.000 | Shipper, xe công nghệ, trên mốc 1.000 km/tháng |

**Công thức:** `interval_days = min(mốc_km / km_ngày, giới_hạn_ngày)`, làm tròn **xuống** bội số của 30, tối thiểu 30.
Hạng mục chỉ có mốc thời gian (dầu phanh, nước làm mát, bảo hiểm) thì dùng thẳng giới hạn ngày.

| Hạng mục | Mốc km | Giới hạn ngày | light | normal | heavy |
|---|---|---|---|---|---|
| `engine_oil` | 3.000 | 180 | 3000/15 = 200 → 180 | 3000/30 = 100 → **90** | 3000/100 = 30 → **30** |
| `gear_oil` | 10.000 | 730 | 10000/15 ≈ 666 → **660** | ≈ 333 → **330** | 100 → **90** |
| `brake_fluid` | – | 730 | 730 | 730 | 730 |
| `coolant` | – | 1095 | 1095 | 1095 | 1095 |
| `insurance_renewal` | – | 365 | 365 | 365 | 365 |

**Gợi ý cài đặt:** trong `reminder-presets.ts`, lưu `basis_km` (có thể `null`) và `max_days` cho từng mẫu, rồi tính `interval_days` bằng
một hàm thuần theo công thức trên, thay vì gõ tay từng con số. Thêm một test khẳng định kết quả khớp đúng bảng trên.

### 11.3 Giới hạn của nghiên cứu
- Không tìm được bản gốc sổ hướng dẫn của Honda VN cho Vision hay Lead. Sổ PCX [2] là bản của nhà phân phối Honda tại Malaysia,
  xe bán ở VN có thể khác.
- Số liệu Honda VN, Yamaha VN và VinFast lấy qua bài báo tổng hợp [1], không phải văn bản gốc của hãng.
- Trang Y-Connect của Yamaha [3] chỉ mô tả cách nhắc thay dầu theo **cả km lẫn số ngày**, và yêu cầu user **bấm reset sau khi thay**.
  Trang này không có con số cụ thể, nhưng cách làm đó giống thiết kế API "đánh dấu đã làm" ở mục 5.4.
- Mốc tuổi lốp và tuổi thọ ắc quy (thường được nhắc là 5 năm) chỉ có nguồn từ nhà bán lẻ hoặc blog nước ngoài [4], nên không dùng làm mẫu nhắc riêng.

### 11.4 Nguồn
1. Kenh14, "Đi xe máy bao lâu thì phải bảo dưỡng, thay dầu? Câu trả lời từ các hãng Honda, Yamaha, Vinfast" (nguồn bài ghi: Honda Vietnam, Yamaha Vietnam, Vinfast): https://kenh14.vn/di-xe-may-bao-lau-thi-phai-bao-duong-thay-daucau-tra-loi-tu-cac-hang-honda-yamaha-vinfast-215260810202552425.chn
2. Boon Siew Honda (nhà phân phối Honda Malaysia), Honda PCX Maintenance Schedule, trang 63–64 sổ hướng dẫn: https://boonsiewhonda.com.my/wp-content/uploads/2023/07/PCX-STD-MS-ENG-1.pdf
3. Yamaha Motor, Y-Connect – Khuyến nghị bảo trì: https://global.yamaha-motor.com/vi/business/mc/connectivity/yconnect/maintenance_sccu/
4. Partzilla, "6 Motorcycle Parts That Need to Be Changed Often": https://www.partzilla.com/blog/6-motorcycle-parts-that-need-frequent-replacement ; Cycle Gear, Maintenance 101 checklist: https://www.cyclegear.com/assets/0003/8861/Checklist_Maintenance101.pdf
