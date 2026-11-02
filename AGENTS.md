# AGENTS.md

## Project Overview

- **Project:** CareOnRoad monorepo with mobile/web applications plus AI chatbot and backend APIs for auth,
  motorcycles, service requests, dispatch, assignments, mechanic operations,
  diagnoses, quotes, reminders, notifications, outbox delivery, and chatbot
  persistence.
- **Target users:** Vietnamese motorcycle riders using roadside assistance
  flows, mechanics handling assigned jobs, admins supervising operations, and
  demo users testing quick advisory chatbot diagnosis.
- **User skill level:** beginner to intermediate; keep explanations practical and concise.
- **Stack:** pnpm workspace, Next.js App Router, React 19, TypeScript, Zod, Vitest, local `sherpa-onnx-node`, Gemini API (Google AI Studio), Supabase hosted PostgreSQL.
- **Backend location:** `apps/api`; backend-relative paths in this file such as `app/api` and `src/features` are relative to `apps/api` unless stated otherwise.
- **Runtime:** independent mobile, web, and API applications; rate limits remain in memory, chatbot
  persistence defaults to memory and can use PostgreSQL when
  `CHATBOT_PERSISTENCE_MODE=postgres`, while `/api/v1` backend APIs use
  PostgreSQL repositories.

## Commands

- **Install:** `pnpm.cmd install`
- **API dev:** `pnpm.cmd run dev:api`
- **Build all apps:** `pnpm.cmd run build`
- **Build API:** `pnpm.cmd run build:api`
- **Typecheck API:** `pnpm.cmd run typecheck`
- **Lint API:** `pnpm.cmd run lint` or `pnpm.cmd run lint:api`
- **Lint web:** `pnpm.cmd run lint:web`
- **Typecheck web:** `pnpm.cmd --filter @careonroad/web run typecheck`
- **Audit admin web/API parity:** `node scripts/audit-admin-web-coverage.cjs`
- **Test API unit/static/route:** `pnpm.cmd test` or `pnpm.cmd run test:unit`
- **Test PostgreSQL integration:** `pnpm.cmd run test:db`
- **Test full API suite:** `pnpm.cmd run test:full`
- **ASR smoke:** `pnpm.cmd run asr:smoke`
- **Seed hosted/dev mock data:** `pnpm.cmd run seed:mock`
- **Verify hosted/dev mock data:** `pnpm.cmd run seed:mock:verify`
- Use `pnpm.cmd` on Windows because `pnpm.ps1` may be blocked by execution policy.

## Graphify Knowledge Graph

- The repo knowledge graph lives in `graphify-out/` (`graph.json`, `GRAPH_REPORT.md`,
  `graph.html`). Agents with the graphify skill should use it before broad code searches.
- **Answer codebase questions from the graph first:** `/graphify query "<question>"`
  (add `--budget 1500` to cap tokens, `--dfs` to trace one path). Also available:
  `/graphify path "A" "B"` and `/graphify explain "Node"`.
- **Keep it fresh:** run `/graphify . --update` at the start of a work session and after
  pulling or finishing a batch of code changes. It re-extracts only new/changed files.
- If `graphify-out/graph.json` is missing, build it once with `/graphify .`.
- The graph is a map, not the source of truth: always read the real files before
  editing code, and trust the code when the graph and code disagree.

## Current Workflows

### Chatbot API Workflow

1. A client creates or reuses a session through `POST /api/chatbot/sessions`.
2. Text path:
   - The client sends JSON to `POST /api/chatbot/sessions/[sessionId]/messages`.
   - Backend validates input, rate-limits, diagnoses, stores latest result, and returns a diagnosis card payload.
3. Voice path:
   - A client records or selects a WAV file locally.
   - The client sends WAV to `POST /api/chatbot/sessions/[sessionId]/transcriptions`.
   - Backend transcribes with local sherpa-onnx and returns `transcribed_text`.
   - The client can submit the transcribed text through the same messages API.
4. A client calls `GET /api/chatbot/sessions/[sessionId]/diagnosis` to restore the latest diagnosis.

### Backend API Workflows

1. Auth/profile:
   - Clients call `GET /api/v1/auth/me`, `POST /api/v1/auth/profile`, and
     `POST /api/v1/auth/devices` with Supabase JWTs.
   - Backend verifies JWT, bootstraps app users/roles, registers hashed devices,
     and writes sanitized audit/outbox where applicable.
2. Rider service request:
   - Rider manages motorcycles through `/api/v1/motorcycles`.
   - Rider creates service requests with `X-Idempotency-Key`, can add request
     media metadata, start dispatch, view assignments/quotes, and approve or
     reject the latest quote.
3. Dispatch and assignment:
   - Dispatch ranks eligible mechanics using location freshness, skills,
     distance, rating, and active-work constraints.
   - Mechanics list/accept/decline offers; accept is atomic and creates one
     active assignment.
   - Assigned mechanics/admins progress assignments through the allowed state
     machine.
4. Mechanic operations:
   - Mechanics read dashboard, job list, and performance through
     `/api/v1/mechanics/me/**`.
   - Assigned mechanics submit ETA/delay, field media metadata, and completion
     checklist revisions through `/api/v1/assignments/[assignmentId]/**`.
   - These metadata commands require `X-Idempotency-Key`, append sanitized
     audit/outbox, and do not bypass assignment state transitions.
5. Admin operations:
   - Admins use `/api/v1/admin/users/**`, `/api/v1/admin/mechanics/**`, and
     `/api/v1/admin/service-requests/**` for backend-only supervision.
   - Admin mutations require `X-Idempotency-Key` plus reason metadata and return
     redacted responses.
6. Reminders, notifications, and workers:
   - Riders manage date/time reminder rules.
   - Protected worker routes claim due reminders and outbox events using
     `X-Worker-Secret`.
   - Payment uses backend-only payOS/VietQR orders. Standard services require
     verified payment before work starts. Emergency rescue quotes labor before
     travel, fixes approved labor, and supports `labor_upfront` or `after_repair`;
     approved parts and full payment are required before closing the rescue job.
     New periodic maintenance approves fixed labor before travel, materials before
     work and additions separately, then collects after a quote-bound completion
     checklist. Full verified payment is required before closing maintenance.
     See `apps/api/RESCUE-WORKFLOW.md` and `apps/api/MAINTENANCE-WORKFLOW.md`.

