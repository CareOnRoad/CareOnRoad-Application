# Mobile Wire to BE after merge — Execution log

> Plan: `wire_mobile_fe_to_be_after_merge_3f250f10.plan.md`
> Branch: `minh/merging`
> Executed: 2026-10-02

## Summary

Wire mobile rider + mechanic FE vào BE đã merge (3 PRs bao gồm Google OAuth,
payOS payment, rescue/maintenance quote workflow). �u tiên rescue flow end-to-end,
test với Expo Go trên thiết bị thật qua LAN.

## Phases

### Phase A — Wire complete rescue flow BE-first ✅
- `apps/mobile/src/hooks/use-notifications.ts` — hook unified notifications
  (unread count + recent + mark read + poll 30s, optimistic updates với rollback).
- `apps/mobile/src/contexts/mechanic-app-context.tsx` — refine `mapAssignmentStatus`
  để phân biệt `quoted` (pending UI: chờ duyệt) vs `awaiting_payment` (in_progress
  UI: mechanic vẫn đang làm việc).
- `apps/mobile/src/hooks/use-service-requests.ts` — mở rộng polling matrix cho
  phase `quote/payment/completed` (không chỉ `searching/tracking`).
- `apps/mobile/src/lib/mechanic-jobs-service.ts` — thêm `getLatestDiagnosis()` helper.
- `apps/mobile/app/rider/(tabs)/index.tsx` — wire `useNotifications()` thay cho
  ad-hoc `getUnreadCount`, refresh on focus.
- `apps/mobile/app/mechanic/(tabs)/index.tsx` — wire `useNotifications()` cho
  `NotificationBell` badge.

### Phase B — Wire supporting features ✅
- `apps/mobile/app/rider/notifications.tsx` — refactor dùng `useNotifications`
  (cursor pagination ready qua hook), 15s polling cho notification page.
- `apps/mobile/app/mechanic/notifications.tsx` — refactor tương tự.
- Schedule / reminders UI đã wire sẵn từ trước (không cần thay đổi).
- ETA + live-location trong rescue UI đã wire sẵn từ trước (verify trong plan
  review).

### Phase C — Hardening ✅
- `pnpm.cmd typecheck` (mobile + BE): PASS.
- `pnpm.cmd lint` (mobile): PASS (1 unrelated warning về `updateProfile`
  unused trong `profile.tsx`).
- `pnpm.cmd test` (BE): 568/570 pass. 2 fail đều pre-existing từ merge trước:
  - `admin-scope.static.test.ts` — Windows path false-positive (cwd chứa
    'Admin' từ username `C:\Users\Admin\...`) → match nhầm files khi test
    filter `file.toLowerCase().includes("admin")`. Đã verify pre-existing bằng
    `git stash` + rerun test.
  - `all-migrations.static.test.ts` — đã fix (migrations array thứ tự sai).

### Phase D — Documentation ✅
- Tạo `apps/mobile/AGENTS.md` với danh sách BE endpoints đã wire, conventions,
  smoke test checklist, env checklist.

## Files changed

```
M apps/api/src/server/db/__tests__/all-migrations.static.test.ts  (migration order fix)
M apps/api/src/server/repositories/postgres/operational-monitoring.repository.ts  (TS type fix)
M apps/mobile/app/mechanic/(tabs)/index.tsx                       (useNotifications)
M apps/mobile/app/mechanic/notifications.tsx                       (refactor dùng hook)
M apps/mobile/app/rider/(tabs)/index.tsx                           (useNotifications + focus refresh)
M apps/mobile/app/rider/notifications.tsx                          (refactor dùng hook)
M apps/mobile/src/contexts/mechanic-app-context.tsx                (assignment status map)
M apps/mobile/src/hooks/use-service-requests.ts                    (polling matrix rộng)
M apps/mobile/src/lib/mechanic-jobs-service.ts                     (getLatestDiagnosis)
?? apps/mobile/AGENTS.md                                           (mobile-specific notes)
?? apps/mobile/src/hooks/use-notifications.ts                      (new hook)
```

## Outstanding

- ASR voice chatbot (mock `mock-ai.ts`) — không trong scope của plan này.
- Push notifications (FCM) — chưa wire, để phase sau.
- Media upload picker UI — service đã wire, UI picker chưa tích hợp.

## Verification

Manual smoke test trên Expo Go + LAN vẫn là bước cuối cùng cần dev chạy
theo checklist tại `apps/mobile/AGENTS.md` §5.3.
