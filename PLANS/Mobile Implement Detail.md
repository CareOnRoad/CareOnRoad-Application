# BÁO CÁO HỌC THUẬT
## CAREONROAD MOBILE APPLICATION — MOBILE IMPLEMENT DETAIL

**Đề tài:** Phân tích thiết kế và triển khai ứng dụng di động CareOnRoad — Hệ thống cứu hộ và bảo dưỡng xe máy tại Việt Nam

**Công nghệ:** React Native (Expo SDK 54), TypeScript, NativeWind (Tailwind CSS), Expo Router, Supabase, Next.js Backend API, PostgreSQL

**Phiên bản:** v1.0 — Tháng 10/2026

---

## MỤC LỤC

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Các vai trò (Roles)](#2-các-vai-trò-roles)
3. [Kiến trúc tổng thể](#3-kiến-trúc-tổng-thể)
4. [Cấu trúc thư mục và File](#4-cấu-trúc-thư-mục-và-file)
5. [Luồng xác thực (Authentication)](#5-luồng-xác-thực-authentication)
6. [Triển khai tính năng Rider](#6-triển-khai-tính-năng-rider)
7. [Triển khai tính năng Mechanic](#7-triển-khai-tính-năng-mechanic)
8. [Dịch vụ Backend và API](#8-dịch-vụ-backend-và-api)
9. [Quản lý State và Context](#9-quản-lý-state-và-context)
10. [Cơ chế Polling và Real-time](#10-cơ-chế-polling-và-real-time)
11. [Các thư viện và công nghệ sử dụng](#11-các-thư-viện-và-công-nghệ-sử-dụng)
12. [Kết luận](#12-kết-luận)

---

## 1. Tổng quan hệ thống

### 1.1. Giới thiệu

CareOnRoad là ứng dụng di động đa nền tảng (iOS/Android) phục vụ hệ sinh thái cứu hộ và bảo dưỡng xe máy tại Việt Nam. Ứng dụng được xây dựng trên nền tảng **Expo SDK 54** với **React Native 0.76**, sử dụng **TypeScript** làm ngôn ngữ chính và **NativeWind** (Tailwind CSS) cho styling.

### 1.2. Mục tiêu chính

- **Rider (Người dùng xe máy):** Gửi yêu cầu cứu hộ khẩn cấp, đặt lịch bảo dưỡng, quản lý xe, xem báo giá và thanh toán.
- **Mechanic (Thợ sửa xe):** Nhận và quản lý công việc, chẩn đoán hỏng hóc, tạo báo giá, cập nhật trạng thái công việc.
- **Backend API:** Xử lý logic nghiệp vụ, quản lý database, điều phối thợ (dispatch), gửi thông báo.

### 1.3. Đặc điểm kiến trúc

- **Monorepo:** Dự án sử dụng cấu trúc pnpm workspace với 2 ứng dụng chính:
  - `apps/mobile` — Ứng dụng di động React Native (Expo)
  - `apps/api` — Backend Next.js API
- **Backend-first:** Mobile app gọi API thật, không mock khi backend đã configured.
- **Offline-friendly:** Demo mode với local storage (AsyncStorage) khi chưa có backend.

---

## 2. Các vai trò (Roles)

### 2.1. Vai trò Rider

| Tính năng | Mô tả |
|---|---|
| Đăng ký/Đăng nhập | Email/password hoặc Google OAuth qua Supabase |
| Quản lý xe | Thêm, sửa, xóa xe máy của mình |
| Cứu hộ khẩn cấp | Gửi yêu cầu cứu hộ với vị trí GPS + mô tả sự cố |
| Đặt lịch bảo dưỡng | Lên lịch bảo dưỡng định kỳ với ngày giờ cụ thể |
| Theo dõi trạng thái | Polling 5s cho request status, 30s cho ETA, 15s cho live location |
| Xem và duyệt báo giá | Nhận báo giá từ thợ, duyệt/từ chối |
| Thanh toán | Tạo và theo dõi thanh toán qua payOS/VietQR |
| Nhắc nhở bảo dưỡng | Tạo và quản lý reminder cho từng xe |
| Lịch sử dịch vụ | Xem các dịch vụ đã hoàn thành |
| Thông báo | Nhận thông báo về request, báo giá, thanh toán |
| Đánh giá thợ | Đánh giá sau khi hoàn thành dịch vụ |
| Hồ sơ cá nhân | Sửa thông tin cá nhân, avatar, địa chỉ |

### 2.2. Vai trò Mechanic

| Tính năng | Mô tả |
|---|---|
| Dashboard | Tổng quan công việc hôm nay, rating, thu nhập |
| Offers (Đề xuất) | Nhận danh sách công việc được đề xuất, accept/decline |
| Jobs (Công việc) | Danh sách công việc với filter theo status |
| Chi tiết công việc | Xem thông tin khách hàng/xe, timeline, chẩn đoán, báo giá |
| Cập nhật trạng thái | Chuyển trạng thái: pending → in_progress → completed |
| Chẩn đoán | Tạo và lưu chẩn đoán hỏng hóc |
| Báo giá | Tạo báo giá với line items (labor, parts, other) |
| Chia sẻ vị trí | Live location sharing để rider theo dõi |
| Performance | Xem thống kê hiệu suất: completed jobs, rating, acceptance rate |
| Lịch làm việc | Xem lịch hôm nay từ jobs |
| Hồ sơ cá nhân | Thông tin garage, chứng chỉ, cài đặt |

---

## 3. Kiến trúc tổng thể

### 3.1. Kiến trúc 3 lớp

```
┌─────────────────────────────────────────────────────┐
│                    MOBILE APP                        │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │ UI Layer    │  │ Hook/Context │  │  Services │  │
│  │ (Screens)   │  │  (State)     │  │  (API)    │  │
│  └─────────────┘  └─────────────┘  └───────────┘  │
│                       │                              │
│  ┌──────────────────────────────────────────────┐  │
│  │        Expo Router (File-based routing)       │  │
│  └──────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────┘
                        │ HTTP REST API
┌───────────────────────▼─────────────────────────────┐
│                    BACKEND API                        │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │  Next.js    │  │  Services   │  │ Repository│  │
│  │  Route API  │  │             │  │  (PG)     │  │
│  └─────────────┘  └─────────────┘  └───────────┘  │
└───────────────────────┬─────────────────────────────┘
                        │ PostgreSQL + Supabase
                        ▼
              ┌─────────────────────┐
              │   Supabase Auth     │
              │   PostgreSQL DB     │
              │   Storage (Media)   │
              └─────────────────────┘
```

### 3.2. Kiến trúc xác thực

```
┌────────────────────────────────────────────────────────┐
│              AUTHENTICATION FLOW                        │
│                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐  │
│  │  Login/   │───▶│ Supabase │───▶│ Backend API  │  │
│  │  Register │    │  Auth    │    │ /auth/me     │  │
│  └──────────┘    └──────────┘    └──────────────┘  │
│       │                                    │           │
│       │ JWT Token                    Actor + Roles    │
│       ▼                                    ▼           │
│  ┌──────────────────────────────────────────────┐     │
│  │              AuthContext (State)              │     │
│  │  - status: loading|authenticated|unauth    │     │
│  │  - user: PublicAuthUser                       │     │
│  │  - role: rider|mechanic                     │     │
│  │  - isBackendConfigured: boolean              │     │
│  └──────────────────────────────────────────────┘     │
│                         │                              │
│                         ▼                              │
│  ┌──────────────────────────────────────────────┐     │
│  │     setAccessTokenProvider() → API Layer     │     │
│  │     (Supabase JWT injected automatically)     │     │
│  └──────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────┘
```

### 3.3. Kiến trúc State Management

Ứng dụng sử dụng **React Context API** để quản lý state tập trung:

```
RootLayout
├── AuthProvider          (auth-context.tsx)
│   └── useAuth()         ← Authentication state, login/logout/register
│
├── Rider Flow:
│   └── AppProvider       (app-context.tsx)
│       └── useApp()      ← Vehicles, services, appointments, reminders, notifications
│
└── Mechanic Flow:
    └── MechanicAppProvider  (mechanic-app-context.tsx)
        └── useMechanicApp() ← Dashboard, jobs, performance, live location, quotes
```

---

## 4. Cấu trúc thư mục và File

### 4.1. Cấu trúc tổng thể `apps/mobile`

```
apps/mobile/
├── app/                              # Expo Router - File-based routing
│   ├── _layout.tsx                  # Root layout (AuthProvider mount)
│   ├── index.tsx                    # Root entry → redirect by role
│   ├── (auth)/                      # Auth screens group
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── rider/                       # Rider screens group
│   │   ├── _layout.tsx             # AppProvider mount + role guard
│   │   ├── (tabs)/                  # Tab screens
│   │   │   ├── _layout.tsx         # Tabs: home, vehicles, rescue, schedule, profile
│   │   │   ├── index.tsx           # Home screen
│   │   │   ├── vehicles.tsx
│   │   │   ├── rescue.tsx
│   │   │   ├── schedule.tsx
│   │   │   └── profile.tsx
│   │   ├── vehicles/
│   │   │   ├── detail.tsx
│   │   │   └── form.tsx
│   │   ├── schedule/
│   │   │   ├── booking.tsx
│   │   │   └── confirmed.tsx
│   │   ├── history.tsx
│   │   ├── notifications.tsx
│   │   ├── payments/
│   │   │   ├── index.tsx
│   │   │   └── [quoteId].tsx
│   │   └── review.tsx
│   └── mechanic/                    # Mechanic screens group
│       ├── _layout.tsx             # MechanicAppProvider mount + role guard
│       ├── (tabs)/                  # Tab screens
│       │   ├── _layout.tsx         # Tabs: dashboard, offers, jobs, performance, schedule, profile
│       │   ├── index.tsx           # Dashboard screen
│       │   ├── offers.tsx
│       │   ├── jobs.tsx
│       │   ├── performance.tsx
│       │   ├── schedule.tsx
│       │   └── profile.tsx
│       ├── jobs/
│       │   └── detail.tsx
│       └── notifications.tsx
├── src/
│   ├── contexts/                    # React Context providers
│   │   ├── auth-context.tsx         # Authentication state management
│   │   ├── app-context.tsx          # Rider app state (vehicles, services, etc.)
│   │   └── mechanic-app-context.tsx # Mechanic app state (jobs, quotes, etc.)
│   ├── hooks/                       # Custom React hooks
│   │   ├── use-service-requests.ts  # Rider service request workflow
│   │   └── use-notifications.ts    # Notification polling & management
│   ├── lib/                         # Business logic & services
│   │   ├── api.ts                   # HTTP client wrapper
│   │   ├── config.ts                # Environment config
│   │   ├── supabase-client.ts       # Supabase client singleton
│   │   ├── auth-service.ts          # Auth API calls
│   │   ├── auth-storage.ts          # Local auth storage (demo mode)
│   │   ├── auth-types.ts           # Auth type definitions
│   │   ├── devices-service.ts       # Device registration
│   │   ├── motorcycles-service.ts   # Motorcycle CRUD
│   │   ├── service-requests-service.ts # Service request APIs
│   │   ├── assignments-service.ts   # Assignment APIs (rider view)
│   │   ├── mechanic-jobs-service.ts # Mechanic job operations
│   │   ├── mechanics-service.ts     # Mechanic profile & dashboard
│   │   ├── dispatch-service.ts      # Dispatch offers
│   │   ├── quotes-service.ts       # Quote decisions (approve/reject)
│   │   ├── mechanic-quotes-service.ts # Mechanic quote submission
│   │   ├── payments-service.ts     # Payment orders
│   │   ├── reminders-service.ts    # Reminder management
│   │   ├── notifications-service.ts # Notification APIs
│   │   ├── media-uploads-service.ts # Media upload intents
│   │   ├── location-service.ts     # GPS capture & watch
│   │   ├── notification-routing.ts  # Deep-link routing for notifications
│   │   ├── profile-service.ts      # Local profile cache
│   │   ├── format.ts              # Date/number formatters
│   │   ├── types.ts               # Shared UI types
│   │   ├── mechanic-types.ts       # Mechanic-specific types
│   │   ├── idempotency.ts         # Idempotency key generator
│   │   └── utils.ts               # Utility helpers (cn, etc.)
│   ├── components/                  # Reusable UI components
│   │   ├── ui/                    # Generic UI components
│   │   │   ├── action-button.tsx
│   │   │   ├── app-header.tsx
│   │   │   ├── banner.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── card.tsx
│   │   │   ├── confirm-dialog.tsx
│   │   │   ├── edit-profile-sheet.tsx
│   │   │   ├── empty-state.tsx
│   │   │   ├── form.tsx (SectionHeader)
│   │   │   ├── hero-card.tsx
│   │   │   ├── notification-bell.tsx
│   │   │   ├── screen-scroll.tsx
│   │   │   ├── stat-tile.tsx
│   │   │   ├── toggle-row.tsx
│   │   │   └── datetime-picker-field.tsx
│   │   ├── mechanic/               # Mechanic-specific components
│   │   │   ├── cards/
│   │   │   │   ├── customer-card.tsx
│   │   │   │   ├── earnings-card.tsx
│   │   │   │   ├── job-card.tsx
│   │   │   │   └── live-sharing-card.tsx
│   │   │   └── forms/
│   │   │       ├── diagnosis-form.tsx
│   │   │       ├── job-update-form.tsx
│   │   │       └── quote-form.tsx
│   │   ├── booking-card.tsx
│   │   ├── cancel-appointment-modal.tsx
│   │   ├── maintenance-card.tsx
│   │   ├── vehicle-card.tsx
│   │   └── ai-chatbox.tsx
│   └── App.tsx                    # Legacy (unused)
├── app.config.ts                  # Expo config (slug, scheme, permissions)
├── package.json                   # Dependencies
├── tsconfig.json
├── tailwind.config.ts
├── metro.config.js
├── babel.config.js
├── nativewind.config.ts
└── global.css                    # NativeWind base styles
```

### 4.2. Chi tiết file quan trọng

#### 4.2.1. `app/_layout.tsx` — Root Layout

**Mục đích:** Mount providers cốt lõi và setup navigation stack chính.

**Logic chính:**

```typescript
// 1. AuthProvider bọc ngoài cùng → mọi màn hình truy cập được auth state
// 2. RootNavigator kiểm tra status:
//    - 'loading' → null (chờ hydrate)
//    - 'unauthenticated' → chỉ render nhóm auth
//    - 'authenticated' → render cả auth + app groups
// 3. Role guard redirect nếu user đang login nhưng mở nhóm sai
```

#### 4.2.2. `app/(auth)/login.tsx` — Login Screen

**Mục đích:** Giao diện đăng nhập với 3 phương thức:
- Email/password (Supabase Auth)
- Google OAuth (Supabase PKCE flow)
- Demo bypass (dev mode)

**UI Components:**
- Logo + tagline header
- Email + password inputs với icon
- Show/hide password toggle
- Submit button với loading state
- Google sign-in button
- Demo account cards (khi chưa có backend)
- Dev bypass buttons (sẽ xóa trong production)

#### 4.2.3. `app/(auth)/register.tsx` — Registration Screen

**Mục đích:** Đăng ký tài khoản mới với chọn vai trò (Rider/Mechanic).

**Logic chính:**
- Role selector card (2 tùy chọn với icon + mô tả)
- Form validation client-side
- `account_type` được gửi kèm để backend bootstrap đúng role

---

## 5. Luồng xác thực (Authentication)

### 5.1. Auth Flow Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                                │
│                                                                     │
│  1. APP MOUNT                                                      │
│     ├── RootLayout mount AuthProvider                               │
│     └── AuthContext.hydrate() → loadSession from AsyncStorage      │
│                                                                     │
│  2. SESSION EXISTS                                                  │
│     ├── Supabase session tồn tại                                    │
│     ├── Fetch currentActor từ /api/v1/auth/me                     │
│     ├── Set role (rider/mechanic)                                  │
│     └── Set accessTokenProvider callback                            │
│                                                                     │
│  3. LOGIN                                                          │
│     ├── signInWithPassword(email, password) → Supabase            │
│     ├── fetchCurrentActor() → Backend                             │
│     ├── setAccessTokenProvider(() => getSession().access_token)    │
│     └── AuthContext state → 'authenticated'                        │
│                                                                     │
│  4. GOOGLE OAUTH                                                   │
│     ├── startGoogleSignIn() → Supabase PKCE OAuth URL              │
│     ├── Open browser → Google login                                 │
│     ├── Redirect về careonroad://auth/callback?code=xxx           │
│     ├── Linking listener nhận URL                                   │
│     ├── completeGoogleSignIn(code) → exchange session              │
│     └── Bootstrap profile nếu user mới                             │
│                                                                     │
│  5. LOGOUT                                                         │
│     ├── supabase.auth.signOut()                                    │
│     └── setAccessTokenProvider(null)                               │
└────────────────────────────────────────────────────────────────────┘
```

### 5.2. Token Provider Pattern

**Vấn đề:** API layer cần access token cho mọi request nhưng Supabase JWT có thể refresh bất cứ lúc nào.

**Giải pháp:** `setAccessTokenProvider()` — callback pattern

```typescript
// api.ts
let currentTokenProvider: TokenProvider | null = null;

export function setAccessTokenProvider(provider: TokenProvider | null): void {
  currentTokenProvider = provider;
}

async function resolveToken(): Promise<string | null> {
  if (!currentTokenProvider) return null;
  return await currentTokenProvider();
}

// Mỗi request tự động gọi resolveToken() để lấy fresh token
export async function apiRequest<T>(path, options) {
  const token = await resolveToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // ... fetch
}
```

**Tại sao:** Token có thể refresh giữa 2 request, nên mỗi lần gọi API phải lấy token mới nhất từ Supabase session.

### 5.3. Deep Link cho OAuth

**Cấu hình:** `careonroad://` scheme được khai báo trong `app.config.ts`

```typescript
// app.config.ts
intentFilters: [
  {
    action: 'VIEW',
    category: ['DEFAULT', 'BROWSABLE'],
    data: [{ scheme: 'careonroad' }],
  },
]
```

**Flow:**
1. User bấm "Google Sign-in"
2. Supabase PKCE flow mở browser
3. User chọn tài khoản Google
4. Supabase redirect về `careonroad://auth/callback?code=xxx`
5. App nhận deep link → exchange code → session

---

## 6. Triển khai tính năng Rider

### 6.1. Quản lý xe (Vehicles)

**Service:** `motorcycles-service.ts`

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| `listMotorcycles()` | GET `/api/v1/motorcycles` | Lấy danh sách xe |
| `createMotorcycle()` | POST `/api/v1/motorcycles` | Thêm xe mới |
| `updateMotorcycle()` | PATCH `/api/v1/motorcycles/{id}` | Cập nhật xe |
| `archiveMotorcycle()` | DELETE `/api/v1/motorcycles/{id}` | Xóa xe |

**Mapping Backend → UI:**

```typescript
// Backend trả về snake_case
interface MotorcycleResponse {
  id: string;
  brand_text: string;
  model_text: string;
  license_plate?: string;
  year?: number;
  created_at: string;
}

// UI sử dụng camelCase + derived fields
interface Vehicle {
  id: string;
  name: string;         // `${brand} ${model}`
  brand: string;
  plate: string;
  mileage: number;      // Default 0
  color: string;        // Default '—'
  year: number;
  lastMaintenance: string;
  nextMaintenance: string;
  image: string;        // Default Unsplash image
}
```

### 6.2. Yêu cầu dịch vụ (Service Requests)

**Service:** `service-requests-service.ts`

#### 6.2.1. Tạo yêu cầu cứu hộ

```typescript
// use-service-requests.ts
const startRescue = async ({ motorcycleId, problemDescription, location, addressText }) => {
  // 1. Tạo service request
  const created = await apiCreateServiceRequest({
    motorcycle_id: motorcycleId,
    service_type: 'emergency_rescue',
    problem_description: problemDescription,
    location: { latitude, longitude },
    address_text: addressText,
  });

  // 2. Auto-start dispatch
  const round = await apiStartDispatch(created.id);

  // 3. Bắt đầu polling
  scheduleNextPoll(created.id, 'searching');
};
```

**Đặc điểm:**
- `X-Idempotency-Key` được tạo bằng UUID v4 cho mỗi yêu cầu
- Location được lấy từ `expo-location` (GPS + reverse geocoding)
- Polling bắt đầu ngay sau khi tạo request

#### 6.2.2. Trạng thái và Phase Mapping

```typescript
// Service Request Status → UI Phase
function statusToPhase(status: RequestStatus): Phase {
  switch (status) {
    case 'submitted':
    case 'dispatching':
    case 'offered':
    case 'manual_escalation':
      return 'searching';      // Đang tìm thợ
    case 'assigned':
    case 'mechanic_en_route':
    case 'in_service':
      return 'tracking';       // Đang theo dõi
    case 'awaiting_quote_approval':
      return 'quote';          // Chờ duyệt báo giá
    case 'awaiting_payment':
      return 'payment';        // Chờ thanh toán
    case 'completed':
      return 'completed';
    case 'canceled':
      return 'canceled';
  }
}
```

### 6.3. Theo dõi Real-time

**Hook:** `use-service-requests.ts`

**Polling Intervals:**

| Dữ liệu | Interval | Lý do |
|----------|----------|-------|
| Request status | 5s | Cập nhật trạng thái nhanh |
| ETA (route) | 30s | Tính toán route ít thay đổi |
| Live location | 15s | Cập nhật vị trí thợ |

**Polling Matrix:**

```typescript
// scheduleNextPoll() logic
if (phase in ['searching', 'tracking', 'quote', 'payment', 'completed']) {
  // Poll request status every 5s
  setTimeout(() => refreshActive(), 5000);
}

if (phase in ['tracking', 'quote', 'payment', 'completed']) {
  // Poll ETA every 30s
  setTimeout(() => refreshActive(), 30000);
  // Poll live location every 15s
  setTimeout(() => refreshActive(), 15000);
}
```

### 6.4. Quản lý Reminders

**Service:** `reminders-service.ts`

**Recurrence Mapping:**

```typescript
// UI → Backend
type ReminderRecurrence = 'none' | 'weekly' | 'monthly' | 'quarterly';

function recurrenceToIntervalDays(r: ReminderRecurrence): number | undefined {
  switch (r) {
    case 'none': return undefined;     // One-shot
    case 'weekly': return 7;
    case 'monthly': return 30;
    case 'quarterly': return 90;
  }
}

// Status derivation
function deriveStatus(r: Reminder, now: Date): ReminderStatus {
  if (!r.enabled) return 'disabled';
  if (r.snoozed_until && new Date(r.snoozed_until) > now) return 'snoozed';
  return 'active';
}
```

### 6.5. Notifications

**Hook:** `use-notifications.ts`

**Tính năng:**
- Polling 30s cho unread count + top 10 notifications
- Optimistic update khi mark read
- Cursor pagination cho infinite scroll
- Deep-link routing dựa trên notification type

**Notification Category Mapping:**

```typescript
function normalizeNotificationType(type: string): NotificationCategory {
  if (value.startsWith('rescue.') || value.startsWith('maintenance.booking'))
    return 'service_request';
  if (value.startsWith('assignment.')) return 'assignment';
  if (value.startsWith('quote.')) return 'quote';
  if (value.startsWith('payment.')) return 'payment';
  if (value === 'maintenance.reminder' || value.startsWith('reminder.'))
    return 'reminder';
  if (value.startsWith('review.')) return 'review';
  return 'system';
}
```

---

## 7. Triển khai tính năng Mechanic

### 7.1. Dashboard

**Service:** `mechanics-service.ts` → `getMechanicDashboard()`

**Dữ liệu trả về:**

```typescript
interface MechanicDashboardResponse {
  availability: {
    profile_status: MechanicProfileStatus;
    is_available: boolean;
  };
  location: {
    freshness: 'missing' | 'fresh' | 'stale';
    updated_at?: string;
  };
  open_offers_count: number;
  active_assignment?: MechanicDashboardJob;
  today_counts: {
    accepted_jobs: number;
    completed_jobs: number;
    canceled_jobs: number;
  };
  seven_day_performance: {
    completed_jobs: number;
    acceptance_rate: number;
    quote_approval_rate: number;
  };
  rating: { average: number; count: number };
  next_action_codes: NextActionCode[];
}
```

### 7.2. Offers (Đề xuất công việc)

**Service:** `dispatch-service.ts`

**Flow:**

```
┌─────────────────────────────────────────────────────┐
│                   OFFER LIFECYCLE                    │
│                                                     │
│  Rider creates request                              │
│          ↓                                         │
│  Backend dispatch → create round                    │
│          ↓                                         │
│  For each eligible mechanic:                        │
│    create DispatchOffer with rank + distance       │
│          ↓                                         │
│  Mechanic receives offer (GET /dispatch/offers)    │
│          ↓                                         │
│  ┌─────────────┬─────────────┐                     │
│  │ Accept      │ Decline     │                     │
│  │ POST /acc.. │ POST /dec.. │                     │
│  └─────────────┴─────────────┘                     │
│          ↓                                         │
│  If accepted: → creates Assignment (atomic)         │
└─────────────────────────────────────────────────────┘
```

**Polling:** Offers screen polling mỗi 15s

### 7.3. Job Management

**Service:** `mechanic-jobs-service.ts`

#### 7.3.1. Assignment Status State Machine

```typescript
// BE States → UI Status
const MECHANIC_JOB_FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'accepted', label: 'Chờ nhận' },
  { id: 'en_route', label: 'Đang đến' },
  { id: 'on_site', label: 'Đã tới' },
  { id: 'diagnosis', label: 'Chẩn đoán' },
  { id: 'quoted', label: 'Đã báo giá' },
  { id: 'awaiting_payment', label: 'Chờ thanh toán' },
  { id: 'in_progress', label: 'Đang sửa' },
  { id: 'completed', label: 'Hoàn tất' },
  { id: 'canceled', label: 'Đã huỷ' },
];

// UI gộp 8 BE states → 4 display states
type MechanicJobStatus = 'pending' | 'in_progress' | 'awaiting_parts' | 'completed';

function mapAssignmentStatus(s: AssignmentStatus): MechanicJobStatus {
  switch (s) {
    case 'accepted':
    case 'en_route':
    case 'on_site':
    case 'diagnosis':
    case 'quoted':
      return 'pending';
    case 'awaiting_payment':
    case 'in_progress':
      return 'in_progress';
    case 'completed':
      return 'completed';
    case 'canceled':
    case 'recovery_canceled':
      return 'completed'; // best-effort
  }
}
```

#### 7.3.2. Job Status Transition

```typescript
// MechanicAppContext.updateJobStatus()
async function updateJobStatus(id: string, status: MechanicJobStatus) {
  // Optimistic update
  setJobs(prev => prev.map(j =>
    j.id === id ? { ...j, status } : j
  ));

  // Map UI status → BE status
  let beStatus: AssignmentStatus;
  switch (status) {
    case 'pending': beStatus = 'accepted'; break;
    case 'in_progress': beStatus = 'in_progress'; break;
    case 'awaiting_parts': beStatus = 'diagnosis'; break;
    case 'completed': beStatus = 'completed'; break;
  }

  // Call BE
  await transitionAssignment(id, { status: beStatus });
}
```

### 7.4. Chẩn đoán (Diagnosis)

**Service:** `mechanic-jobs-service.ts` → `createDiagnosis()`

```typescript
interface DiagnosisInput {
  summary: string;
  root_cause?: string;
  recommended_action?: string;
}

interface DiagnosisRecord {
  id: string;
  assignment_id: string;
  summary: string;
  root_cause?: string;
  recommended_action?: string;
  created_by: string;
  created_at: string;
}
```

**Optimistic Update Pattern:**

```typescript
const submitDiagnosisForJob = async (jobId, input) => {
  // 1. Optimistic placeholder
  const optimistic: DiagnosisRecord = {
    id: `optimistic-${Date.now()}`,
    assignment_id: jobId,
    summary: input.summary,
    // ...
  };
  setLatestDiagnosisMap(prev => ({ ...prev, [jobId]: optimistic }));

  try {
    // 2. Call BE
    const result = await createDiagnosis(jobId, input);
    setLatestDiagnosisMap(prev => ({ ...prev, [jobId]: result }));
    return result;
  } catch (e) {
    // 3. Rollback on error
    setLatestDiagnosisMap(prev => {
      const next = { ...prev };
      if (previous) next[jobId] = previous;
      else delete next[jobId];
      return next;
    });
    throw e;
  }
};
```

### 7.5. Báo giá (Quotes)

**Services:**
- `mechanic-quotes-service.ts` — Mechanic tạo báo giá
- `quotes-service.ts` — Rider xem/duyệt/từ chối

#### 7.5.1. Mechanic Quote Submission

```typescript
interface QuoteLineInput {
  line_type: 'labor' | 'part' | 'other';
  description: string;
  quantity: number;
  unit_amount: number;
}

// Purpose auto-suggested từ service type
function suggestPurposeForServiceType(serviceType: string): QuotePurpose {
  if (serviceType === 'emergency_rescue') return 'rescue_final';
  if (serviceType === 'periodic_maintenance') return 'maintenance_work';
  return 'standard';
}
```

#### 7.5.2. Rider Quote Decision

```typescript
// use-service-requests.ts
const approveQuote = async () => {
  const { quote } = active;
  await approveQuote(quote.id);  // POST /quotes/{id}/approve
  await refreshActive(requestId);
};

const rejectQuote = async (reason?: string) => {
  const { quote } = active;
  await rejectQuote(quote.id, reason);  // POST /quotes/{id}/reject
  await refreshActive(requestId);
};
```

### 7.6. Live Location Sharing

**Service:** `mechanic-jobs-service.ts` → `ingestLiveLocation()`

**Logic trong MechanicAppProvider:**

```typescript
const toggleLiveSharing = async (assignmentId: string) => {
  // 1. Nếu đang share cùng assignment → toggle off
  if (sharingAssignmentId === assignmentId) {
    stopLiveSharing();
    return;
  }

  // 2. Bắt đầu watch GPS
  const handle = await watchCurrentPosition(
    (loc) => {
      // Rate-limit 10s/client-side
      if (now - last < 10_000) return;
      // Skip poor accuracy
      if (loc.accuracy > 100) return;

      // Gửi lên BE
      ingestLiveLocation(assignmentId, {
        latitude: loc.latitude,
        longitude: loc.longitude,
        observed_at: new Date().toISOString(),
        accuracy_meters: loc.accuracy ?? 50,
      });
    },
    (err) => { stopLiveSharing(); },
    { timeInterval: 15_000, distanceInterval: 25 }
  );

  watchHandleRef.current = handle;
  setSharingAssignmentId(assignmentId);
};

// Auto-stop khi job completed
useEffect(() => {
  if (!sharingAssignmentId) return;
  const status = assignmentStatusMap[sharingAssignmentId];
  if (status === 'completed' || status === 'canceled') {
    stopLiveSharing();
  }
}, [sharingAssignmentId, assignmentStatusMap]);
```

### 7.7. Performance Metrics

**Service:** `mechanics-service.ts` → `getMechanicPerformance()`

**Metrics:**

```typescript
interface MechanicPerformanceResponse {
  completed_jobs: number;
  canceled_jobs: number;
  acceptance_rate: number;         // Chấp nhận offer / tổng offer
  decline_rate: number;            // Từ chối / tổng offer
  quote_approval_rate: number;     // Duyệt báo giá / tổng báo giá
  average_accept_time_seconds?: number;
  average_workflow_duration_seconds?: number;
  rating: { average: number; count: number };
}
```

**Filter by time:**

```typescript
const reloadPerformance = async ({ date_from, date_to } = {}) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  await getMechanicPerformance({ date_from: d.toISOString() });
};
```

---

## 8. Dịch vụ Backend và API

### 8.1. API Client (`api.ts`)

**Design Pattern:** Builder pattern với typed helpers

```typescript
// Core request function
async function apiRequest<T>(path, options: RequestOptions): Promise<T> {
  const url = buildUrl(path, options.query);
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Token injection
  const token = await resolveToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Timeout handling
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);

  // Fetch
  const response = await fetch(url, { method, headers, body, signal });

  // Error handling
  if (!response.ok) {
    const error = await response.json();
    throw new ApiError(status, error.code, error.message);
  }

  return response.json();
}

// Typed helpers
export const apiGet = (path, options) =>
  apiRequest(path, { ...options, method: 'GET' });

export const apiPost = (path, body, options) =>
  apiRequest(path, { ...options, method: 'POST', body });

export const apiPatch = (path, body, options) =>
  apiRequest(path, { ...options, method: 'PATCH', body });
```

### 8.2. Environment Configuration (`config.ts`)

**Priority Order:**

```typescript
function readEnv(): EnvShape {
  // 1. Override từ terminal (LAN dev)
  const override = process.env.EXPO_PUBLIC_API_BASE_URL_OVERRIDE;

  // 2. Từ .env hoặc EAS profile
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;

  // 3. Fallback theo APP_VARIANT
  const variantFallback = VARIANT_FALLBACK[variant];

  const apiBaseUrl = override ?? fromEnv ?? variantFallback;
}
```

**Tại sao override?**
- Khi dev trên thiết bị thật qua WiFi LAN, IP máy dev thường đổi (DHCP)
- Script `start:lan` tự detect IP LAN rồi set biến này
- Không cần sửa .env mỗi lần đổi mạng

### 8.3. Supabase Client (`supabase-client.ts`)

**Singleton Pattern:**

```typescript
let clientInstance: SupabaseClient | null = null;
let clientInitialized = false;

export function getSupabase(): SupabaseClient | null {
  if (clientInitialized) return clientInstance;
  clientInitialized = true;

  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    clientInstance = null;
    return null; // Demo mode
  }

  clientInstance = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      storage: createAsyncStorageAdapter(),
      autoRefreshToken: true,
      persistSession: true,
    },
  });

  return clientInstance;
}
```

### 8.4. Idempotency (`idempotency.ts`)

**Header:** `X-Idempotency-Key` (UUID v4, 36 chars)

```typescript
export function newIdempotencyKey(): string {
  // UUID v4 format: xxxxxxxx-xxxx-4xxx-Yxxx-xxxxxxxxxxxx
  // Y = 8|9|a|b
  const hex = (bits) => Math.floor(Math.random() * bits).toString(16);
  const data1 = hex(0xffffffff);
  const data3 = `4${hex(0xfff)}`;
  const y = (8 + Math.floor(Math.random() * 4)).toString(16);
  return `${data1}-${hex(0xffff)}-${data3}-${y}${hex(0xfff)}-${hex(0xffffffff)}${hex(0xffff)}`;
}
```

**Tại sao cần idempotency key?**
- User có thể bấm nhiều lần (retry do mạng lag)
- Backend sẽ không tạo resource trùng với cùng idempotency key trong 24h

---

## 9. Quản lý State và Context

### 9.1. AuthContext (`auth-context.tsx`)

**Trách nhiệm:**
- Quản lý authentication state (loading/authenticated/unauthenticated)
- Login/Logout/Register methods
- Deep-link OAuth handling
- Role detection (rider/mechanic)
- Demo mode fallback

**State:**

```typescript
interface AuthState {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  user: PublicAuthUser | null;
  role: 'rider' | 'mechanic' | null;
  isBackendConfigured: boolean;
  login: (input: LoginInput) => Promise<PublicAuthUser>;
  logout: () => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  updateProfile: (input: ProfileInput) => Promise<PublicAuthUser>;
  switchRoleDemo: () => Promise<void>;  // Demo mode only
  bypassLoginAs: (role: AuthRole) => Promise<void>; // Dev only
}
```

### 9.2. AppProvider (`app-context.tsx`)

**Trách nhiệm:** Rider state management

**State:**

```typescript
interface AppState {
  // Vehicles
  vehicles: Vehicle[];
  vehiclesLoading: boolean;
  reloadVehicles: () => Promise<void>;
  addVehicle: (v) => Promise<Vehicle | null>;
  updateVehicle: (v) => Promise<Vehicle | null>;
  archiveVehicle: (id) => Promise<boolean>;

  // Services/History
  services: ServiceRecord[];
  appointments: Appointment[];
  canceledAppointments: CanceledAppointment[];
  emergencyCalls: EmergencyCall[];

  // Reminders
  reminders: Reminder[];

  // Notifications (aggregate)
  notifications: NotificationItem[];
  unreadCount: number;

  // UI State
  selectedVehicleId: string | null;
  darkMode: boolean;
}
```

**Data Derivation Pattern:**

```typescript
// BE ServiceRequest → UI ServiceRecord
function requestToServiceRecord(req, assignmentByReqId, quoteByReqId, vehicleNameById) {
  const assignment = assignmentByReqId.get(req.id);
  const quote = quoteByReqId.get(req.id);
  return {
    id: req.id,
    date: (req.scheduled_start_at ?? req.created_at).slice(0, 10),
    type: mapServiceTypeToLabel(req.service_type),
    vehicleName: vehicleNameById.get(req.motorcycle_id) ?? 'Xe',
    price: quote?.total_amount ?? 0,
    mechanic: assignment ? assignment.mechanic_id.slice(0, 8) : 'Thợ CareOnRoad',
  };
}
```

### 9.3. MechanicAppProvider (`mechanic-app-context.tsx`)

**Trách nhiệm:** Mechanic state management

**State:**

```typescript
interface MechanicState {
  mechanic: MechanicProfile;
  garage: GarageInfo;
  jobs: MechanicJob[];
  todayJobs: MechanicJob[];
  upcomingTodayJobs: MechanicJob[];
  dashboard: MechanicDashboardResponse | null;
  performance: MechanicPerformanceResponse | null;

  // Actions
  updateJobStatus: (id, status) => Promise<void>;
  completeJob: (id, payload) => Promise<void>;
  toggleAvailability: () => Promise<void>;

  // Quotes & Diagnoses
  submitQuoteForRequest: (jobId, input) => Promise<Quote | null>;
  submitDiagnosisForJob: (jobId, input) => Promise<DiagnosisRecord | null>;

  // Live Location
  sharingAssignmentId: string | null;
  toggleLiveSharing: (assignmentId) => Promise<void>;
}
```

**Job Filtering Logic:**

```typescript
// Filter theo BE assignment status (raw) thay vì UI status
const filtered = jobs.filter((j) => {
  if (filter === 'all') return true;
  const beStatus = getAssignmentStatus(j.id);
  return beStatus === filter;
});
```

---

## 10. Cơ chế Polling và Real-time

### 10.1. Polling Architecture

**Nguyên tắc:**

1. **Không có WebSocket/SSE** — chỉ dùng HTTP polling đơn giản
2. **Differentiated intervals** — dữ liệu quan trọng polling nhanh hơn
3. **Cleanup on unmount** — luôn clear timer trong useEffect return
4. **Optimistic updates** — UI phản hồi ngay, rollback nếu BE lỗi

### 10.2. Timer Management

```typescript
// use-service-requests.ts
const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const etaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const liveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const clearTimers = () => {
  if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
  if (etaTimerRef.current) clearTimeout(etaTimerRef.current);
  if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
};

// Cleanup khi unmount
useEffect(() => clearTimers, [clearTimers]);
```

### 10.3. Notifications Polling

```typescript
// use-notifications.ts
const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

useEffect(() => {
  void reload(); // Initial load
  pollTimerRef.current = setInterval(() => void reload(), 30000);
  return () => clearInterval(pollTimerRef.current!);
}, [isBackendConfigured, authStatus]);
```

---

## 11. Các thư viện và công nghệ sử dụng

### 11.1. Core Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| expo | ~52.0.42 | Expo SDK - development platform |
| expo-router | ~4.0.19 | File-based routing |
| react-native | 0.76.9 | React Native core |
| react | 18.3.1 | React library |
| typescript | ^5.3.3 | Type safety |
| nativewind | ^4.2.6 | Tailwind CSS for RN |
| lucide-react-native | ^0.469.0 | Icon library |
| @supabase/supabase-js | ^2.116.0 | Backend auth & database |
| expo-location | ~18.0.10 | GPS location |
| @react-native-async-storage/async-storage | 1.23.1 | Local storage |
| expo-linking | ~7.0.5 | Deep links |
| react-native-reanimated | ~3.16.1 | Animations |
| react-native-gesture-handler | ~2.20.2 | Gestures |
| react-native-safe-area-context | ~4.12.0 | Safe area handling |
| react-native-screens | ~4.4.0 | Native screens |
| react-native-svg | 15.8.0 | SVG support |
| @react-native-community/datetimepicker | 8.2.0 | Date/time picker |

### 11.2. Expo Router (File-based Routing)

**Convention:**

```
app/folder/page.tsx → /folder/page
app/(group)/page.tsx → /page (group không affect URL)
app/[id].tsx → /:id (dynamic route)
```

**Nested Layouts:**

```
app/
├── _layout.tsx           # Root (AuthProvider)
├── (auth)/
│   └── _layout.tsx      # Auth group (no tabs)
├── rider/
│   ├── _layout.tsx      # Rider shell (AppProvider)
│   └── (tabs)/
│       └── _layout.tsx  # Rider tabs
└── mechanic/
    ├── _layout.tsx      # Mechanic shell (MechanicAppProvider)
    └── (tabs)/
        └── _layout.tsx # Mechanic tabs
```

### 11.3. NativeWind (Tailwind CSS)

**Cấu hình:** `nativewind.config.ts`

```typescript
export default {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        navy: '#16202f',
        brand: { blue: '#1974f7' },
        destructive: '#ed3f3a',
        mint: '#a9ffad',
        primary: '#1974f7',
      },
    },
  },
};
```

**Sử dụng:**

```typescript
<View className="flex-1 bg-background">
  <Text className="text-lg font-bold text-foreground">
    Hello
  </Text>
</View>
```

### 11.4. Expo Location

**API Chính:**

```typescript
// One-shot location capture
const location = await Location.getCurrentPositionAsync({
  accuracy: Location.Accuracy.Balanced,
});

// Reverse geocode
const addresses = await Location.reverseGeocodeAsync({
  latitude: location.coords.latitude,
  longitude: location.coords.longitude,
});

// Continuous watch
const subscription = await Location.watchPositionAsync(
  { timeInterval: 15000, distanceInterval: 25 },
  (pos) => { /* handle update */ }
);
subscription.remove();
```

### 11.5. AsyncStorage Adapter

**Custom Adapter cho Supabase:**

```typescript
function createAsyncStorageAdapter(): SupportedStorage {
  const PREFIX = 'careonroad.supabase.';
  return {
    async getItem(key) {
      return AsyncStorage.getItem(`${PREFIX}${key}`);
    },
    async setItem(key, value) {
      await AsyncStorage.setItem(`${PREFIX}${key}`, value);
    },
    async removeItem(key) {
      await AsyncStorage.removeItem(`${PREFIX}${key}`);
    },
  };
}
```

---

## 12. Kết luận

### 12.1. Điểm mạnh của kiến trúc

1. **Clean Separation of Concerns:** UI tách biệt khỏi business logic qua Context + Services
2. **Backend-first Design:** Không mock khi có backend, đảm bảo tính production-ready
3. **Type Safety:** TypeScript throughout, giảm runtime errors
4. **Polling Efficiency:** Differentiated intervals tối ưu bandwidth
5. **Optimistic Updates:** UX phản hồi nhanh dù network chậm
6. **Demo Mode:** App vẫn hoạt động khi chưa có backend

### 12.2. Các pattern quan trọng

1. **Token Provider Pattern:** Giải quyết vấn đề JWT refresh
2. **Context Composition:** Layered providers cho từng domain
3. **Service Layer:** Wrapped API calls với typed interfaces
4. **Idempotency:** Safe retry không duplicate operations
5. **Deep-link Routing:** Notification navigation thông minh

### 12.3. Hạn chế và cải tiến tương lai

1. **Polling thay vì WebSocket:** Tốn bandwidth hơn, có thể cải thiện bằng SSE
2. **Chưa có offline mode:** App cần network để hoạt động
3. **Chưa có push notifications (FCM):** Chỉ polling notification
4. **Không có state persistence cho jobs:** Reload mất filter state

### 12.4. Roadmap tiếp theo

- ASR voice chatbot (`POST /api/chatbot/sessions/[id]/transcriptions`)
- Media upload picker UI
- Push notifications (FCM)
- Admin web app
- Offline mode với service worker

---

## PHỤ LỤC

### A. File cấu hình quan trọng

**`app.config.ts`** — Expo configuration với multi-environment support

**`tailwind.config.ts`** — Custom theme với brand colors

**`metro.config.js`** — Metro bundler config

**`babel.config.js`** — Babel presets (React Native, NativeWind)

### B. API Endpoints Quick Reference

**Authentication:**
- `GET /api/v1/auth/me` — Get current actor
- `POST /api/v1/auth/profile` — Bootstrap/update profile
- `PATCH /api/v1/auth/profile` — Update profile
- `POST /api/v1/auth/devices` — Register device

**Rider:**
- `GET/POST /api/v1/motorcycles` — Motorcycle CRUD
- `GET/POST /api/v1/service-requests` — Service request CRUD
- `POST /api/v1/service-requests/{id}/dispatch` — Start dispatch
- `GET /api/v1/service-requests/{id}/quotes` — List quotes
- `POST /api/v1/quotes/{id}/approve|reject` — Quote decision
- `GET/POST /api/v1/reminders` — Reminder CRUD
- `GET /api/v1/notifications` — Notification inbox
- `POST /api/v1/payments/orders` — Create payment order

**Mechanic:**
- `GET /api/v1/mechanics/me/dashboard` — Dashboard data
- `GET /api/v1/mechanics/me/jobs` — Job list
- `GET /api/v1/mechanics/me/performance` — Performance metrics
- `GET /api/v1/dispatch/offers` — List offers
- `POST /api/v1/dispatch/offers/{id}/accept|decline` — Accept/decline offer
- `POST /api/v1/assignments/{id}/status` — Update job status
- `POST /api/v1/assignments/{id}/eta` — Submit ETA
- `POST /api/v1/assignments/{id}/diagnoses` — Create diagnosis
- `POST /api/v1/service-requests/{id}/quotes` — Submit quote
- `PUT /api/v1/assignments/{id}/live-location` — Share location
- `GET /api/v1/assignments/{id}/route-eta` — Get route ETA

---

*Báo cáo được viết vào ngày 03/10/2026*