## Backend MVP Status

- Patch 1 completed: Supabase JWT verification, app profile bootstrap, user-device registration, repository foundation, transactions/unit-of-work, idempotency, audit, and outbox base.
- Patch 2 completed: rider motorcycle ownership CRUD and mechanic dispatch profile/location/availability model.
- Patch 3 completed: service requests, request-code generation, request media metadata, state transitions, and service-request creation idempotency.
- Patch 4 completed through T059: dispatch candidates, deterministic ranking, offer lifecycle, atomic mechanic acceptance, assignment state, and concurrency protections.
- Patch 5 explicitly authorized and completed through T068: mechanic diagnosis and immutable quote versions. Quote approval moves assignment/request to `awaiting_payment` but does not create payment or start work.
- Feature 005 payment is implemented as backend-only payOS/VietQR payment orders,
  signed payOS webhooks, and payment reconciliation. Refunds, settlement,
  payout, invoices, card storage, and payment UI remain out of scope.
  Durable payment creation, provider-verified admin review resolution, and a
  worker CLI are implemented. Setup steps are in `apps/api/PAYMENT-SETUP.md`.
- Patch 7A completed through T087: date/time-based reminders, reminder occurrences, protected reminder worker route, and reminder-originated periodic-maintenance service-request integration. No odometer/kilometer reminder logic exists in this scope.
- Patch 7B notification persistence/outbox delivery is completed through T096.
- Patch 8 compatible chatbot persistence is completed through T105.
- Patch 9 hardening and operational validation is completed through T118.
- Admin operations feature 003 is implemented in the current workspace with
  migrations through `202606250016_admin_mechanic_management.sql`.
- Mechanic operations feature 004 is implemented through T070: read-only
  dashboard, job list, performance, assignment ETA/delay metadata, field media
  metadata references, and completion checklist revisions.
- Backend roadmap P0 Features 1-8 are implemented through notification provider
  delivery/inbox, verified media signed uploads, and immutable rider reviews
  with review-derived mechanic rating aggregates.
- P1 Feature 9 assignment recovery is implemented for pre-quote mechanic/admin
  recovery with idempotent outbox-driven re-dispatch.
- P1 Feature 10 exposes dependency-free liveness and bounded, redacted
  PostgreSQL/configuration readiness probes.
- P1 Feature 11 exposes admin-only redacted operational intervention queues and
  append-only sanitized worker-run monitoring.
- P1 Feature 12 provides opt-in PostgreSQL-backed cross-instance chatbot rate
  limits and provider circuit state with local fail-safe controls.
- P1 Feature 13 protects anonymous chatbot sessions with opaque hashed ownership
  credentials and supports authenticated one-way session claims.
- P1 Feature 14 adds a protected, lease-based retention worker with default
  dry-run, explicit per-class policy, and no destructive duration defaults.
- P2 Feature 15 adds provider-neutral advisory route ETA for active assignments,
  with Google Routes two-wheeler support, bounded cache/deduplication, and a
  controlled distance-only fallback. It does not change workflow state.
- P2 Feature 16 adds opt-in, polling-only latest-location tracking for assignment
  travel states with explicit short retention, replay/rate controls, RLS,
  lifecycle-triggered deletion, and protected bounded cleanup.
- Emergency rescue quote/payment workflow is implemented through migration 033,
  including rejected-mechanic recall, remaining-balance collection, and rescue
  inbox/outbox notifications. Mobile and web clients are unchanged.
- Periodic maintenance quote/payment workflow is implemented through migration 034:
  fixed pre-travel labor, approved materials and cumulative additions, completion
  checklist bound to approved work, and payment after service. Existing `standard`
  maintenance quotes retain prepayment behavior; mobile/web clients are unchanged.
- Migrations `202606250001_enable_extensions.sql` through
  `202606250034_maintenance_quote_payment_workflow.sql` must be applied and verified on
  `202606250033_user_profile_extended.sql` must be applied and verified on
  hosted/dev before enabling the corresponding APIs or seeding mock data.
- `202606250033_user_profile_extended.sql` adds `phone`, `address`, and
  `avatar_url` columns to `app_users` so the bootstrap and update profile
  routes can persist rider/mechanic profile edits end-to-end.
  `202606250035_maintenance_reservations_notification_leases.sql` must be applied and verified on
  hosted/dev before enabling the corresponding APIs or seeding mock data.
- Rider plans (`free`/`advance`/`vip`), maintenance reminder presets, and VIP
  motorcycle details are implemented through migration
  `202606250048_maintenance_presets_and_plans.sql`; 047 and 048 must be applied
  and verified on hosted/dev before deploy (readiness requires 048). The effective
  plan is computed at read time (no worker); an expired or downgraded plan never
  hides or deletes data. Expiry/downgrade only blocks applying presets, marking
  done and writing non-null VIP values; clearing VIP values with `null` and
  patch/snooze/disable of existing reminders stay allowed, and existing reminders
  keep firing. Admins grant plans manually; there is no plan payment. See
  `apps/api/VEHICLE-MAINTENANCE-PLANS-DESIGN.md`.
- Self-service plan purchases (rider buys `advance` 10.000đ / `vip` 50.000đ via
  payOS, 30-day period, no yearly tier) are implemented through migration
  `202606250049_plan_subscriptions.sql`; 049 must be applied and verified on
  hosted/dev before deploy (readiness requires 049). Purchases are strictly
  non-refundable and require an explicit acknowledgment before order creation.
  Downgrades are blocked with `409` (`details.reason = "downgrade_blocked"`);
  renewals and upgrades carry over remaining days
  (`new_expiry = max(current_expiry, now) + 30 days`). Admin grants are recorded
  in the same `plan_subscriptions` history with `source = "admin_grant"`.
  Provider order codes share `payment_order_code_seq` with repair payments, so
  the single payOS webhook routes both order types.
