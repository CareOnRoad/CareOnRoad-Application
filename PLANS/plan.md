---
name: Mobile UI Synchronization Audit and Polish
overview: "Tổng quan: rà soát và đồng bộ UI/UX toàn bộ mobile (rider + mechanic) — header variant, ScrollView padding, SectionHeader pattern, hero card layout, NotificationBell, StatTile, ActionButton size. Tạo 4 shared components mới (ScreenScroll, HeroCard, NotificationBell, StatTile), refactor 21 màn hình. Không thay đổi BE/business logic, không thêm dependency."
todos:
  - id: app_header_tone
    content: Cập nhật AppHeader (tone alias variant, thêm tone="brand", đổi default right)
    status: completed
  - id: section_header_extend
    content: Mở rộng SectionHeader (action?: ReactNode, thêm className) và refactor 6 chỗ inline
    status: completed
  - id: screen_scroll_component
    content: Tạo ScreenScroll wrapper + refactor 19 màn hình rider/mechanic
    status: completed
  - id: hero_card_component
    content: Tạo HeroCard component + refactor 4 hero (home, dashboard, profile x2)
    status: completed
  - id: notification_bell_component
    content: Tạo NotificationBell component + refactor 5 nơi
    status: completed
  - id: stat_tile_component
    content: Tạo StatTile component + refactor 3 nơi (home, dashboard, profile)
    status: completed
  - id: remove_section_label_local
    content: Bỏ hẳn local SectionLabel trong booking.tsx + vehicles/form.tsx
    status: completed
  - id: typography_polish
    content: Polish typography hierarchy + Card padding + section spacing
    status: completed
  - id: action_button_size
    content: Thêm size variant cho ActionButton (md/sm) + refactor 2 nơi
    status: completed
  - id: verify_build
    content: typecheck + lint + smoke test (expo export)
    status: completed
isProject: false
---

# Plan: Đồng bộ UI/UX toàn diện cho Mobile (Rider + Mechanic)

## 1. Audit kết quả khảo sát UI hiện tại

### 1.1. AppHeader — không đồng bộ variant
- `[app-header.tsx](apps/mobile/src/components/ui/app-header.tsx)` đã hỗ trợ 2 variant `default` (nền trắng, viền dưới slate-200) và `navy` (nền navy-900, chữ trắng).
- **Vấn đề**: Variant `navy` chỉ được dùng ở 3 chỗ của Rescue flow (line 165, 496, 510 của `[rescue.tsx](apps/mobile/app/rider/(tabs)/rescue.tsx)`). Các trang còn lại (Trang chủ, Hồ sơ, Đặt lịch, Thông báo, Lịch sử, Thanh toán, ...) đều dùng nền trắng → mất nhận diện brand.

### 1.2. ScrollView padding — không đồng bộ
- Hầu hết các màn hình dùng `contentContainerStyle={{ padding: 20, paddingBottom: 32 }}`.
- **[Hai ngoại lệ]** dùng `paddingHorizontal: 20` (mất paddingTop):
  - `[app/rider/(tabs)/schedule.tsx:232](apps/mobile/app/rider/(tabs)/schedule.tsx)` 
  - `[app/mechanic/(tabs)/schedule.tsx:100](apps/mobile/app/mechanic/(tabs)/schedule.tsx)` — schedule grid đặc biệt.

### 1.3. AppHeader right slot — không đồng bộ hành vi
- AppHeader có default `right` = Bell + dot đỏ → đẹp nhưng có một số màn hình override `right` (rescue, history, vehicles, schedule).
- **`AppHeader` hiện tại có cứng hard-coded bell default với chấm đỏ** — luôn hiển thị dù người dùng không có thông báo nào, gây nhiễu. Cần cho phép null/ẩn.

### 1.4. Section header — không đồng bộ component
- Có 3 pattern đang dùng song song:
  1. `<SectionHeader>` từ `[form.tsx](apps/mobile/src/components/ui/form.tsx)` (dùng trong home).
  2. Local `<SectionLabel>` trong `[booking.tsx](apps/mobile/app/rider/schedule/booking.tsx)` (chỉ text uppercase).
  3. Inline `<Text className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">` trong `[profile.tsx](apps/mobile/app/rider/(tabs)/profile.tsx)` và `[mechanic/(tabs)/profile.tsx](apps/mobile/app/mechanic/(tabs)/profile.tsx)`.
