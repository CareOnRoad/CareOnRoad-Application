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

# Chạy dev server (Expo)
pnpm start

# Hoặc chạy thẳng trên Android/iOS
pnpm android   # hoặc: pnpm ios

# Type check
pnpm typecheck

# Lint
pnpm lint
```

> Dùng `pnpm.cmd` thay vì `pnpm` nếu PowerShell chặn script (Windows).

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
├── app.json               # Expo config (bundle id, permissions)
├── tailwind.config.ts     # Tailwind + NativeWind
└── package.json
```

## Scripts chính

| Lệnh | Mô tả |
|------|-------|
| `pnpm.cmd start` | Khởi động Expo dev server |
| `pnpm.cmd android` | Build + chạy trên Android |
| `pnpm.cmd ios` | Build + chạy trên iOS |
| `pnpm.cmd typecheck` | TypeScript check |
| `pnpm.cmd lint` | ESLint |
