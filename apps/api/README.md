# CareOnRoad AI Chatbot and Backend MVP

Payment setup and remaining external steps: [PAYMENT-SETUP.md](PAYMENT-SETUP.md).

Run the workspace commands below from the monorepo root
`D:\fpt\subject\EXE101\CareOnRoad-Application`.

CareOnRoad is a Vietnamese motorcycle roadside-assistance demo. It combines a
backend-validated AI chatbot with Supabase-authenticated rider, motorcycle,
service-request, dispatch, assignment, quote, reminder, notification, and
chatbot-persistence foundations, plus backend-only admin operations and mechanic
operations for dashboard, jobs, performance, ETA/delay metadata, field media
metadata, and completion checklist metadata.

## Scope

- Vietnamese text and voice symptom input.
- AI chatbot diagnosis is advisory only and never replaces a mechanic quote.
- Backend-owned validation, rate limiting, logging, and fallback.
- Supabase Auth and hosted PostgreSQL repositories for `/api/v1` backend APIs.
- Admin operations APIs are backend-only for user, mechanic, and
  service-request supervision; no admin frontend is included.
- Mechanic operations APIs are backend-only; no mechanic frontend/mobile UI,
  Maps/live tracking UI, inventory, chatbot rewrite, or ASR
  rewrite is included.
- Payment APIs are backend-only through payOS/VietQR. No payment frontend,
  refunds, settlement, payout, invoice, or card-storage scope is included.
- Optional PostgreSQL chatbot persistence through
  `CHATBOT_PERSISTENCE_MODE=postgres`; the default remains `memory`.
- Standard quote approval moves workflows to `awaiting_payment`; verified payOS
  payment success is required before work starts for those services.
- Emergency rescue uses a pre-travel labor agreement with either upfront labor
  payment or labor plus parts payment after repair. Approved labor is fixed;
  parts require a separate approval. See [the rescue API workflow](RESCUE-WORKFLOW.md).
- New periodic maintenance agrees labor before travel, approves materials before
  work and additions separately, then collects payment after a completion checklist.
  Full verified payment is required before closing the job. Existing `standard`
  maintenance quotes retain their previous payment behavior. See
  [the maintenance API workflow](MAINTENANCE-WORKFLOW.md). Current API runtime
  requires verified migrations through 035; follow the
  [schema release/test checklist](SCHEMA-RELEASE-CHECKLIST.md).

## Local Setup

```powershell
pnpm.cmd install
Copy-Item apps/api/.env.example apps/api/.env.local
pnpm.cmd run dev:api
```

The API app has no root UI page. Consume its `/api/chatbot/**` and `/api/v1/**`
routes from a client or API tool at `http://localhost:3000` by default.

## Environment Variables

Required for local AI-provider diagnosis:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash-lite
AI_TOTAL_TIMEOUT_MS=10000
GEMINI_TIMEOUT_MS=6000
OPENROUTER_TIMEOUT_MS=4000
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=openai/gpt-oss-20b:free
OPENROUTER_ENABLE_MODEL_FALLBACK=true
OPENROUTER_FALLBACK_MODEL=openrouter/free
```

Gemini is the primary AI provider. OpenRouter is used only after Gemini fails,
times out, or is temporarily circuit-open. If all remote providers fail, the API
uses the local fallback diagnosis and returns `fallback_used=true` instead of
crashing. The total remote AI wait budget defaults to 10 seconds.

Required for the hosted Supabase backend:

```env
DATABASE_URL=<development-session-pooler-or-direct-connection>
SUPABASE_URL=<project-url>
SUPABASE_JWT_ISSUER=<auth-token-issuer>
SUPABASE_JWT_AUDIENCE=authenticated
SUPABASE_JWKS_URL=<project-jwks-url>
SUPABASE_PUBLISHABLE_KEY=<publishable-or-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<backend-only-service-role-key>
CHATBOT_PERSISTENCE_MODE=postgres
```

Use only a test/development Supabase project. Never expose the database URL or
service-role key through a `NEXT_PUBLIC_` variable.

### Google sign-in contract

- Enable Google in Supabase Auth and keep the Google client secret in the
  Google/Supabase dashboards; the API does not need a Google secret.
- Clients send the resulting Supabase access token as `Authorization: Bearer`.
  The API verifies it through JWKS, then `POST /api/v1/auth/profile` accepts an
  optional `account_type` of `rider` or `mechanic`. Omission defaults to
  `rider`; the first successful selection is immutable.
- A mechanic selection atomically creates the `mechanic` role and an unavailable
  `pending` mechanic profile. Dispatch and assignment acceptance require an
  admin-approved `active` mechanic profile.
- `admin` cannot be self-selected. Existing administrators grant that role
  through `POST /api/v1/admin/users/{userId}/roles/grant`.
- When `display_name` is omitted, the verified `user_metadata.full_name` or
  `user_metadata.name` claim is used. All effective roles remain database-owned
  and are returned by `GET /api/v1/auth/me`.

Required for backend-only payOS/VietQR payments:

```env
PAYMENTS_ENABLED=true
PAYMENT_PROVIDER=payos
PAYOS_CLIENT_ID=<payos-client-id>
PAYOS_API_KEY=<payos-api-key>
PAYOS_CHECKSUM_KEY=<payos-checksum-key>
PAYOS_BASE_URL=https://api-merchant.payos.vn
PAYOS_RETURN_URL=<non-authoritative-return-url>
PAYOS_CANCEL_URL=<non-authoritative-cancel-url>
```

Automated tests mock payOS. payOS production testing should use a test account
and very small VND amounts because payOS does not provide a separate sandbox.

Required for local ASR:

```env
ASR_ENABLED=true
SHERPA_ONNX_MODEL_DIR=./models/sherpa-onnx-zipformer-vi-30M-int8-2026-02-09
SHERPA_ONNX_ENCODER=encoder.int8.onnx
SHERPA_ONNX_DECODER=decoder.onnx
SHERPA_ONNX_JOINER=joiner.int8.onnx
SHERPA_ONNX_TOKENS=tokens.txt
```

## Local ASR Setup

Voice transcription runs locally through `sherpa-onnx-node`. Raw audio stays on
the local backend and is not sent to OpenRouter or any remote provider.

The Vietnamese 2026-02-09 model is included under:

```text
apps/api/models/sherpa-onnx-zipformer-vi-30M-int8-2026-02-09/
```

Required files:

```text
encoder.int8.onnx
decoder.onnx
joiner.int8.onnx
tokens.txt
```

The default `.env.example` values already point to this folder:

```env
ASR_ENABLED=true
SHERPA_ONNX_MODEL_DIR=./models/sherpa-onnx-zipformer-vi-30M-int8-2026-02-09
SHERPA_ONNX_ENCODER=encoder.int8.onnx
SHERPA_ONNX_DECODER=decoder.onnx
SHERPA_ONNX_JOINER=joiner.int8.onnx
SHERPA_ONNX_TOKENS=tokens.txt
```

Run a local ASR model readiness check:

```bash
pnpm.cmd run asr:smoke
```

Pass a WAV file to run transcription:

```bash
pnpm.cmd run asr:smoke -- path/to/audio.wav
```

If the native runtime or model files are missing, the app returns controlled ASR
errors such as `ASR_NOT_AVAILABLE` or `ASR_MODEL_NOT_FOUND`.

## Hosted Supabase Migrations

The repository contains the authoritative migration sequence
`202606250001` through `202606250032`. Link the CLI to the test/development
project once:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref <project-ref>
```