- Plan activation locks the `app_users` row (`findActorForUpdate`) before
  computing `new_expiry`, so two orders activating at the same time cannot lose
  carried-over days. Lazy provider sync re-reads the order from the database
  even when the provider event was already recorded, so a client polling after
  a webhook still sees `succeeded` instead of a stale `pending` snapshot.
  When the payOS webhook cannot reach the backend (LAN-only deployment), the
  plan still activates through two fallbacks: lazy provider sync on
  `GET /api/v1/subscription` and `GET /api/v1/subscription/orders/{id}`, and
  the `payments/reconcile` worker scanning stale pending subscription orders.
  Mobile passes deep-link `return_url`/`cancel_url` (`careonroad`/`exp`/`exps`
  schemes only) so payOS returns the rider into the app instead of a blank
  web page.
- Run `pnpm.cmd run preflight:schema` before release. This read-only gate checks
  source migration history and runtime schema objects; readiness also rejects
  missing schema. See `apps/api/SCHEMA-RELEASE-CHECKLIST.md` for test isolation and
  migration verification. Never apply development/test migrations to production
  as part of a local validation batch.

## Hosted Supabase Mock Data

- Use only a linked test/development Supabase project; never seed production.
- Inspect migration state with `npx.cmd supabase migration list`, preview with
  `npx.cmd supabase db push --dry-run`, then apply with
  `npx.cmd supabase db push`.
- `scripts/seed-mock-data.mjs` requires `DATABASE_URL`, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, and `SEED_USER_PASSWORD`.
- `pnpm.cmd run seed:mock` creates or updates the four Auth accounts
  `rider1@gmail.com`, `rider2@gmail.com`, `mechanic1@gmail.com`, and
  `mechanic2@gmail.com`, then upserts fixed-ID application fixtures.
- `pnpm.cmd run seed:mock:verify` is read-only and checks Auth account presence
  plus fixture counts; it does not require `SEED_USER_PASSWORD`.
- Re-running the seed resets the four Auth users to `SEED_USER_PASSWORD`.
- Never print, log, document, or commit database URLs, service-role keys,
  seeded passwords, or raw `.env.local` values.

## API Routes

- `POST /api/chatbot/sessions`
  - Creates an in-memory session.
  - Returns `{ session_id }`.
- `POST /api/chatbot/sessions/[sessionId]/messages`
  - Accepts `application/json` text messages.
  - Also supports multipart voice messages for route coverage, though the current UI uses the dedicated transcription route first.
  - Applies route-level rate limiting (hourly session/IP plus daily IP) before diagnosis, ASR, or Gemini.
  - Rejects text over 500 characters (400) and off-topic text (422 `OFF_TOPIC`) before calling Gemini.
  - Returns `DiagnosisResult` directly on success.
- `POST /api/chatbot/sessions/[sessionId]/transcriptions`
  - Accepts multipart WAV upload as `audio_file`.
  - Applies voice transcription rate limiting.
  - Runs local ASR only; does not call Gemini.
  - Returns `{ session_id, transcribed_text }`.
- `GET /api/chatbot/sessions/[sessionId]/diagnosis`
  - Returns `{ session_id, diagnosis }` for the latest stored diagnosis.
  - Returns 404 when the session or diagnosis does not exist.
- `POST /api/chatbot/sessions/[sessionId]/claim`
  - Binds an anonymously credential-owned chatbot session to the authenticated
    active app user; claim requires both credentials and is one-way.
- `GET /api/v1/auth/me`, `POST /api/v1/auth/profile`, `PATCH /api/v1/auth/profile`, `POST /api/v1/auth/devices`
  - Supabase JWT protected identity/profile/device endpoints.
  - `POST /auth/profile` bootstraps a new actor with optional `display_name`,
    `phone`, `address`, `avatar_url`.
  - `PATCH /auth/profile` updates editable profile fields on the authenticated
    actor; `phone` is also masked and stored in `phone_masked` for admin search.
  - `GET /auth/me` returns `id`, `display_name`, optional `phone`, `address`,
    `avatar_url`, `roles`, `status`, `plan_code` (effective plan), and
    `plan_expires_at` (stored value, only when set).
- `GET/POST /api/v1/motorcycles`
  - Rider-owned motorcycle list/create. Motorcycle mutations do not require `X-Idempotency-Key`.
- `GET/PATCH/DELETE /api/v1/motorcycles/[motorcycleId]`
  - Rider-owned motorcycle read/update/archive. The basic PATCH never touches VIP details.
- `PATCH /api/v1/motorcycles/[motorcycleId]/details`
  - Rider-owned partial update of VIP details (color, frame/engine number, purchase,
    insurance, warranty, preferred service center): omitted keeps, `null` clears
    (always allowed), a value requires the VIP plan (403 otherwise). Values never
    appear in audit/outbox, only column names. Like the basic PATCH, the response
    omits `last_maintenance_at`/`next_maintenance_at`; clients should not replace
    cached maintenance dates from it.
- `POST /api/v1/motorcycles/[motorcycleId]/reminder-presets`
  - Rider enables 1-5 catalog items for a motorcycle with `usage_level` and optional
    `last_done_on`; needs the highest plan among the items. Existing items are kept
    (`created: false`); new reminders fire at 09:00 Vietnam time.
- `GET/PATCH /api/v1/mechanics/me/profile`
  - Mechanic profile settings with backend-owned profile status and read-only rating aggregates.
- `PUT /api/v1/mechanics/me/availability`
  - Updates merged MVP availability through `is_available`.
- `PUT /api/v1/mechanics/me/location`
  - Stores latest mechanic location directly on `mechanic_profiles` with backend-controlled `location_updated_at`.
- `GET /api/v1/mechanics/me/dashboard`
  - Mechanic-owned read-only operational summary with availability, location
    freshness, open offers, active assignment, short-window counts, rating, and
    next action codes.
- `GET /api/v1/mechanics/me/jobs`
  - Mechanic-owned assignment/job list with `status`, `active_only`,
    `date_from`, `date_to`, `limit`, and `cursor` filters.
