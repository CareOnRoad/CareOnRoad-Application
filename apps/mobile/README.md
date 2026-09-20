# CareOnRoad Mobile (Expo Router + React Native)

Mobile app cho hệ thống CareOnRoad - cứu hộ & bảo dưỡng xe máy tại Việt Nam.
App phục vụ cả **Rider** (người dùng) và **Mechanic** (thợ sửa xe).

---

## Trạng thái hiện tại

| Module | Trạng thái |
|--------|------------|
| Routing & tabs (Rider / Mechanic) | ✅ Đã tích hợp |
| Auth UI (login / register) | ✅ Đã tích hợp |
| **Auth thật (Supabase + Backend)** | ✅ **Đã tích hợp - xem bên dưới** |
| **Motorcycles CRUD (Rider)** | ✅ **Đã tích hợp API** (`/api/v1/motorcycles`) |
| Service Requests / Dispatch / Assignments | ⏳ Sẽ tích hợp sau |
| Notifications / Reminders / Payments | ⏳ Sẽ tích hợp sau |
| UI screens (mock data) | ✅ Sẵn sàng, dùng mock data khi chưa tích hợp |

> Nếu chưa cấu hình Supabase + Backend, app tự động chạy ở **chế độ Demo**
> dùng local AsyncStorage (2 tài khoản mẫu: `rider1@gmail.com`,
> `mechanic1@gmail.com` - mật khẩu `demo1234`).

---

## Cách chạy

```bash
# Cài dependencies (lần đầu hoặc khi có thay đổi package.json)
pnpm install

# Chạy dev server (Expo) - mặc định dùng .env
pnpm start

# Hoặc chạy thẳng trên Android/iOS
pnpm android   # hoặc: pnpm ios

# Type check
pnpm typecheck

# Lint
pnpm lint
```

> Dùng `pnpm.cmd` thay vì `pnpm` nếu PowerShell chặn script (Windows).

### 4 cách start tuỳ môi trường

| Lệnh | Khi nào dùng | Ghi chú |
|------|--------------|---------|
| `pnpm start` | Dev trên iOS Simulator / Android Emulator cùng máy với BE | Dùng `http://localhost:3000` (mặc định trong `.env`) |
| `pnpm start:lan` | **Dev trên thiết bị thật qua WiFi LAN** | Script tự detect IP LAN và inject vào `EXPO_PUBLIC_API_BASE_URL_OVERRIDE`. **Không cần sửa `.env` khi IP đổi.** |
| `pnpm start:tunnel` | Dev khi máy dev không cùng LAN với thiết bị | Expo tunnel (cần đăng nhập Expo account) |
| `EXPO_PUBLIC_API_BASE_URL_OVERRIDE=http://X.X.X.X:3000 pnpm start` | Override thủ công khi IP đặc biệt | Đặt biến trước khi start |

Thứ tự ưu tiên khi đọc API URL (xem `src/lib/config.ts`):

```
1. EXPO_PUBLIC_API_BASE_URL_OVERRIDE   ← set qua terminal (cao nhất)
2. EXPO_PUBLIC_API_BASE_URL            ← set trong .env hoặc EAS profile
3. APP_VARIANT + hardcoded fallback    ← chỉ cho production build
```

---

## Cấu hình Backend thật (Supabase + API)

App cần **3 biến môi trường** (đặt vào `apps/mobile/.env` - file này
thuộc `.gitignore`):

```bash
# URL gốc của backend Next.js (chạy port 3000 mặc định)
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000

# Supabase project - lấy từ Supabase Dashboard → Settings → API
EXPO_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co

# Anon/Publishable key - KHÔNG phải service role key
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

### Yêu cầu về phía Backend

1. **API phải chạy được** tại `EXPO_PUBLIC_API_BASE_URL`. Xem
   `apps/api/README.md` để khởi động backend.

2. **Supabase project**:
   - Tạo project tại https://supabase.com.
   - Lấy **URL** + **anon key** trong Settings → API.
   - Bật **Email/password auth** trong Authentication → Providers.

3. **Backend phải verify được JWT** từ Supabase project của bạn.
   Cấu hình trong `apps/api/.env.local`:
   ```bash
   SUPABASE_URL=https://<your-project>.supabase.co
   SUPABASE_JWT_ISSUER=https://<your-project>.supabase.co
   SUPABASE_JWT_AUDIENCE=authenticated
   SUPABASE_JWKS_URL=https://<your-project>.supabase.co/auth/v1/jwks
   SUPABASE_PUBLISHABLE_KEY=<anon_key>
   SUPABASE_SERVICE_ROLE_KEY=<service_role_key>   # chỉ dùng ở server
   ```

4. **Apply migrations** để có tables `app_users`, `app_user_roles`:
   ```bash
   cd apps/api
   pnpm.cmd run db:setup   # xem apps/api/README.md
   ```

### Flow đăng nhập

```
User gõ email/password
   │
   ▼