- **Kết quả**: tiêu đề nhóm "Thông tin cá nhân", "Địa chỉ đã lưu", "Cài đặt", "Garage", "Certifications" ở các trang profile trông "inline raw text" không khớp với "Tổng quan / Hành động nhanh" ở home (qua component SectionHeader có `action` button).

### 1.5. Hero card navy — không đồng bộ layout
- **Home (rider)**: `[index.tsx:194-203](apps/mobile/app/rider/(tabs)/index.tsx)` — `p-5`, layout 2-cột: greeting left, brand-blue icon box right.
- **Profile (rider)**: `[profile.tsx:138-175](apps/mobile/app/rider/(tabs)/profile.tsx)` — `p-5`, avatar 64px + name + pencil button + bottom shield row.
- **Profile (mechanic)**: `[mechanic/(tabs)/profile.tsx:134-178](apps/mobile/app/mechanic/(tabs)/profile.tsx)` — `p-5`, avatar + tên + badge + rating + phone.
- **Dashboard (mechanic)**: `[mechanic/(tabs)/index.tsx:90-117](apps/mobile/app/mechanic/(tabs)/index.tsx)` — `p-5`, name left + rating+status right.
- Hero card **Cứu hộ** (rescue.tsx line ~250) có form-fill layout khác.
- **Vấn đề**: Mỗi hero có 1 chút khác biệt về padding, position avatar, action button. Cần chuẩn hoá 1 variant "Hero" chung.

### 1.6. Quick stats — không đồng bộ
- **Home (rider)**: 3 cột dùng `<StatTile>` inline local function: `mt-5` + flex-row gap-3 + Card p-3.
- **Profile (rider)**: 2 cột Card trực tiếp: `mt-5 flex-row gap-3` + Card `flex-1 items-center p-4` với value `text-2xl`.
- **Profile (mechanic)**: 3 cột dùng StatTile tương tự home.
- **Dashboard (mechanic)**: 3 cột StatTile.
- Có 2 StatTile component khác nhau (home và mechanic dùng StatTile inline riêng). Cần refactor ra shared.

### 1.7. Maintenance/History card
- `[maintenance-card.tsx](apps/mobile/src/components/maintenance-card.tsx)` — Card với press handler + icon `bg-primary/10` + 2 dòng info.
- `[booking-card.tsx](apps/mobile/src/components/booking-card.tsx)` — Card có header `bg-navy` riêng, layout 3-cột row info, footer 2 button.
- Hai card này có style khác nhau dù đều là "appointment card". Cần thống nhất.

### 1.8. Bell badge position không đồng bộ
- Trong `[home (rider)](apps/mobile/app/rider/(tabs)/index.tsx:160)`: badge `absolute -right-0.5 -top-0.5 min-w-[18px]`.
- Trong `[mechanic dashboard](apps/mobile/app/mechanic/(tabs)/index.tsx)`: dùng nút bell không có badge (khác style).
- Trong app-header default: badge `absolute right-2 top-2 size-2 rounded-full bg-destructive` (chỉ là dot, không có số).

### 1.9. Rescue "variant navy" chỉ ở 1 màn hình → nhận diện brand yếu
- Hiện chỉ header màn "Đang tìm thợ" (searching) và "Đã huỷ" có nền navy.
- Nên đồng bộ: tất cả flow Cứu hộ (issue → tracking → completed) dùng variant navy, hoặc ngược lại — đổi sang default cho thống nhất.

### 1.10. Action button icon spacing
- ActionButton khi có icon + text thì render `<View flex-row items-center gap-2>`. Một số chỗ (mechanic/index.tsx handleStartNext) dùng `className="px-3 py-2"` — padding nhỏ cho mini button. Cần phân biệt rõ `variant` vs `size`.

## 2. Kế hoạch triển khai

### Phase A: Chuẩn hoá AppHeader + Variant đồng bộ

**Mục tiêu**: Tất cả màn hình dùng cùng pattern AppHeader, có thể chọn `variant` rõ ràng.