- `GET /api/v1/mechanics/me/performance`
  - Mechanic-owned derived performance metrics with no earnings, payout,
    settlement, or payment fields.
- `GET/POST /api/v1/service-requests`
  - Rider-owned service-request list/create. Creation requires `X-Idempotency-Key`.
- `GET /api/v1/service-requests/[requestId]`
  - Rider-owned service-request read.
- `POST /api/v1/service-requests/[requestId]/cancel`
  - Transactional cancellation with row lock and state re-check.
- `POST /api/v1/service-requests/[requestId]/media`
  - Adds request media metadata only; raw media is not stored in audit/outbox.
- `POST /api/v1/service-requests/[requestId]/dispatch`
  - Rider-owned dispatch candidate generation for eligible submitted requests.
- `GET /api/v1/dispatch/offers`, `POST /api/v1/dispatch/offers/[offerId]/accept`, `POST /api/v1/dispatch/offers/[offerId]/decline`
  - Mechanic offer visibility and atomic accept/decline workflow.
- `GET /api/v1/assignments`, `POST /api/v1/assignments/[assignmentId]/status`
  - Assigned-mechanic/admin assignment listing and authorized progress transitions.
- `POST /api/v1/assignments/[assignmentId]/eta`
  - Assigned mechanic submits ETA or bounded delay metadata for an active
    assignment. Requires `X-Idempotency-Key`; stores metadata only and appends
    sanitized audit/outbox.
- `POST /api/v1/assignments/[assignmentId]/media`
  - Assigned mechanic submits field media metadata references for an active
    assignment. Requires `X-Idempotency-Key`; rejects raw media/base64/provider
    payloads and appends sanitized audit/outbox.
- `GET/POST /api/v1/assignments/[assignmentId]/completion-checklist`
  - Assigned mechanic submits append-only work-summary and safety-checklist
    revisions for an active assignment. Requires `X-Idempotency-Key`; does not
    complete or otherwise bypass the assignment state machine. GET exposes the
    latest revision to the owning rider, assigned mechanic or admin. New maintenance
    requires a checklist bound to its latest approved quote before collecting.
- `POST /api/v1/assignments/[assignmentId]/diagnoses`
  - Assigned-mechanic/admin mechanic diagnosis creation and revision.
- `GET/POST /api/v1/service-requests/[requestId]/quotes`, `POST /api/v1/quotes/[quoteId]/approve`, `POST /api/v1/quotes/[quoteId]/reject`
  - Immutable quote versions and latest-pending rider quote decisions.
- `GET/POST /api/v1/reminders`, `PATCH /api/v1/reminders/[reminderId]`, `POST /api/v1/reminders/[reminderId]/snooze`
  - Rider-owned date/time-based reminder rule list/create/update/snooze/disable.
- `GET /api/v1/reminder-presets`
  - Backend-owned preset catalog (`engine_oil`, `gear_oil`, `brake_fluid`, `coolant`
    need `advance`; `insurance_renewal` needs `vip`) with per-`usage_level` intervals.
- `POST /api/v1/reminders/[reminderId]/done`
  - Rider marks a preset reminder done (`done_on`) and the next due date is recomputed.
    Needs the preset's plan; another rider's reminder or motorcycle returns 403
    (existing ownership behavior), not 404.
- `POST /api/v1/payments/orders`, `GET /api/v1/payments/orders/[paymentOrderId]`, `POST /api/v1/payments/orders/[paymentOrderId]/cancel`
  - Rider-owned payOS/VietQR payment order creation/read/cancel for approved
    quotes awaiting payment. Creation requires `X-Idempotency-Key`.
- `POST /api/v1/payments/webhooks/payos`
  - Signed payOS webhook route; verified matching payment success marks payment
    succeeded but does not automatically start assignment work. The same route
    resolves plan-subscription orders before repair payment orders.
- `GET /api/v1/plans`
  - Authenticated plan catalog (`free`/`advance`/`vip`) with prices, 30-day
    period, feature lists, and the non-refundable notice.
- `GET /api/v1/subscription`
  - Rider-owned current plan, expiry, active subscription, and purchase history.
  - Pending orders are lazily synced with payOS on read (throttled 30s per order
    code) so a plan still activates when the payOS webhook cannot reach the
    backend (for example a LAN-only deployment).
- `POST /api/v1/subscription/orders`
  - Rider-owned plan purchase (payOS). Requires `X-Idempotency-Key` and
    `non_refundable_acknowledged: true`; rejects downgrades with 409
    (`details.reason = "downgrade_blocked"`).
  - Optional `return_url`/`cancel_url` are client deep links, restricted to the
    `careonroad`/`exp`/`exps` schemes, so payOS returns the rider straight into
    the app instead of an empty web page. The backend falls back to
    `PAYOS_SUBSCRIPTION_RETURN_URL`/`PAYOS_SUBSCRIPTION_CANCEL_URL`, and retries
    once with those URLs when the provider rejects the deep-link scheme.
- `GET /api/v1/subscription/orders/[orderId]`, `POST /api/v1/subscription/orders/[orderId]/cancel`
  - Owner-only subscription order polling and cancellation. Polling also syncs
    the real payOS status (lazy provider sync). A late webhook for an order the
    rider already canceled is ignored and never activates the plan.
- `POST /api/v1/internal/workers/payments/reconcile`
  - Protected worker route requiring worker secret authority; reconciles stale
    pending payOS payment orders and stale pending plan-subscription orders
    (older than 2 minutes).
- `/api/v1/admin/users/**`
  - Admin-only backend user list/detail/status, role grant/revoke, device list,
    device revoke, and activity read models. Mutations require
    `X-Idempotency-Key` and reason metadata.
- `POST /api/v1/admin/users/[userId]/plan`
  - Admin grants or extends a rider plan (`plan_code` is `free|advance|vip`; `duration`
    must be `month` (30 days) for paid plans and is forbidden for `free`,
    which revokes the plan; plus `reason`); the same active plan extends from its
    current expiry. Returns 409 if the target is not an active rider. Requires
    `X-Idempotency-Key`; no payment involved. Paid grants are also recorded in
    `plan_subscriptions` with `source = "admin_grant"`.