[Mobile] supabase.auth.signInWithPassword(email, password)
   │
   ▼
Supabase trả access_token (JWT)
   │
   ▼
[Mobile] GET https://api.example.com/api/v1/auth/me
       Authorization: Bearer <JWT>
   │
   ▼
[Backend] verifySupabaseJWT → load app_user → return { id, roles, status }
   │
   ▼
[Mobile] lưu { user, role } vào React Context → redirect tới /rider hoặc /mechanic
```

### Flow đăng ký

```
User gõ email/password/name/role
   │
   ▼
[Mobile] supabase.auth.signUp({ email, password, options.data })
   │
   ▼
[Mobile] POST /api/v1/auth/profile { display_name }
       Authorization: Bearer <JWT mới>
   │
   ▼
[Backend] tạo app_user (default role = rider) + audit + outbox
   │
   ▼
[Mobile] GET /api/v1/auth/me → lấy role → redirect
```

> Hiện tại backend `bootstrapProfile` mặc định gán role = `rider`.
> Để chọn role lúc đăng ký cần thêm endpoint mới (sẽ bổ sung).

---

## Cấu trúc thư mục

```
apps/mobile/
├── app/                    # Expo Router (file-based routing)
│   ├── (auth)/             # Auth route group: /login, /register
│   ├── rider/              # Rider screens (sau khi đăng nhập)
│   ├── mechanic/           # Mechanic screens (sau khi đăng nhập)
│   ├── _layout.tsx         # Root layout (AuthProvider + Stack)
│   └── index.tsx           # Entry → redirect dựa theo auth state
│
├── src/
│   ├── contexts/
│   │   └── auth-context.tsx   # React Context quản lý auth state
│   ├── lib/
│   │   ├── api.ts             # HTTP client (fetch wrapper + token injection)
│   │   ├── config.ts          # Đọc env vars + isAuthConfigured()
│   │   ├── supabase-client.ts # Supabase client + AsyncStorage adapter
│   │   ├── auth-service.ts    # Backend auth API (signIn/signUp/profile)
│   │   ├── auth-storage.ts    # Demo fallback (AsyncStorage local users)
│   │   └── auth-types.ts      # Types: AuthRole, PublicAuthUser, ...
│   └── components/          # UI components (cards, buttons, ...)
│
├── app.config.ts         # Expo dynamic config (đọc env vars khi build)
├── tailwind.config.ts     # Tailwind + NativeWind
└── package.json
```

## Scripts chính

| Lệnh | Mô tả |
|------|-------|
| `pnpm.cmd start` | Khởi động Expo dev server |
| `pnpm.cmd start:lan` | Tự detect IP LAN, khởi động Expo với API URL đúng |
| `pnpm.cmd start:tunnel` | Expo tunnel (chạy khi không cùng LAN) |
| `pnpm.cmd android` | Build + chạy trên Android |
| `pnpm.cmd ios` | Build + chạy trên iOS |
| `pnpm.cmd typecheck` | TypeScript check |
| `pnpm.cmd lint` | ESLint |

---

## Build cho nhiều môi trường (EAS)

Mỗi môi trường có profile riêng trong `eas.json`:

| Profile | API URL | Bundle ID | Mục đích |
|---------|---------|-----------|----------|
| `development` | `http://localhost:3000` | `com.careonroad.mobile.dev` | Dev trên simulator/emulator |
| `preview` | `http://localhost:3000` | `com.careonroad.mobile.preview` | Internal test qua EAS build |
| `staging` | `https://staging-api.careonroad.example` | `com.careonroad.mobile.staging` | Test với backend staging |
| `production` | `https://api.careonroad.example` | `com.careonroad.mobile` | App store / production |

Build commands (cần `eas-cli`):

```bash
# Dev client (cho simulator/emulator)
eas build --profile development --platform ios
eas build --profile development --platform android

# Preview (internal tester, vẫn localhost API)
eas build --profile preview

# Staging (cho QA)
eas build --profile staging

# Production (lên store)
eas build --profile production
```

EAS tự inject các biến `EXPO_PUBLIC_*` từ `eas.json` vào bundle. Khi cần
thay đổi URL backend cho staging/production, sửa `eas.json` rồi rebuild,
**không bao giờ** commit URL thật vào git.

Secrets (service_role key, etc.) nên dùng `eas secret:create` thay vì hardcode.