1. **Cập nhật `[app-header.tsx](apps/mobile/src/components/ui/app-header.tsx)`**:
   - Thêm prop `tone?: 'default' | 'navy' | 'brand'`:
     - `default`: nền trắng, viền dưới (giữ nguyên).
     - `navy`: nền navy-900, chữ trắng (giữ nguyên).
     - `brand`: nền primary blue với chữ trắng (mới) — dùng cho Cứu hộ nếu muốn.
   - **Đổi tên** `variant` → `tone` (giữ alias `variant` cho backward-compat).
   - Cho phép ẩn default bell bằng `right?: React.ReactNode` (mặc định = Bell + dot).
     - Đổi default `right` từ Bell+dot **sang null** để caller chủ động. Các màn hình cần bell sẽ tự truyền.
     - Sửa `[app-header.tsx](apps/mobile/src/components/ui/app-header.tsx)`:
       ```tsx
       right, // giờ không có default bell+dot, caller tự quyết
       ```
   - Thêm prop `sticky?: boolean` (mặc định true) — đảm bảo AppHeader luôn sticky trên cùng khi scroll (hiện tại không có wrapper scroll nào khác nên không cần thay đổi nhiều).

2. **Cập nhật tất cả màn hình dùng AppHeader** — đảm bảo prop `right` được truyền rõ ràng:
   - Nếu cần bell+badge đếm unread → truyền custom right với `<NotificationBell />`.
   - Nếu chỉ là back → truyền `right={null}` hoặc không truyền gì.
   - **Không để mặc định** nữa.

3. **Quyết định variant theo role**:
   - **Rider flow Cứu hộ (rescue)**: giữ `tone="navy"` (đã có) → đồng bộ các phase searching/tracking/completed/canceled.
   - **Tất cả các trang khác của Rider**: giữ `tone="default"` (trắng).
   - **Mechanic**: giữ `tone="default"` (trắng).
   - Nhận diện brand vẫn đảm bảo qua hero card navy bên trong các trang chính.

### Phase B: SectionHeader chuẩn hoá

**Mục tiêu**: Một component duy nhất, dùng xuyên suốt.

1. **Mở rộng `<SectionHeader>` trong `[form.tsx](apps/mobile/src/components/ui/form.tsx)`**:
   - Đã có props: `title`, `subtitle`, `action`, `onAction`.
   - Thêm prop `className` để caller có thể thêm margin.
   - **Quan trọng**: đổi prop `action` thành `ReactNode` thay vì string để linh hoạt hơn.
     ```tsx
     action?: React.ReactNode; // không phải string
     onAction?: () => void;
     ```
   - Khi không có action → chỉ hiển thị title/subtitle.

2. **Refactor các chỗ dùng inline pattern** sang `<SectionHeader>`:
   - `[rider/profile.tsx](apps/mobile/app/rider/(tabs)/profile.tsx)`:
     - "Thông tin cá nhân" → `<SectionHeader title="Thông tin cá nhân" />`
     - "Địa chỉ đã lưu" → `<SectionHeader title="Địa chỉ đã lưu" />`
     - "Cài đặt" → `<SectionHeader title="Cài đặt" />`
   - `[mechanic/profile.tsx](apps/mobile/app/mechanic/(tabs)/profile.tsx)`:
     - "Garage" → `<SectionHeader title="Garage" />`
     - "Certifications" → `<SectionHeader title="Chứng chỉ" />`
     - "Hôm nay" trong [mechanic/index.tsx](apps/mobile/app/mechanic/(tabs)/index.tsx) — đã dùng rồi, OK.

3. **Bỏ local `SectionLabel`** trong `[booking.tsx](apps/mobile/app/rider/schedule/booking.tsx)`:
   - Đổi tất cả `<SectionLabel>...</SectionLabel>` thành `<SectionHeader title="..." />`.
   - Giữ `className="mt-6"` để giữ spacing.

### Phase C: ScrollView contentContainerStyle helper

**Mục tiêu**: Một helper để đảm bảo padding đồng nhất.

1. **Tạo `[src/components/ui/screen-scroll.tsx](apps/mobile/src/components/ui/screen-scroll.tsx)` (mới)**:
   ```tsx
   export function ScreenScroll({ children, contentContainerStyle, ...props }) {
     return (
       <ScrollView
         {...props}
         contentContainerStyle={{
           paddingHorizontal: 20,
           paddingTop: 16,
           paddingBottom: 32,
           ...contentContainerStyle,
         }}
       >
         {children}
       </ScrollView>
     );
   }
   ```