- `/api/v1/admin/mechanics/**`
  - Admin-only backend mechanic list/detail, approve/reject/suspend/ban/reactivate,
    skills, service radius, force-unavailable, work-history, and performance.
    Mutations require `X-Idempotency-Key` and reason metadata.
- `/api/v1/admin/service-requests/**`
  - Admin-only backend service-request list/detail, timeline, media, assignment,
    quotes, cancel, manual-escalate, and internal-note operations. Mutations
    require `X-Idempotency-Key` and reason metadata.
- `POST /api/v1/internal/workers/reminders/run`
  - Protected worker route requiring worker secret authority; normal rider/mechanic roles cannot run it.
- `POST /api/v1/internal/workers/outbox/run`
  - Protected worker route for leased outbox delivery, retry, and dead-letter
    processing.
- `GET /api/v1/notifications`, `GET /api/v1/notifications/unread-count`,
  `POST /api/v1/notifications/[notificationId]/read`, `POST /api/v1/notifications/read-all`
  - Owner-only notification inbox, opaque cursor pagination, unread count, and
    idempotent read state independent from provider delivery state.
- `POST /api/v1/media/upload-intents`, `POST /api/v1/media/upload-intents/[intentId]/finalize`
  - Rider/request or mechanic/active-assignment signed image upload intents with
    server-generated paths and streamed MIME/size/SHA-256 verification.
- `POST /api/v1/internal/workers/media-uploads/cleanup`
  - Worker-secret-protected cleanup for expired pending upload orphans.
- `POST /api/v1/assignments/[assignmentId]/review`
  - Owning rider creates one immutable review after assignment/request completion.
- `POST /api/v1/assignments/[assignmentId]/recover`
  - Assigned mechanic/admin recovers eligible pre-quote work with bounded reason
    codes, idempotency, preserved history, and durable re-dispatch handoff.
- `POST /api/v1/internal/workers/reviews/rebuild-ratings`
  - Worker-secret-protected rebuild of mechanic average/count from review rows.
- `POST /api/v1/internal/workers/retention/run`
  - Worker-secret-protected bounded retention dry-run/execution for explicitly
    configured operational data classes; deletion is disabled by default.
- `GET /api/v1/assignments/[assignmentId]/route-eta`
  - Owning-rider, assigned-mechanic, or admin advisory route estimate for active
    assignments; requires fresh mechanic and stored service coordinates.
- `PUT/GET /api/v1/assignments/[assignmentId]/live-location`
  - Assigned-mechanic latest-location ingest and owner/mechanic/admin polling for
    `accepted`/`en_route` assignments; disabled until explicit retention config.
- `POST /api/v1/internal/workers/live-locations/cleanup`
  - Worker-secret-protected, count-only bounded cleanup of expired latest points.
- `GET /api/v1/internal/health/live`, `GET /api/v1/internal/health/ready`
  - Unauthenticated deployment probes with fixed redacted output; readiness
    checks PostgreSQL and enabled/partial backend configuration only.
- `GET /api/v1/admin/operations/outbox-dead-letters`,
  `GET /api/v1/admin/operations/payments-needs-review`,
  `GET /api/v1/admin/operations/dispatch-stuck`, and
  `GET /api/v1/admin/operations/worker-runs`
  - Admin-only cursor-paginated, redacted operational monitoring queues; they
    are read-only and never expose event payloads or raw worker errors.

## Admin Web Console (`apps/web`)

- **Scope:** `apps/web/src/app/admin/**` is the operator console. It covers all
  96 backend admin routes under `apps/api/app/api/v1/admin/**`.
- **13 sidebar tabs** live in `apps/web/src/lib/admin/nav.ts` — ONE source of
  truth. `AdminNav` renders it, `findAdminNavItem` resolves the active tab.
  A page never defines its own menu.
  - Tổng quan: `/admin/dashboard`
  - Vận hành: `/admin/service-requests`, `/admin/assignments`, `/admin/quotes`
  - Tài khoản: `/admin/mechanics`, `/admin/users`
  - Hệ thống: `/admin/reminders`, `/admin/notifications`, `/admin/outbox`,
    `/admin/payments`, `/admin/audit`, `/admin/configuration`,
    `/admin/operations`
- **Route parity is verified by a script:** `node scripts/audit-admin-web-coverage.cjs`
  fails if a backend admin route is unreachable from the web API layer, if a
  read/mutation wrapper has no consumer, or if a Server Action is never
  rendered by a component. Run it after touching the admin web code.
- **API layer (server-only):**
  - `src/lib/api/admin.ts` — 48 read wrappers (GET). One function per screen;
    a typo becomes a type error instead of a runtime 404.
  - `src/lib/api/admin-commands.ts` — 36 mutation wrappers (POST/PUT/PATCH).
  - `src/lib/api/admin-command-runner.ts` — the shared mutation runner. It
    sends `X-Idempotency-Key`, validates the response against the shared
    contract, and maps backend errors to Vietnamese messages.
  - `src/lib/api/server-client.ts` — the HTTP client, the `ApiClientError`
    hierarchy, and `classifyApiError`.
- **Session:** `src/lib/auth/require-admin.ts` resolves the Supabase session
  and asks `GET /api/v1/auth/me` for the actor. The token NEVER reaches a
  Client Component. The `(protected)` layout guard is UX only — the backend
  re-checks authorization on every admin route.
- **Mutations:** every write goes through a Server Action in a local
  `actions.ts` and renders through the shared `CommandForm`
  (`src/components/admin/command-form.tsx`). The form mints ONE idempotency
  key per mount, so a retry after a network failure replays the same command
  on the backend instead of creating a duplicate. The backend's
  `details.reason` code is shown inline.
- **Backend-driven availability:** write buttons are enabled from the
  backend's own `next_action_codes`, never from frontend re-derivation of the
  state machine.
- **Immutable data is read-only:** audit entries, diagnosis revisions,
  configuration versions and quote history render as lists with no edit or
  delete affordance, because the backend rejects such writes.