Inspect and apply pending migrations before enabling backend APIs or inserting
mock data:

```powershell
npx.cmd supabase migration list
npx.cmd supabase db push --dry-run
npx.cmd supabase db push
```

Do not run `db push` when the linked project is production. If migration history
does not match the local files, inspect the mismatch before using
`migration repair`.

## Supabase Mock Data

The mock-data script creates or updates four Supabase Auth users and inserts
related application fixtures. Add a strong test-only password to `.env.local`:

```env
SEED_USER_PASSWORD=<shared-password-for-seeded-test-users>
```

The seed requires `DATABASE_URL`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `SEED_USER_PASSWORD`, and all migrations through
`202606250032`.

Run and verify:

```powershell
pnpm.cmd run seed:mock
pnpm.cmd run seed:mock:verify
```

Seeded Auth accounts:

| Account | Role |
|---|---|
| `rider1@gmail.com` | Rider |
| `rider2@gmail.com` | Rider |
| `mechanic1@gmail.com` | Mechanic |
| `mechanic2@gmail.com` | Mechanic |

All four accounts use `SEED_USER_PASSWORD`. Re-running the seed updates that
password and upserts the fixed-ID fixtures. Verification should report four
application users, five motorcycles, ten service requests, five dispatch
candidates, three assignments, four quotes, four reminder rules, four
notifications, and two chatbot sessions.

The script uses the Supabase Admin API and a privileged database connection.
Never run it against production, commit the password, or paste secret values
into logs or documentation.

For backend validation and manual API flows, see
[`quickstart.md`](../../specs/002-careonroad-backend-mvp/quickstart.md) and
[`manual-testing-guide.md`](../../specs/002-careonroad-backend-mvp/manual-testing-guide.md).

## Demo Scenarios

Normal text input:

```text
Xe sáng khó đề và hao xăng hơn bình thường.
```

Expected result: low or medium risk, a concise short answer, at most two
hypotheses, and an estimated VND price range labeled as an estimate only.

Dangerous text input:

```text
Xe đang chạy bị mất phanh và có mùi cháy.
```

Expected result: high or critical risk, `can_continue_riding=false`, an
`emergency_rescue` action, and a short answer telling the user to stop riding
and seek help.

Voice clients upload WAV audio to the transcription endpoint, review or edit
the returned text, then submit it to the messages endpoint. ASR does not call
diagnosis automatically.

Diagnosis output is advisory only and is not a final mechanic quote. Any price
shown by the app is an estimate only.

## Checks

```powershell
pnpm.cmd run typecheck
pnpm.cmd run lint
pnpm.cmd test
pnpm.cmd run build:api
```

`pnpm.cmd test` is unit/static/route-only by default and does not run PostgreSQL
integration tests even when `.env.local` contains `TEST_DATABASE_URL`. Run
database tests explicitly:

```powershell
pnpm.cmd run test:db
pnpm.cmd run test:full
```

`test:db` and `test:full` set `RUN_DB_TESTS=true` and require
`TEST_DATABASE_URL`. When that URL points to hosted Supabase/PostgreSQL, the DB
suite can take many minutes. Slow integration tests use explicit per-test
timeouts where needed; a timeout failure without an assertion failure usually
means the hosted database run exceeded the configured test budget.
