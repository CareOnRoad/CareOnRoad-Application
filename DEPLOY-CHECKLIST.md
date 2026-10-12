# Production deploy checklist (Web FE → Vercel/Cloudflare Pages, BE đã ở careonroad.dpdns.org)

Checklist này tóm tắt các bước cần làm **bên ngoài repo** (dashboard của bên thứ ba) khi deploy web FE lên production. Repo đã có sẵn:

- [`apps/web/.env.production.example`](apps/web/.env.production.example) — biến cần đặt.
- [`apps/api/CLOUDFLARE.md`](apps/api/CLOUDFLARE.md) — trạng thái hiện tại của BE + ghi chú khi nào cần CORS.

## 1. Hosting provider (Vercel khuyến nghị, vì Next.js native)

- [ ] Tạo project mới trên Vercel, trỏ vào thư mục `apps/web/` của repo.
- [ ] **Build command**: `pnpm run build` (hoặc để Vercel tự detect).
- [ ] **Output directory**: để mặc định `.next/`.
- [ ] **Environment Variables** (Production):
  - `API_BASE_URL` = `https://careonroad.dpdns.org`
  - `NEXT_PUBLIC_SUPABASE_URL` = `https://lwgwprxjyemihlkspgjc.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = `<publishable key>` (xem Supabase Dashboard → Settings → API)
- [ ] **Domain**: gắn custom domain hoặc dùng Vercel subdomain (vd `careonroad-web.vercel.app`).
- [ ] Trigger first deploy, đợi build xong, copy URL production.

> Nếu chọn **Cloudflare Pages** thay Vercel: cần adapter (`@cloudflare/next-on-pages` hoặc `OpenNext`) do Next 16 không build thẳng ra Workers runtime. Có thể cần thêm dependency — sẽ hỏi trước khi thêm.

## 2. Supabase Dashboard

URL: <https://supabase.com/dashboard/project/lwgwprxjyemihlkspgjc>

- [ ] **Authentication → URL Configuration**:
  - **Site URL**: `https://<domain-web-prod>` (vd `https://careonroad-web.vercel.app`).
  - **Redirect URLs**: thêm `https://<domain-web-prod>` + bất kỳ subpath OAuth callback (vd `https://<domain-web-prod>/auth/callback`).
- [ ] Verify email/password provider vẫn bật.
- [ ] Nếu sau này bật Google OAuth: thêm callback URL tương ứng.

> Lưu ý: KHÔNG thay đổi `JWT Issuer` / `JWT Audience` — BE verify theo env `SUPABASE_JWT_ISSUER/AUDIENCE` đang trỏ đúng. Đổi nhầm sẽ break mọi request `Authorization: Bearer ...`.

## 3. payOS Dashboard

URL: <https://my.payos.vn/> (merchant portal)

- [ ] **Webhook URL** đã đăng ký: `https://careonroad.dpdns.org/api/v1/payments/webhooks/payos` (theo [`apps/api/CLOUDFLARE.md`](apps/api/CLOUDFLARE.md)).
- [ ] **Return URL** (sau thanh toán thành công): `https://careonroad.dpdns.org/payment/return`.
- [ ] **Cancel URL** (sau khi user hủy): `https://careonroad.dpdns.org/payment/cancel`.
- [ ] Verify checksum key (`PAYOS_CHECKSUM_KEY`) trùng với giá trị trong `apps/api/.env.local`.

> Không cần thay đổi gì nếu dashboard payOS đã setup đúng từ trước theo `CLOUDFLARE.md`. Chỉ cần verify.

## 4. Smoke test sau deploy

- [ ] Mở `https://<domain-web-prod>/` → render marketing pages (đang dùng mock data, không gọi BE).
- [ ] Mở `https://<domain-web-prod>/admin/login` → đăng nhập bằng tài khoản admin (xem seed `pnpm run seed:mock:verify` để biết account nào có role admin).
- [ ] Sau login redirect về `/admin` → network tab thấy request `https://careonroad.dpdns.org/api/v1/auth/me` mang `Authorization: Bearer ...`, response 200.
- [ ] Reload trang sau 1 giờ (token hết hạn) → vẫn ở dashboard, `proxy.ts` đã refresh cookie.
- [ ] Mở `https://careonroad.dpdns.org/api/v1/internal/health/live` → 200.
- [ ] Mở `https://careonroad.dpdns.org/api/v1/internal/health/ready` → 200 (hoặc 503 với `notifications: invalid` — đã biết, cần bổ sung FCM env).

## 5. Mobile (tham khảo)

- File `apps/mobile/eas.json` đã đổi sang `https://careonroad.dpdns.org` cho profile `staging`/`production` (chưa build production trong scope này).
- `VARIANT_FALLBACK` trong `apps/mobile/src/lib/config.ts` cũng đã đổi.
- File `.env` dev thật giữ `http://localhost:3000` — không cần đụng tới.
- Test nhanh production URL qua Expo Go:
  ```powershell
  cd apps/mobile
  $env:EXPO_PUBLIC_API_BASE_URL_OVERRIDE = "https://careonroad.dpdns.org"
  pnpm start
  ```
  Mở app, màn hình login → network tab thấy request bay về domain production.

## 6. Khi nào cần mở task CORS (phase sau)

Trigger: wire UI rider/mechanic thật trên web gọi `/api/v1/**` từ browser.

- Tạo `apps/api/src/middleware.ts` (matcher `/api/:path*`) — spec đã viết trong [`apps/api/CLOUDFLARE.md`](apps/api/CLOUDFLARE.md) mục "CORS — khi nào cần".
- Thêm `ALLOWED_ORIGINS` env + verify preflight qua curl.
- Có thể dùng Vercel/Cloudflare Routes thay middleware Next.js nếu muốn (đơn giản hơn, không cần redeploy BE).