2. **Refactor tất cả màn hình dùng `ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}`** sang dùng `<ScreenScroll>`:
   - Rider: `index.tsx`, `vehicles.tsx`, `notifications.tsx`, `history.tsx`, `review.tsx`, `vehicles/detail.tsx`, `vehicles/form.tsx`, `schedule/booking.tsx`, `schedule/confirmed.tsx`, `payments/[quoteId].tsx`, `payments/index.tsx`.
   - Mechanic: `index.tsx`, `jobs.tsx`, `offers.tsx`, `profile.tsx`, `notifications.tsx`, `jobs/detail.tsx`.
   - Riêng `rider/(tabs)/schedule.tsx` và `mechanic/(tabs)/schedule.tsx` giữ `paddingHorizontal: 20` (đã đúng cho calendar grid).

3. **Sửa `paddingHorizontal: 20` thành `padding: 20` ở 2 file schedule** để đồng bộ:
   - `[app/rider/(tabs)/schedule.tsx:232](apps/mobile/app/rider/(tabs)/schedule.tsx)` — đổi.
   - `[app/mechanic/(tabs)/schedule.tsx:100](apps/mobile/app/mechanic/(tabs)/schedule.tsx)` — giữ nguyên (vì layout calendar cần `paddingHorizontal` riêng). Hoặc thêm prop `padTop` cho ScreenScroll.

### Phase D: Hero card chuẩn hoá

**Mục tiêu**: Một component `<HeroCard>` dùng được cho home/profile/dashboard.

1. **Tạo `[src/components/ui/hero-card.tsx](apps/mobile/src/components/ui/hero-card.tsx)` (mới)**:
   ```tsx
   export function HeroCard({ children, className, ...props }) {
     return (
       <Card className={cn('overflow-hidden border-0 bg-navy', className)} {...props}>
         <View className="p-5">{children}</View>
       </Card>
     );
   }
   ```
   - Giữ padding `p-5` thống nhất.
   - Cho phép override nội dung qua children.

2. **Refactor các hero hiện tại** sang dùng `<HeroCard>`:
   - `[rider/index.tsx](apps/mobile/app/rider/(tabs)/index.tsx)` — Home hero (greeting + Bike icon + shield row).
   - `[mechanic/index.tsx](apps/mobile/app/mechanic/(tabs)/index.tsx)` — Dashboard hero.
   - `[rider/profile.tsx](apps/mobile/app/rider/(tabs)/profile.tsx)` — Profile hero.
   - `[mechanic/profile.tsx](apps/mobile/app/mechanic/(tabs)/profile.tsx)` — Profile hero.

3. **Lưu ý**: `mechanic/index.tsx` UpNext card dùng `bg-green` (không phải navy) → không refactor, giữ riêng.

### Phase E: NotificationBell component dùng chung

**Mục tiêu**: Một bell icon với unread badge dùng được cả 2 role.

1. **Tạo `[src/components/ui/notification-bell.tsx](apps/mobile/src/components/ui/notification-bell.tsx)` (mới)**:
   ```tsx
   export function NotificationBell({ count = 0, tone = 'default', onPress, accessibilityLabel }) {
     return (
       <Pressable
         onPress={onPress}
         accessibilityLabel={accessibilityLabel ?? 'Mở thông báo'}
         accessibilityRole="button"
         className={cn(
           'relative size-9 items-center justify-center rounded-full active:scale-95',
           tone === 'navy' ? 'bg-white/10' : 'bg-secondary',
         )}
       >
         <Bell size={16} color={tone === 'navy' ? '#ffffff' : '#16202f'} />
         {count > 0 && (
           <View className="absolute -right-0.5 -top-0.5 min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 py-0.5">
             <Text className="text-[10px] font-bold text-destructive-foreground">
               {count > 99 ? '99+' : count}
             </Text>
           </View>
         )}
       </Pressable>
     );
   }
   ```

2. **Refactor các nơi tự dựng bell+badge** sang dùng `<NotificationBell>`:
   - `[rider/index.tsx](apps/mobile/app/rider/(tabs)/index.tsx)` (line ~158).
   - `[rider/notifications.tsx](apps/mobile/app/rider/notifications.tsx)`.
   - `[mechanic/index.tsx](apps/mobile/app/mechanic/(tabs)/index.tsx)`.
   - `[mechanic/notifications.tsx](apps/mobile/app/mechanic/notifications.tsx)`.
   - `[mechanic/(tabs)/offers.tsx](apps/mobile/app/mechanic/(tabs)/offers.tsx)` (có nút refresh riêng — không dùng bell).