- **Failed ≠ empty:** every read goes through `settle()` (or `settleOrNotFound()`
  on detail pages) so a failed request renders an explicit error panel instead
  of looking like an empty list. A 404 on a detail page escalates to the
  segment's `not-found.tsx`.
- **Segment boundaries:** `(protected)/error.tsx` (one boundary for all 13
  tabs, keeps the sidebar visible), `(protected)/loading.tsx` (shapeless
  skeleton — never a fake number), `(protected)/not-found.tsx`.
- **No invented numbers:** the dashboard reads `GET /api/v1/admin/dashboard/*`
  (bucket histograms) and the operational queues. There is no online-mechanic
  aggregate, no SLA metric and no fleet map in the backend, so none is shown.

## Core Services And Functions

### Client-facing helpers

- The API workspace intentionally contains no root page; mobile and web clients
  consume its HTTP routes independently.
- `apps/mobile/src/lib/qr-payload.ts` (mobile-only)
  - Pure helpers for payOS VietQR payloads: `isImageUrl`, `isEmvcoPayload`,
  `utf8Bytes`, `buildQrMatrix`, `buildQrPath`, `canRenderQrCode`.
  - payOS returns `qr_code` as a **raw EMVCo text payload** (not an image URL),
  so mobile must encode it client-side. `apps/mobile/src/components/ui/qr-code.tsx`
  renders it with `toqr` + `react-native-svg` (one SVG path, 4-module quiet zone).
  - `toqr` is a declared mobile dependency; do not rely on the global
  `TextEncoder` (not guaranteed on Hermes) — use `utf8Bytes`.
- `src/features/chatbot/chat-page-draft.ts`
  - Text draft helpers and recording status labels.
- `src/features/chatbot/chat-page-view-model.ts`
  - Converts `DiagnosisResult` into UI-safe labels, VND ranges, risk labels, continuation text, and disclaimer.

### API Adapters

- `src/features/chatbot/api-routes.ts`
  - Route-handler orchestration layer.
  - Owns request parsing, route-level rate limiting, response shaping, and API error mapping.
  - Keeps Next route files thin.
- `src/features/motorcycles/motorcycle.route-handlers.ts`
  - Thin route-handler orchestration for motorcycle and mechanic profile APIs.
- `src/features/service-requests/service-request.route-handlers.ts`
  - Thin route-handler orchestration for service-request APIs and required creation idempotency header handling.
- `src/features/mechanic-operations/mechanic-operations.route-handlers.ts`
  - Thin route-handler orchestration for mechanic dashboard, jobs, performance,
    assignment ETA metadata, field media metadata, and completion checklist
    APIs.

### Backend MVP Services

- `src/features/auth/*`
  - Supabase JWT verification, app actor/profile bootstrap, role checks, and device registration.
- `src/features/motorcycles/motorcycle.service.ts`
  - Rider-owned motorcycle create/list/read/update/archive with atomic sanitized audit/outbox writes.
- `src/features/motorcycles/mechanic-profile.service.ts`
  - Mechanic profile, broad service skills, merged availability, direct latest-location storage, and 300-second dispatch freshness helper.
- `src/features/service-requests/service-request.service.ts`
  - Rider-owned service-request create/list/read/cancel/media metadata workflows with request history, audit/outbox, and idempotency.
- `src/features/service-requests/request-code.service.ts`
  - `COR-{SERVICE_PREFIX}-{YYYYMMDD}-{DAILY_SEQUENCE}` allocation using `Asia/Ho_Chi_Minh` local date.
- `src/features/service-requests/service-request-state.ts`
  - Explicit service-request state transition rules.
- `src/features/dispatch/*`
  - Deterministic dispatch candidate generation, offer lifecycle, ranking, and active-job conflict handling.
- `src/features/assignments/*`
  - Atomic mechanic acceptance and assignment progress workflow with synchronized request state.
- `src/features/route-eta/*`
  - Provider-neutral Google Routes two-wheeler ETA adapter, bounded TTL cache,
    in-flight deduplication, active-assignment authorization, and controlled
    straight-line distance fallback without workflow mutation.
- `src/features/live-tracking/*`
  - Opt-in latest-only location ingest/polling, strict ownership/timestamp/
    accuracy/rate rules, and privacy-safe expired-point cleanup.
- `src/features/admin/*`
  - Backend-only admin operations for user management, mechanic management,
    service-request supervision, redaction, authorization, and reason/idempotency
    handling. No admin frontend, payment, settlement, Maps, or inventory scope.
- `src/features/mechanic-operations/*`
  - Mechanic-owned runtime operations: dashboard, job list, performance, and
    assignment metadata commands. Dashboard/performance are derived read models;
    ETA, media, and completion checklist records are metadata-only and do not
    bypass the assignment state machine.
- `src/features/mechanic-diagnosis/*`
  - Text-first mechanic diagnosis with assignment ownership/state checks and sanitized audit/outbox writes.
- `src/features/quotes/*`
  - Immutable quote versions, server-side totals, latest-pending rider decisions, and no-payment-on-approval behavior.
- `src/features/payments/*`
  - Backend-only payOS/VietQR payment orders, signed webhook verification,
    stale pending reconciliation, payment audit/outbox, and assignment-start
    payment prerequisite.
- `src/features/reminders/*`
  - Date/time-based reminder rule workflows, snooze/disable/recurrence, and reminder-originated periodic-maintenance request integration.
  - `reminder-presets.ts` holds the preset catalog constant and the next-due formula.
- `src/features/plans/plan.ts`
  - `PlanCode`, plan rank, `effectivePlan`, and `hasPlan`; services throw their own
    403 `FORBIDDEN` with `details.reason: "plan_required"` and `details.required_plan`.
- `src/features/notifications/*`, `src/features/outbox/*`
  - Persistent notification inbox, FCM HTTP v1 delivery receipts, deduplicated
    outbox consumption, and protected worker-route orchestration.
- `src/features/media-uploads/*`
  - Supabase Storage signed upload adapter, actor/resource-bound intents,
    byte-level finalize verification, and orphan cleanup.
