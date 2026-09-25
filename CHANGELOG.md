# Changelog

Mọi thay đổi đáng chú ý của dự án được ghi tại đây. Định dạng theo phase triển
khai mobile integration để dễ tra cứu.

---

## [Unreleased] – 2026-09-25 · Mobile integration

Giai đoạn P1–P4: tích hợp các API backend MVP (auth/profile, motorcycles,
service requests, dispatch, assignments, mechanic operations, notifications,
reminders, media uploads, live tracking) vào ứng dụng React Native
(`apps/mobile`). Tất cả thay đổi đều giữ UI cũ, chỉ nối thêm logic BE và
giữ fallback nếu backend chưa cấu hình.

### P1 – Sửa 3 bug rider-facing

Mục tiêu: khắc phục các lỗi nhỏ ngăn rider dùng được tính năng BE trên UI.

- **Maintenance tab trống sau khi BE có lịch mới**
  - File: `apps/mobile/app/rider/(tabs)/schedule.tsx`
  - Bổ sung `useServiceRequests().reloadList()` khi focus tab `maintenance`
    để đồng bộ với BE.
- **Cancel appointment không rollback nếu BE lỗi**
  - File: `apps/mobile/app/rider/(tabs)/schedule.tsx`
  - Sau khi `cancelById` thất bại, hiển thị `Banner` lỗi; chỉ cập nhật state
    local khi BE xác nhận thành công.
- **Review lookup trên job detail**
  - File: `apps/mobile/src/contexts/mechanic-app-context.tsx` (lookup helper)
  - Dùng `request_id` từ assignment để query review BE thay vì chỉ dựa vào
    mock data.

### P2 – Bổ sung 3 service wrappers + refactor `MechanicAppContext`

Mục tiêu: tách logic BE khỏi UI, tạo các service layer độc lập để test và
mở rộng.

- **Service wrappers mới** (`apps/mobile/src/lib/`):
  - `mechanics-service.ts` – `listMyMechanicJobs`, `getMechanicProfile`,
    `updateMechanicAvailability`, `updateMechanicLocation`,
    `submitMechanicEta`.
  - `dispatch-service.ts` – `listMyOffers`, `acceptOffer`, `declineOffer`,
    `distanceLabel`, `offerStatusLabel`.
  - `mechanic-jobs-service.ts` – `listMyAssignments`, `getAssignment`,
    `submitAssignmentStatus`, `submitAssignmentChecklist`,
    `submitFieldMedia`, `recoverAssignment`, `submitEta`,
    `nextAllowedStatuses`, `statusLabel`.
- **Refactor `MechanicAppContext`**
  - File: `apps/mobile/src/contexts/mechanic-app-context.tsx`
  - Tách phần BE ra khỏi phần mock: thêm `loadJobsFromBE`, `syncJobStatus`,
    `syncAssignmentAccept` để optimistic update + rollback khi BE lỗi.
  - Cập nhật `updateJobStatus`, `acceptOffer`, `declineOffer`,
    `submitJobCompletion` để gọi đúng endpoint BE.

### P3 – UI mới cho mechanic

Mục tiêu: hoàn thiện các màn hình chuyên biệt cho mechanic, sử dụng
đúng state machine BE và hiển thị thông báo realtime.

- **Tab Offers**
  - File mới: `apps/mobile/app/mechanic/(tabs)/offers.tsx`
  - Liệt kê dispatch offers đang chờ (polling 15s).
  - Accept → điều hướng tới job detail; Decline → confirm dialog.
  - Auto reload khi screen focus lại.
  - Đăng ký tab trong `apps/mobile/app/mechanic/(tabs)/_layout.tsx`.
- **Màn Notifications**
  - File mới: `apps/mobile/app/mechanic/notifications.tsx`
  - Inbox owner-scoped (rider/mechanic), polling 20s.
  - Mark-read optimistic + rollback khi BE lỗi.
  - "Đọc tất cả" một chạm.
  - Đăng ký `Stack.Screen` trong `apps/mobile/app/mechanic/_layout.tsx`.
- **JobUpdateForm wire BE state machine**
  - File: `apps/mobile/src/components/mechanic/forms/job-update-form.tsx`
  - Thêm section "BE State machine" hiển thị status hiện tại và các
    transition hợp lệ (`nextAllowedStatuses`).
  - Thêm ETA inline: gửi `eta_at` + `delay_reason` qua `submitEta()`.
  - Helper `uiStatusToBe()` exported để các caller khác dùng.

### P4 – Polish nhỏ + tích hợp cuối

Mục tiêu: hoàn thiện các flow chưa được expose trên UI, chuẩn bị cho các
flow cần upload media.

- **Snooze reminder UI (rider)**
  - File: `apps/mobile/app/rider/(tabs)/schedule.tsx`
  - Nút "Snooze" trong `ReminderCard`, mở Alert với 4 mốc: 15 phút /
    1 giờ / tới 08:00 sáng hôm sau / 1 ngày.
  - BE cập nhật `next_fire_at` và `status = snoozed`.
- **Media uploads service**
  - File mới: `apps/mobile/src/lib/media-uploads-service.ts`
  - Exports: `createUploadIntent`, `finalizeUpload`, `putBytesToSignedUrl`,
    `sha256Hex`, `mediaErrorCode`.
  - Hỗ trợ 3 contexts: `service_request_media`, `assignment_media`,
    `rider_review`.
  - Cả 2 endpoint đều gắn `X-Idempotency-Key`.

### Files created / modified

**Created**

- `apps/mobile/src/lib/mechanics-service.ts`
- `apps/mobile/src/lib/dispatch-service.ts`
- `apps/mobile/src/lib/mechanic-jobs-service.ts`
- `apps/mobile/src/lib/media-uploads-service.ts`
- `apps/mobile/app/mechanic/(tabs)/offers.tsx`
- `apps/mobile/app/mechanic/notifications.tsx`

**Modified**

- `apps/mobile/src/contexts/mechanic-app-context.tsx`
- `apps/mobile/app/mechanic/(tabs)/_layout.tsx`
- `apps/mobile/app/mechanic/(tabs)/index.tsx`
- `apps/mobile/app/mechanic/_layout.tsx`
- `apps/mobile/src/components/mechanic/forms/job-update-form.tsx`
- `apps/mobile/app/rider/(tabs)/schedule.tsx`

### Verification

- `pnpm.cmd exec tsc --noEmit` (mobile): **0 errors**
- `pnpm.cmd run lint` (mobile): **0 errors** (3 warnings có sẵn từ trước,
  không phát sinh thêm).

---

## Mức độ hoàn thiện sau P1–P4

| Module                  | Rider | Mechanic |
|-------------------------|:-----:|:--------:|
| Profile                 | 🟡 80%| 🟡 85%   |
| Dashboard               |  N/A  | 🟢 95%   |
| Vehicles                | 🟢 100%| N/A    |
| Service requests        | 🟡 70%| N/A      |
| Dispatch offers         |  N/A  | 🟢 100%  |
| Jobs / assignments      | 🟢 100%| 🟢 95%  |
| Notifications (UI)      | ❌ 0% | 🟢 100%  |
| Reminders (snooze)      | 🟢 100%| N/A     |
| Media uploads (service) | 🟢 50% (sẵn sàng) | – |
| ETA submit              |  N/A  | 🟢 100%  |
| Completion checklist    |  N/A  | 🟢 100%  |
| Live tracking           | 🟢 100%| 🟢 100% |
| Recover                 |  N/A  | 🟢 100%  |
| **Tổng**                | **~80%** | **~85%** |