### Phase F: StatTile component dùng chung

**Mục tiêu**: 1 component `<StatTile>` đồng nhất cho cả rider & mechanic.

1. **Tạo `[src/components/ui/stat-tile.tsx](apps/mobile/src/components/ui/stat-tile.tsx)` (mới)**:
   ```tsx
   export function StatTile({ icon: Icon, tone = 'blue', label, value, small = false }) {
     const toneStyles = {
       blue: { bg: 'bg-primary/10', fg: '#1974f7' },
       green: { bg: 'bg-green/10', fg: '#145413' },
       amber: { bg: 'bg-amber-500/15', fg: '#d97706' },
       red: { bg: 'bg-destructive/10', fg: '#ed3f3a' },
     };
     return (
       <Card className="flex-1 items-center p-4">
         <View className={cn('mb-2 size-10 items-center justify-center rounded-2xl', toneStyles[tone].bg)}>
           <Icon size={18} color={toneStyles[tone].fg} />
         </View>
         <Text className={cn('font-bold text-foreground', small ? 'text-base' : 'text-2xl')}>
           {value}
         </Text>
         <Text className="mt-0.5 text-center text-xs text-muted-foreground">{label}</Text>
       </Card>
     );
   }
   ```

2. **Refactor các StatTile local** trong:
   - `[rider/index.tsx](apps/mobile/app/rider/(tabs)/index.tsx)` (function local ở cuối file).
   - `[mechanic/index.tsx](apps/mobile/app/mechanic/(tabs)/index.tsx)` (function local).
   - `[mechanic/profile.tsx](apps/mobile/app/mechanic/(tabs)/profile.tsx)` (function local).

### Phase G: SectionLabel cũ → SectionHeader

**Mục tiêu**: Bỏ hẳn local SectionLabel.

1. Trong `[booking.tsx](apps/mobile/app/rider/schedule/booking.tsx)`:
   - Xoá function `SectionLabel` ở cuối file.
   - Đổi `<SectionLabel>Bước 1 · Chọn xe</SectionLabel>` → `<SectionHeader title="Bước 1 · Chọn xe" />`.
   - Giữ nguyên `className="mt-6"` (SectionHeader nhận `className`).

2. Trong `[vehicles/form.tsx](apps/mobile/app/rider/vehicles/form.tsx)`: tương tự.

### Phase H: Polish typography & spacing

1. **Heading hierarchy đồng nhất**:
   - Page title (trong AppHeader): `text-lg font-bold` — đã đúng.
   - Section title (SectionHeader): `text-base font-bold` — đã đúng.
   - Subsection label (SectionLabel cũ): đã chuyển → SectionHeader.
   - Body title: `text-sm font-semibold`.
   - Body: `text-sm`.
   - Caption: `text-xs`.
   - Micro: `text-[11px]` hoặc `text-[10px]`.

2. **Card padding chuẩn**:
   - Card thường: `p-4`.
   - Card compact (maintenance-card, booking-card): `p-3`.
   - Hero card: `p-5` (qua HeroCard).
   - List card (MaintenanceCard): `p-4` (đã đúng).

3. **Spacing giữa sections**:
   - Section → Section: `mt-6` (24px).
   - Section → Card: `mt-5` (20px) hoặc `mt-6`.
   - Card → Card trong list: `gap-3` (12px).

4. **Refactor inline classname trùng lặp**:
   - Trong `[rider/profile.tsx](apps/mobile/app/rider/(tabs)/profile.tsx)` và `[mechanic/profile.tsx](apps/mobile/app/mechanic/(tabs)/profile.tsx)`:
     ```tsx
     <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
       Garage
     </Text>
     ```
     → qua `<SectionHeader title="Garage" />`.

### Phase I: ActionButton size variant

1. Mở rộng `[action-button.tsx](apps/mobile/src/components/ui/action-button.tsx)`:
   - Thêm prop `size?: 'md' | 'sm'`.
     - `md` (mặc định): `py-3 px-5` (hiện tại).
     - `sm`: `py-2 px-3`.
   - Đảm bảo backward-compat (size mặc định = `md`).

2. Refactor các nút dùng `className="px-3 py-2"` mini → `size="sm"`:
   - `[mechanic/(tabs)/index.tsx](apps/mobile/app/mechanic/(tabs)/index.tsx)` (Up next CTA).
   - Các nút Confirm/Cancel trong BookingCard.