- `src/features/reviews/*`
  - Immutable completed-assignment rider reviews and transactionally rebuilt
    mechanic rating aggregates.
- `src/server/workers/reminder.worker.ts`
  - Leased due-rule claim and deduplicated reminder occurrence/job creation.
- `src/server/workers/outbox.worker.ts`
  - Leased outbox event processing with retry, lease recovery, and dead-letter
    behavior.

### Diagnosis Pipeline

- `src/features/chatbot/diagnosis.service.ts`
  - Main application service.
  - Normalizes input, runs safety gate, retrieves local knowledge, builds prompt, calls Gemini, validates output, post-validates, stores diagnosis, and logs safely.
- `src/features/chatbot/normalize-vi.ts`
  - Vietnamese accent-insensitive normalization for matching.
- `src/features/chatbot/safety-gate.ts`
  - Dangerous symptom detection. Dangerous matches override model output.
- `src/features/chatbot/knowledge-base.ts`
  - Local motorcycle troubleshooting knowledge.
  - Current coverage includes battery/charging, spark plug, air filter, fuel system, brake noise, tire issues, running noise, CVT/drive belt, engine oil/overheat, rain/water ingress, smoke, steering instability, and fuel leaks.
- `src/features/chatbot/retrieval.ts`
  - Keyword-based retrieval from local knowledge base.
- `src/features/chatbot/prompts.ts`
  - Compact JSON-only provider prompt with few-shot examples.
  - Includes guidance for vague running-noise symptoms to use `UNKNOWN` instead of guessing battery or spark plug.
- `src/features/chatbot/topic-filter.ts`
  - Accent-aware vehicle keyword filter; off-topic text never reaches Gemini.
- `src/features/chatbot/repair-prices.ts`
  - Sourced VND repair price ranges per component; the only source of chatbot prices.
  - Reads environment variables, sends low-token JSON-schema chat completion requests, classifies provider errors, logs sanitized metadata, repairs lightly truncated JSON, and supports optional fallback model.
- `src/features/chatbot/gemini.client.ts`
  - Backend-only Gemini client (`responseJsonSchema`); the only AI provider.
- `src/features/chatbot/post-validation.ts`
  - Repairs provider JSON into `DiagnosisResult`.
  - Reconciles model output with safety and retrieved knowledge.
  - Rejects or replaces low-information text such as `true`, `false`, `UNKNOWN`, `chua xac dinh`, and `khong ro`.
  - Caps arrays and confidence.
- `src/features/chatbot/fallback-diagnosis.ts`
  - Rule-based local fallback when Gemini is missing, slow, invalid, unsafe, or unavailable.
- `src/features/chatbot/session.store.ts`
  - In-memory implementation of the chatbot session repository contract.
- `src/server/repositories/chatbot-session-repository.factory.ts`
  - Selects memory or audited PostgreSQL chatbot persistence from
    `CHATBOT_PERSISTENCE_MODE`.

### ASR

- `src/features/asr/asr.service.ts`
  - ASR service wrapper.
- `src/features/asr/sherpa-onnx.client.ts`
  - Isolated `sherpa-onnx-node` runtime adapter and WAV parser.
  - Model config comes from env or defaults.
- `src/features/asr/asr.types.ts`
  - Controlled ASR result and error types.

### Shared Utilities

- `src/lib/api-error.ts`
  - Standard API error response helper.
- `src/lib/rate-limit.ts`
  - Route-friendly rate-limit contract, in-memory limiter, and response headers.
- `src/server/runtime-controls/*`
  - Default in-memory and opt-in PostgreSQL shared rate-limit/provider-circuit
    adapters with hashed identifiers, TTL, timeout, and local fail-safe behavior.
- `src/lib/server-logger.ts`
  - Structured logger with sanitization for API keys, auth, raw audio, full text, phone, email, token, and payment-like data.
- `src/lib/request-ip.ts`
  - Request IP extraction.
- `src/lib/hash.ts`
  - Safe text hashing for logs.
- `src/lib/idempotency.ts`
  - Stable request hashing and reusable create/replay/conflict idempotency decisions.

### Persistence

- `src/server/repositories/contracts/*`
  - Repository interfaces for users, idempotency, audit, outbox, notifications,
    motorcycles, mechanics, service requests, request media, request codes,
    dispatch, assignments, admin query/internal notes, mechanic operations,
    mechanic diagnoses, quotes, reminders, media upload intents, reviews,
    live tracking, and chatbot sessions.
- `src/server/repositories/postgres/*`
  - PostgreSQL adapters used by `/api/v1` backend MVP routes.
- `src/server/repositories/testing/*`
  - In-memory adapters used by focused service and route tests.
- `supabase/migrations/202606250001_*` through
  `202606250032_live_location_tracking.sql`
  - Authoritative versioned backend schema through Patch 9, admin/mechanic/payment
    features, backend roadmap P0 Features 1-8, and P1 assignment recovery.

## Environment Variables

- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `AI_TOTAL_TIMEOUT_MS`
- `GEMINI_TIMEOUT_MS`
- `CHATBOT_IP_DAILY_LIMIT` (default 10 diagnoses per client IP per 24 hours; hourly IP limit is also 10)
- `DATABASE_URL`
- `TEST_DATABASE_URL`
- `TEST_DATABASE_CONFIRMED` (only for a separate hosted test project)
- `CHATBOT_PERSISTENCE_MODE`
- `HEALTH_READINESS_TIMEOUT_MS`
- `SUPABASE_URL`
- `SUPABASE_JWT_ISSUER`
- `SUPABASE_JWT_AUDIENCE`
- `SUPABASE_JWKS_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MEDIA_STORAGE_BUCKET`
- `MEDIA_STORAGE_TIMEOUT_MS`
- `SEED_USER_PASSWORD` (local mock seeding only)
- `INTERNAL_WORKER_SECRET`
- `WORKER_API_BASE_URL` (worker CLI API origin)
- `DEMO_FORCE_MECHANIC_ID` (demo only — must be unset in production; the backend
 throws on startup if this is set with `NODE_ENV=production`. When set, all
 dispatch rounds route their offer to the configured mechanic regardless of
 distance, availability, location freshness, or active workload. Each forced
 round is tagged with `demo_force: true` in `outbox_events` and `audit_log`.)
