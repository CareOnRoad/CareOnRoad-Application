# CareOnRoad — Marketing Website (apps/web)

Next.js 16 (App Router) + React 19 + Tailwind 4 landing site for CareOnRoad.
Built from the Figma `Exe101` design file (Section Page) and kept in
lockstep with the existing `apps/api` backend contracts.

## Stack

- **Framework:** Next.js 16 (Turbopack)
- **UI:** React 19 + Tailwind CSS 4
- **Type:** TypeScript (strict)
- **Design tokens:** Tailwind 4 `@theme` block in `src/app/globals.css`
- **Data layer:** static mock data + `apiClient` interface ready to swap to BE

## Commands

```powershell
pnpm.cmd install                    # from repo root
pnpm.cmd run build:web              # production build
pnpm.cmd run dev:web                # local dev server (http://localhost:3000)
pnpm.cmd run lint:web               # eslint
cd apps/web; .\node_modules\.bin\tsc.cmd --noEmit   # typecheck
```

## Routes

| Route          | Page                                | Backend hook (future)                |
| -------------- | ----------------------------------- | ------------------------------------ |
| `/`            | Trang chủ (hero, services, CTA)    | `services`, `testimonials`, `news`   |
| `/dich-vu`     | Danh mục dịch vụ                    | `GET /api/v1/service-categories`     |
| `/tin-tuc`     | Bài viết                            | `GET /api/v1/news`                   |
| `/dat-lich`    | Đặt lịch trước                      | `POST /api/v1/service-requests`      |
| `/lien-he`     | Liên hệ + FAQ                       | `POST /api/v1/contact`               |
| `/yeu-cau`     | Tạo yêu cầu cứu hộ                 | `POST /api/v1/service-requests`      |
| `/khan-cap`    | Trang khẩn cấp (CTA gọi 1900 6868)  | n/a                                  |

All routes are statically pre-rendered today (`○ Static`).

## Project layout

```
apps/web/src/
  app/
    layout.tsx          # Roboto + Header/Footer + global bg
    page.tsx            # Trang chủ
    globals.css         # Tokens + @theme Tailwind 4
    dich-vu/page.tsx
    tin-tuc/page.tsx
    dat-lich/page.tsx
    lien-he/page.tsx
    yeu-cau/page.tsx
    khan-cap/page.tsx
  components/
    layout/             # Header, Footer
    sections/           # Hero, ServicesGrid, ProcessSteps, NewsGrid, etc.
    ui/icons.tsx        # SVG icon registry (heroicons-style)
  lib/
    mock-data.ts        # Static demo content (Vietnamese)
    api-client.ts       # Async methods that today return mocks
    cn.ts               # Tiny class merger
  types/index.ts        # Domain types (mirror BE response shapes)
```

## Swapping mock data with the real backend

`src/lib/api-client.ts` is the only seam. Each method already accepts no
arguments and returns a typed promise — today it serves `mock-data.ts`,
tomorrow it should `fetch('/api/v1/...')` (or hit a route handler that
proxies to `apps/api`).

Example migration for `listServiceCategories`:

```ts
// before
async listServiceCategories(): Promise<ServiceCategory[]> {
  return delay(serviceCategories);
},

// after
async listServiceCategories(): Promise<ServiceCategory[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/service-categories`);
  if (!res.ok) throw new Error(`Service categories ${res.status}`);
  return res.json();
},
```

All consumers (`page.tsx` and section components) call only `apiClient.*`,
so no other files need to change.

## Design tokens

Extracted from Figma `Exe101`. Source of truth is `src/app/globals.css`
(vars + `@theme inline` bridge to Tailwind 4 utility classes).

| Token                  | Value                          | Usage                    |
| ---------------------- | ------------------------------ | ------------------------ |
| `--color-brand`        | `#d2e5db`                      | Section page background  |
| `--color-brand-soft`   | `#f0f6f4`                      | App background           |
| `--color-brand-deep`   | `#2c6e49`                      | Primary CTA emphasis     |
| `--color-accent`       | `#b62034`                      | Emergency CTA / alerts   |
| `--color-ink`          | `#162130`                      | Body text                |
| `--color-info-soft`    | `#e9edf9`                      | Info badges              |
| `--color-border`       | `#c3c6d4`                      | Borders                  |
| `--shadow-header`      | `0 4px 4px rgba(0,0,0,0.25)`   | Sticky header            |
| `--shadow-pop`         | `0 8px 24px rgba(15,23,42,0.08)` | Hover lift             |
| Radius scale           | 6 / 8 / 12 / 16 / 24 / 9999    | rounded-{sm,md,lg,xl,2xl,full` |
| Font                   | Roboto → system stack          | via `--font-sans`        |

When the Figma file changes, regenerate by capturing the design system
section with Figma Desktop Bridge MCP and re-running the analysis.

## Production-readiness checklist

- ✅ TypeScript strict, no `any` leaks, `tsc --noEmit` clean
- ✅ ESLint clean (Next.js core-web-vitals + TS)
- ✅ `next build` produces 8 static routes
- ✅ All routes return HTTP 200 in dev
- ✅ Sticky header, mobile nav, FAQ accordion, booking picker, request form
- ✅ No secrets, no `process.env` leaks, no analytics
- ✅ Static (no SSR-only data fetching), zero hydration mismatches
- ✅ Mock layer isolated to `src/lib/*`, easy to swap

## What is intentionally out of scope (per AGENTS.md)

- Admin dashboard UI (backend-only operations)
- Live maps / tracking UI (backend-only)
- Payment UI (backend-only payOS/VietQR)
- Chatbot rewrite (mobile-only)
- Mobile-first responsive (desktop-first; mobile menu exists, full mobile
  frames will follow the `Mobile web` Figma section)