### Phase J: Verify & build

1. `pnpm.cmd run typecheck` (apps/mobile).
2. `pnpm.cmd run lint` (apps/mobile).
3. `pnpm.cmd run build` (root) hoặc `pnpm.cmd run build:mobile`.
4. Smoke test trên Expo Go: mở từng tab rider/mechanic, kiểm tra:
   - Cùng 1 pattern AppHeader (đúng variant, đúng bell).
   - Section titles đồng nhất.
   - Hero cards có cùng padding `p-5`.
   - Stat tiles cùng layout.
   - Scroll padding đồng đều.

## 3. Tổng hợp file thay đổi

**Mới tạo**:
- `apps/mobile/src/components/ui/screen-scroll.tsx` — wrapper ScrollView padding chuẩn.
- `apps/mobile/src/components/ui/hero-card.tsx` — hero card navy padding chuẩn.
- `apps/mobile/src/components/ui/notification-bell.tsx` — bell + badge đếm unread.
- `apps/mobile/src/components/ui/stat-tile.tsx` — tile thống kê đồng bộ.

**Sửa đổi**:
- `apps/mobile/src/components/ui/app-header.tsx` — đổi default right, đổi `variant` → `tone`, thêm `tone="brand"`.
- `apps/mobile/src/components/ui/form.tsx` — `<SectionHeader>` nhận `action?: ReactNode`, thêm `className`.
- `apps/mobile/src/components/ui/action-button.tsx` — thêm prop `size`.
- `apps/mobile/app/rider/(tabs)/index.tsx` — refactor dùng HeroCard, StatTile, NotificationBell, ScreenScroll.
- `apps/mobile/app/rider/(tabs)/profile.tsx` — dùng SectionHeader, HeroCard, ScreenScroll.
- `apps/mobile/app/rider/(tabs)/vehicles.tsx` — ScreenScroll.
- `apps/mobile/app/rider/(tabs)/schedule.tsx` — ScreenScroll (sửa paddingHorizontal).
- `apps/mobile/app/rider/(tabs)/rescue.tsx` — giữ variant navy, dùng ScreenScroll.
- `apps/mobile/app/rider/(tabs)/history.tsx` — ScreenScroll.
- `apps/mobile/app/rider/notifications.tsx` — NotificationBell, ScreenScroll.
- `apps/mobile/app/rider/review.tsx` — ScreenScroll.
- `apps/mobile/app/rider/vehicles/detail.tsx` — ScreenScroll.
- `apps/mobile/app/rider/vehicles/form.tsx` — ScreenScroll, bỏ local SectionLabel.
- `apps/mobile/app/rider/schedule/booking.tsx` — SectionHeader, ScreenScroll, bỏ local SectionLabel.
- `apps/mobile/app/rider/schedule/confirmed.tsx` — ScreenScroll.
- `apps/mobile/app/rider/payments/[quoteId].tsx` — ScreenScroll.
- `apps/mobile/app/rider/payments/index.tsx` — ScreenScroll.
- `apps/mobile/app/mechanic/(tabs)/index.tsx` — HeroCard, StatTile, NotificationBell, ScreenScroll.
- `apps/mobile/app/mechanic/(tabs)/profile.tsx` — SectionHeader, HeroCard, StatTile, ScreenScroll.
- `apps/mobile/app/mechanic/(tabs)/jobs.tsx` — ScreenScroll.
- `apps/mobile/app/mechanic/(tabs)/offers.tsx` — ScreenScroll.
- `apps/mobile/app/mechanic/(tabs)/schedule.tsx` — giữ paddingHorizontal cho calendar grid (chú thích).
- `apps/mobile/app/mechanic/notifications.tsx` — NotificationBell, ScreenScroll.
- `apps/mobile/app/mechanic/jobs/detail.tsx` — ScreenScroll.

## 4. Nguyên tắc giữ scope

- **Không thay đổi** business logic, BE contract, mock data.
- **Không thêm dependency** mới.
- **Không thay đổi** Tailwind theme colors, NativeWind config.
- **Không xoá** component cũ mà chưa refactor — giữ backward-compat (variant alias cho tone).
- **Không thay đổi** ngôn ngữ hiển thị (giữ tiếng Việt).
- Cải tiến UI dựa trên **token có sẵn** (size, color, radius từ tailwind.config).