- `PUSH_TOKEN_ENCRYPTION_KEY`
- `FCM_PROJECT_ID`
- `FCM_CLIENT_EMAIL`
- `FCM_PRIVATE_KEY`
- `FCM_TIMEOUT_MS`
- `ROUTE_ETA_PROVIDER`
- `GOOGLE_ROUTES_API_KEY`
- `GOOGLE_ROUTES_BASE_URL`
- `ROUTE_ETA_TIMEOUT_MS`
- `ROUTE_ETA_CACHE_TTL_SECONDS`
- `ROUTE_ETA_LOCATION_MAX_AGE_SECONDS`
- `LIVE_TRACKING_ENABLED`
- `LIVE_TRACKING_RETENTION_MINUTES`
- `LIVE_TRACKING_MAX_LOCATION_AGE_SECONDS`
- `LIVE_TRACKING_MAX_FUTURE_SKEW_SECONDS`
- `LIVE_TRACKING_MIN_UPDATE_INTERVAL_SECONDS`
- `LIVE_TRACKING_MAX_ACCURACY_METERS`
- `PAYMENTS_ENABLED`
- `PAYMENT_PROVIDER`
- `PAYOS_CLIENT_ID`
- `PAYOS_API_KEY`
- `PAYOS_CHECKSUM_KEY`
- `PAYOS_BASE_URL`
- `PAYOS_RETURN_URL`
- `PAYOS_CANCEL_URL`
- `PAYOS_SUBSCRIPTION_RETURN_URL` (optional; falls back to `PAYOS_RETURN_URL`)
- `PAYOS_SUBSCRIPTION_CANCEL_URL` (optional; falls back to `PAYOS_CANCEL_URL`)
- ASR model variables are handled in `src/features/asr/sherpa-onnx.client.ts`; keep local model files under `models/`.

Never expose `GEMINI_API_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `SEED_USER_PASSWORD`, database URLs, or raw
`.env.local` values in logs, frontend code, test output, or documentation.

## Gemini Notes

- OpenRouter was removed; Gemini via a Google AI Studio key is the only provider.
- Use a Flash-Lite model (`gemini-3.5-flash-lite`): thinking models use the output token budget and return empty or truncated JSON.
- Gemini 2.5 models are only available to projects that used them before.
- Free-tier quotas are per Google Cloud project, not per key; check them in AI Studio.
- The model returns a compact JSON (`issue`, `parts`, `risk`, `ride`, `answer`, `actions`, `questions`); prices and provenance are added by the backend.
- The current design treats AI as primary when usable, then applies backend guardrails and local fallback for safety and UX.
- Do not remove local fallback. It is required for demo reliability.

## Testing Expectations

- Run `pnpm.cmd test` after API code changes; it is unit/static/route-only by default.
- Run `pnpm.cmd run build` after route, frontend, schema, or TypeScript changes.
- Prefer also running `pnpm.cmd run typecheck` and `pnpm.cmd run lint` for larger changes.
- PostgreSQL integration tests require `TEST_DATABASE_URL` and only run through
  `pnpm.cmd run test:db`, `pnpm.cmd run test:full`, or an explicit
  `RUN_DB_TESTS=true` Vitest invocation. Normal `pnpm.cmd test` skips them even
  when `.env.local` contains `TEST_DATABASE_URL`.
- When `TEST_DATABASE_URL` is set to a hosted Supabase/PostgreSQL database, the
  DB suite can take many minutes. Long-running integration tests may need
  explicit per-test timeouts; for example assignment acceptance rollback
  coverage currently allows 90 seconds for the slowest hosted-DB case.
- Tests must not call real Gemini.
- Normal tests must not run real ONNX ASR.
- Add focused tests when adding knowledge-base entries, prompt behavior, post-validation rules, route behavior, or UI view-model behavior.

## Do

- Read existing code before modifying anything.
- Match existing patterns, naming, and style.
- Keep route handlers thin; put behavior in `src/features/*`.
- Keep outputs short, Vietnamese-focused, advisory, and schema-valid.
- Keep price ranges clearly estimated only.
- Handle errors gracefully with controlled API errors.
- Keep logs sanitized and metadata-only.
- Preserve dangerous symptom overrides.
- Preserve in-memory demo scope unless the user explicitly asks for persistence.
- Keep changes small and scoped to the request.

## Don't

- Do not install new dependencies without asking.
- Do not delete or overwrite files without confirming.
- Do not hardcode secrets, API keys, or credentials.
- Do not run the mock-data seed against production.
- Do not put Gemini calls or keys in frontend code.
- Do not send raw audio to Gemini.
- Do not add motorcycle selector, brand dropdown, model dropdown, booking,
  payment, settlement, inventory, **rider GPS autofill UI beyond what's already
  wired in `app/rider/(tabs)/rescue.tsx` (1-shot capture + refresh button)**,
  Maps/live tracking UI, chatbot rewrites, ASR
  rewrites, or frontend UI unless explicitly requested.
- Do not implement refunds, settlement, payout, invoice, card storage,
  frontend payment UI, frontend mechanic UI, completion gating, raw
  media storage, or new workflow scope unless explicitly requested.
- Do not show raw model markdown or long explanations in the UI.
- Do not remove fallback to make a model look reliable.
- Do not push, deploy, commit or force-push without permission.

## When Stuck

- If the task is large, break it into steps and confirm the plan.
- If a model/provider issue repeats, inspect logs by `error_code`, `api_http_status`, `invalid_response_reason`, and `provider_model`.
- If the same fix fails twice, stop and explain the current blocker and next options.

## Git

- Small, focused commits with descriptive messages when commits are requested.
- Never force push.
- Do not revert user changes unless explicitly asked.

## Response Style

- Be clear and concise.
- Explain technical causes in plain language.
- Prefer concrete file references and command results.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/021-live-location-tracking/plan.md
<!-- SPECKIT END -->
