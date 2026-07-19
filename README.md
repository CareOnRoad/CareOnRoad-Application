# CareOnRoad

A mobile-first prototype of a road-care companion app for Vietnamese motorbike riders — built with Next.js, React 19 and Tailwind v4.

The app ships in two perspectives:

- **Rider view** — vehicle management, emergency rescue, maintenance appointments and history.
- **Mechanic view** — job board, job details with repair status timeline, weekly schedule, profile and earnings dashboard.

A landing page lets you choose which perspective you want to demo. Your choice is saved to `localStorage` and can be flipped at any time from the in-app "Switch role" button or the Profile tab.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Tailwind v4, shadcn (`base-nova`) |
| Icons | `lucide-react` |
| State | React Context (per role) |
| Data | Mock data (no backend) |
| Analytics | `@vercel/analytics` |

## Project layout

```
app/                         # Next.js routes
  page.tsx                   # Role picker → CareApp / MechanicApp
components/
  role-picker.tsx            # Landing + role persistence
  care/                      # Rider view (existing)
  mechanic/                  # Mechanic view (new)
    cards/                   # Job, customer, earnings cards
    forms/                   # Job update form
    screens/                 # Dashboard, jobs, job-detail, schedule, profile
lib/
  types.ts                   # Rider domain types
  mock-data.ts               # Rider mock data
  mechanic-types.ts          # Mechanic domain types
  mechanic-mock-data.ts      # Mechanic mock data
  utils.ts                   # cn() className helper
```

## Local development

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (static, ~2s)
npm run start    # serve the production build
```

## Deploy to Vercel

The repo includes a `vercel.json` that pins the framework to Next.js and explicitly sets the build / install / output commands, so deployment does not depend on auto-detection.

```bash
# Option A — push to GitHub and import in the Vercel dashboard
git init && git add . && git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main

# Option B — CLI
npm i -g vercel
vercel login
vercel --prod
```

No environment variables are required.

## Tách thành app riêng

Because the rider and mechanic views are already isolated, splitting them later is mechanical:

1. Move `components/mechanic/` to a new project (e.g. `apps/mechanic-app/components/`).
2. Move `lib/mechanic-types.ts` and `lib/mechanic-mock-data.ts` with it.
3. Lift `components/care/ui.tsx` (the shared Card/Badge/Button/Field/TextInput/SectionHeader primitives) into a shared package, or duplicate.
4. Create a standalone `app/page.tsx` that renders `<MechanicApp />`.

## Status

Prototype / demo build. All data is in-memory and resets when the page reloads.
