# Feature Specification: CareOnRoad Backend MVP

**Feature Branch**: `002-careonroad-backend-mvp`

**Created**: 2026-06-25

**Status**: Ready for continued implementation — requirements checklist complete;
Patches 1-5 are complete through T068 plus T112-T113. Patch 5 was explicitly
authorized by the user and completed through T068. Patch 7A reminder rules,
occurrences, service-request integration, and worker behavior are completed
through T087. Patch 7B notification persistence, outbox delivery, and audit
hardening are completed through T096. Patch 8 compatible chatbot persistence is
completed through T105. Patch 9 hardening and operational validation is
completed through T118 (T106-T111 and T114-T118). Payment is implemented
separately in feature 005 as backend-only payOS/VietQR order, webhook, and
reconcile behavior.

**Input**: Build the remaining CareOnRoad backend modules in the existing
DEMO_AI repository while preserving the completed chatbot and voice work.

## Scope Boundary

This feature extends the existing Next.js application. It MUST NOT create a
separate backend project, change the frontend UI, or replace:

- `app/api/chatbot/**`
- `src/features/chatbot/**`
- `src/features/asr/**`

New APIs use `app/api/v1/**`, business logic uses
`src/features/<module>/**`, persistence uses `src/server/repositories/**`, and
versioned SQL uses `supabase/migrations/**`.

Constitution version 1.1.0 authorizes these backend-only workflows while
retaining the exclusions on frontend workflows, production payment settlement,
refunds, live dispatch/tracking UI, chatbot/voice rewrites, and actions
initiated solely from AI output.

Explicitly excluded from feature 002:

- frontend UI changes and rider, mechanic, or admin frontend workflows;
- production payment checkout UI, production fund settlement, and refunds;
- inventory or spare-part commerce;
- odometer- or kilometer-based reminder logic;
- live dispatch UI and mechanic tracking UI;
- rewriting the existing AI chatbot or voice implementation;
- automatic booking, mechanic assignment, quote approval, or payment initiated
  solely from AI output.

## Source of Truth

When `CareOnRoad_supabase_backend_updated.md` contains both a current-state
section and a legacy future-design section, the current-state section and the
current repository code are authoritative for existing chatbot and ASR
behavior. Legacy design content MAY guide new backend modules only when it does
not conflict with the completed baseline.

## User Scenarios & Testing

### User Story 1 - Rider Account, Motorcycle, and Request (Priority: P1)

As a rider, I want to authenticate, register a motorcycle, and create a service
request so the backend can safely track roadside or scheduled work.

**Independent Test**: Bootstrap a rider profile from a valid Supabase JWT,
create a motorcycle and request, then verify a different rider cannot access it.

**Acceptance Scenarios**:

1. **Given** a valid JWT without a profile, **When** profile bootstrap runs,
   **Then** a rider profile is created idempotently for the JWT subject.
2. **Given** an authenticated rider, **When** a motorcycle is created,
   **Then** ownership is stored and enforced.
3. **Given** an owned motorcycle, **When** a valid request is created,
   **Then** its initial state, outbox event, and audit record commit together.
4. **Given** rider A's request, **When** rider B reads or mutates it,
   **Then** the API returns a controlled authorization error.

---

### User Story 2 - Atomic Dispatch and Assignment (Priority: P1)

As an available mechanic, I want to receive eligible offers and accept one
safely so requests and mechanics cannot be double-assigned.

**Independent Test**: Dispatch one request to two mechanics, submit concurrent
accept attempts, and verify exactly one active assignment is committed.

**Acceptance Scenarios**:

1. **Given** an unassigned request, **When** dispatch starts, **Then** ranked
   candidates and expiring offers are persisted.
2. **Given** two concurrent accept attempts, **When** both execute, **Then**
   exactly one succeeds.
3. **Given** a mechanic with conflicting active work, **When** another offer is
   accepted, **Then** the backend rejects it.
4. **Given** all bounded rounds expire, **When** dispatch completes, **Then**
   the request moves to manual escalation.

---

### User Story 3 - Mechanic Diagnosis and Quote (Priority: P1)

As the assigned mechanic, I want to record actual findings and issue a
versioned quote so the rider can approve or reject a clear estimate.

**Independent Test**: Seed the assigned mechanic's assignment in `on_site`,
record diagnosis text, advance it through the authorized `diagnosis` workflow,
create two quote versions, approve the latest, and verify the older version
cannot be approved or edited.

**Acceptance Scenarios**:

1. **Given** an assignment in `on_site` or `diagnosis`, **When** its assigned
   mechanic or an admin submits diagnosis text, **Then** it is linked to the
   assignment and request.
2. **Given** quote lines, **When** a quote is created, **Then** totals are
   calculated server-side and the version is immutable.
3. **Given** a newer version, **When** the rider approves an older version,
   **Then** the API rejects stale approval.
4. **Given** an approved quote, **When** an edit is attempted, **Then** a new
   version is required.

---

### User Story 4 - Idempotent Payment Adapter Flow (Priority: P2)

As a backend integrator, I want a provider-neutral payment-order and verified
webhook flow so payment behavior can be tested safely without real fund movement.

**Independent Test**: Create a payment order, replay the same signed provider
webhook fixture, and verify one logical payment transition.

**Acceptance Scenarios**:

1. Payment order amount and currency are copied from the approved quote.
2. Invalid webhook signatures cause no state change.
3. Duplicate provider events are idempotent.
4. Amount or currency mismatch leaves payment unresolved and creates an audit.

---

### User Story 5 - Date/Time-Based Reminders, Not Odometer-Based (Priority: P2)

As a rider, I want date/time-based, not odometer-based maintenance reminders
for my motorcycle.

**Independent Test**: Create a rule, run two concurrent workers after its due
time, and verify one occurrence and one logical reminder job/outbox intent.

**Acceptance Scenarios**:

1. Riders can create, update, snooze, disable, and list owned rules.
2. Due rules create deduplicated occurrences and reminder-originated outbox/job
   intents only; persistent notification records and delivery remain Patch 7B.
3. Worker retries do not duplicate an occurrence.
4. Snoozed rules wait until the snoozed time.
5. After Patch 7 reminder integration is available, an owned due occurrence
   can originate one idempotent periodic-maintenance request for its motorcycle
   without requiring a separate future schedule.

---

### User Story 6 - Reliable Outbox and Audit (Priority: P2)

As an operator, I want reliable asynchronous events and append-only audit
records for important mutations.

**Independent Test**: Execute core state changes and verify domain, outbox, and
audit rows commit atomically; retry failed notification delivery.

**Acceptance Scenarios**:

1. Successful mutations create matching outbox and sanitized audit records.
2. Failed delivery updates retry count and next-attempt time.
3. Successful delivery marks the event processed without repeating domain work.
4. Audit metadata omits secrets, raw audio, full chatbot text, tokens, and
   payment credentials.

---

### User Story 7 - Durable Chatbot History Without Behavior Changes (Priority: P2)

As a returning chatbot user, I want my existing session messages and latest
diagnosis to survive a backend restart without changing how diagnosis or voice
transcription works.

**Independent Test**: Create a session through the existing chatbot API, submit
a diagnosis, restart the backend while retaining persistent storage, and verify
the existing latest-diagnosis route restores the same response contract.

**Acceptance Scenarios**:

1. **Given** an existing chatbot session, **When** a text diagnosis succeeds,
   **Then** the session, message, and validated diagnosis result are persisted.
2. **Given** a persisted session, **When** the backend restarts, **Then** the
   existing diagnosis route restores the latest result without a route or
   response-schema change.
3. **Given** local or unit testing, **When** persistent storage is not selected,
   **Then** the compatible in-memory session-store adapter remains usable.
4. **Given** persistence integration, **When** text or WAV flows execute,
   **Then** provider order, safety, fallback, post-validation, ASR, rate-limit,
   and logging-redaction behavior remains unchanged.

### Edge Cases

- Invalid, expired, wrong-issuer, or wrong-audience JWT.
- Authenticated user without an application profile or with multiple roles.
- Request cancellation while offer acceptance is in flight.
- Offer expiration during acceptance.
- Two mechanics accept one request concurrently.
- One mechanic accepts conflicting requests concurrently.
- Illegal request or assignment state transition.
- Negative quote values, stale approval, and total overflow.
- Retried payment creation, invalid signature, replay, or amount mismatch.
- Two reminder workers claim the same due occurrence.
- Outbox worker crashes after delivery but before marking success.
- Audit metadata contains secrets or prohibited PII.
- Existing chatbot dangerous-symptom and provider-fallback behavior regresses.
- A repeated service-request creation uses the same idempotency key with a
  different request body.
- An `other` request omits `fulfillment_mode`, supplies an invalid mode
  combination, or attempts to trigger emergency dispatch implicitly.
- Before Patch 7, periodic maintenance supplies a missing or past schedule.
- After Patch 7 reminder integration is available, reminder-originated
  periodic maintenance references a reminder that is not due, not owned by the
  rider, or unrelated to the selected motorcycle.
- Two request-code generators contend for the same service prefix and local
  calendar date.
- A client callback claims payment success without a verified provider webhook.
- Persistent chatbot storage is unavailable while the in-memory adapter is
  selected for local or unit testing.

## Requirements

### Functional Requirements

- **FR-001**: Backend MUST verify Supabase access tokens and derive actor id
  from verified `sub`.
- **FR-002**: Verification MUST validate signature, issuer, expiration,
  not-before, configured audience, subject, and signing algorithm. JWKS
  verification MUST use an explicit backend-controlled algorithm allowlist that
  matches the verifier configuration. The JWKS path MUST reject `none`,
  `HS256`, algorithms outside the configured allowlist, key/algorithm
  mismatches, and asymmetric-to-symmetric algorithm-confusion attempts. Legacy
  `HS256` projects MAY use separately configured Supabase Auth-server
  verification only; the backend MUST NOT implicitly fall back from JWKS
  verification to legacy verification.
- **FR-003**: Application roles MUST include `rider`, `mechanic`, and `admin`.
- **FR-004**: Backend MUST expose profile bootstrap/read behavior.
- **FR-004A**: Authenticated users MUST be able to register backend-only
  notification device metadata. Raw device tokens MUST NOT enter audit or
  outbox payloads.
- **FR-005**: Riders MUST manage owned motorcycles.
- **FR-005A**: The mechanic dispatch profile MUST expose backend-owned
  `profile_status`, a single MVP `is_available` flag, `service_radius_km`,
  latest location and `location_updated_at`, `availability_updated_at`, and
  read-only rating aggregates. For MVP, `is_available = true` means both online and
  accepting jobs. `rating_avg` and `rating_count` MUST default to zero, MUST
  remain read-only to mechanics, and MUST NOT require a `service_reviews`
  module in Patch 2. Active workload MUST be derived from active assignments,
  not a mechanic-editable cached counter.
- **FR-006**: Riders MUST create, list, read, and cancel owned service requests.
- **FR-007**: Requests MUST reference rider and motorcycle and include service
  type, free-text issue, status, and location or schedule data as applicable.
- **FR-007A**: The broad service type source of truth MUST contain exactly
  `emergency_rescue`, `mobile_repair`, `at_home_service`,
  `periodic_maintenance`, and `other`.
- **FR-007B**: `service_type` MUST remain category-light and MUST be used only
  for workflow and dispatch grouping. Fault description, component, suspected
  cause, repair action, and replacement parts MUST remain text-first.
  `service_catalog` and component references, if introduced, MUST be optional
  and nullable.
- **FR-007C**: Every service request MUST receive a backend-generated public
  `request_code` in the format
  `COR-{SERVICE_PREFIX}-{YYYYMMDD}-{DAILY_SEQUENCE}`.
- **FR-007D**: Service prefixes MUST be `EMR` for `emergency_rescue`, `MOB` for
  `mobile_repair`, `HOME` for `at_home_service`, `MNT` for
  `periodic_maintenance`, and `OTH` for `other`.
- **FR-007E**: The request-code date MUST use the `Asia/Ho_Chi_Minh` calendar
  date. `DAILY_SEQUENCE` MUST increase monotonically per service prefix and
  local date. `request_code` MUST be unique, generated only by the backend, and
  retried safely after a unique conflict. The UUID remains the internal primary
  key; `request_code` is for display, support, and search.
- **FR-007F**: Every service-request creation MUST require
  `X-Idempotency-Key`. Motorcycle mutations, offer acceptance, and quote
  decisions do not require this client header in the MVP.
- **FR-007G**: The same authenticated actor, endpoint, and idempotency key MUST
  return the same logical creation result without creating a duplicate request.
  The idempotency record MUST retain request hash, status, resource identity,
  and response metadata required for replay.
- **FR-007H**: Reusing the same actor, endpoint, and idempotency key with a
  different payload MUST return a controlled `409` conflict with a stable
  error code.
- **FR-007I**: Service-request creation MUST enforce this service-type input
  matrix:
  - `emergency_rescue` requires `motorcycle_id`, pickup location, and
    `problem_description`; allows `safety_answers` and media metadata; and
    prohibits `scheduled_start_at`.
  - `mobile_repair` requires `motorcycle_id`, pickup location or service
    address, and `problem_description`; allows `safety_answers` and media
    metadata; and prohibits `scheduled_start_at` unless the workflow is
    explicitly submitted as `at_home_service`.
  - `at_home_service` requires `motorcycle_id`, service address,
    future `scheduled_start_at`, and `problem_description`; allows media
    metadata; and treats pickup live GPS as optional.
  - In Patch 3, `periodic_maintenance` requires `motorcycle_id` and future
    `scheduled_start_at`; allows maintenance notes; rejects a missing or past
    `scheduled_start_at`; and does not require emergency safety answers.
  - In Patch 7, reminder integration MAY create `periodic_maintenance` without
    `scheduled_start_at` only from an existing due reminder occurrence owned
    by the rider and associated with the selected motorcycle. The created
    request MUST persist the originating `reminder_id` and
    `reminder_context_id`.
  - `other` requires `fulfillment_mode`.
  - `other` with `fulfillment_mode = immediate_location` requires
    `motorcycle_id`, `problem_description`, and pickup/service location or
    address, and prohibits `scheduled_start_at`.
  - `other` with `fulfillment_mode = scheduled_visit` requires
    `motorcycle_id`, `problem_description`, service address, and future
    `scheduled_start_at`.
  - `other` MUST NOT trigger emergency dispatch. Emergency dispatch requires
    explicit `service_type = emergency_rescue`.
  - Service types other than `other` MUST reject client-supplied
    `fulfillment_mode`; their fixed validation matrix remains authoritative.
- **FR-007J**: Request media persistence MUST store metadata and controlled
  object references only. It MUST NOT store raw media in audit or outbox
  payloads, and adding media metadata MUST enforce request ownership.
- **FR-008**: Request and assignment transitions MUST use the following explicit
  state tables.
- **FR-008A**: The closed service-request status enum MUST contain exactly
  `submitted`, `dispatching`, `offered`, `assigned`, `mechanic_en_route`,
  `in_service`, `awaiting_quote_approval`, `awaiting_payment`, `completed`,
  `manual_escalation`, and `canceled`.
- **FR-008B**: Service-request transitions MUST be limited to:
  - `submitted -> dispatching | manual_escalation | canceled`;
  - `dispatching -> offered | manual_escalation | canceled`;
  - `offered -> assigned | manual_escalation | canceled`;
  - `assigned -> mechanic_en_route | canceled`;
  - `mechanic_en_route -> in_service`;
  - `in_service -> awaiting_quote_approval | awaiting_payment | completed`;
  - `awaiting_quote_approval -> awaiting_payment`;
  - `awaiting_payment -> completed`.
  `completed`, `manual_escalation`, and `canceled` are terminal. Rider
  cancellation MAY transition only `submitted`, `dispatching`, or `offered` to
  `canceled`. Dispatch services own dispatch/offering/manual-escalation
  transitions. Assignment workflows own `offered -> assigned` and subsequent
  assignment-derived request transitions. `assigned -> canceled` requires a
  separate authorized assignment-cancellation workflow and MUST NOT be exposed
  as direct rider cancellation.
- **FR-008C**: The closed assignment status enum MUST contain exactly
  `accepted`, `en_route`, `on_site`, `diagnosis`, `quoted`,
  `awaiting_payment`, `in_progress`, `completed`, and `canceled`. Assignment
  transitions MUST be limited to:
  - `accepted -> en_route | canceled`;
  - `en_route -> on_site | canceled`;
  - `on_site -> diagnosis | canceled`;
  - `diagnosis -> quoted | canceled`;
  - `quoted -> awaiting_payment | canceled`;
  - `awaiting_payment -> in_progress | canceled`;
  - `in_progress -> completed | canceled`.
  `completed` and `canceled` are terminal. Only the assigned mechanic or an
  admin MAY perform assignment progress transitions. Assignment cancellation
  requires an explicitly authorized assignment-cancellation workflow.
- **FR-008D**: Every attempted request or assignment transition MUST lock and
  re-check the applicable current state. An illegal, stale, or unauthorized
  transition MUST return the applicable controlled `403` or `409` error and
  leave no status-history, audit, or outbox residue. Every successful transition
  MUST atomically persist the new state, applicable status history, sanitized
  audit record, and required outbox event. These are the normative Feature 002
  state tables. Each implementation patch must implement and test only the
  applicable subset for that patch.
- **FR-008E**: Pending-patch transition triggers and ownership MUST follow this
  table. Every listed multi-entity state change inherits FR-008D atomicity.

  | Owner | Authorized trigger | Required state behavior |
  |---|---|---|
  | Patch 4 | First valid offer acceptance | Create the assignment as `accepted` and move the request `offered -> assigned`. |
  | Patch 5 | Authorized assignment progress action | Permit `accepted -> en_route -> on_site -> diagnosis`. Synchronize request `assigned -> mechanic_en_route` when the assignment enters `en_route`, and `mechanic_en_route -> in_service` when it enters `on_site`; entering `diagnosis` leaves the request `in_service`. |
  | Patch 5 | Diagnosis create or pre-quote revision | Require the assigned mechanic or admin and assignment state `on_site` or `diagnosis`. Diagnosis mutation does not itself change assignment/request state and MUST NOT bypass authorization, locking, or state checks. |
  | Patch 5 | First quote version creation | Require assignment `diagnosis` and request `in_service`; create the quote and atomically move assignment `diagnosis -> quoted` and request `in_service -> awaiting_quote_approval`. |
  | Patch 5 | Later quote version creation | Require assignment `quoted` and request `awaiting_quote_approval`; supersede the prior pending version without changing assignment/request state. |
  | Patch 5 | Latest pending quote approval | Move assignment `quoted -> awaiting_payment` and request `awaiting_quote_approval -> awaiting_payment`. Approval MUST NOT create a payment order, settle funds, or start work automatically. |
  | Patch 5 | Latest pending quote rejection | Mark the quote rejected while assignment remains `quoted` and request remains `awaiting_quote_approval`, permitting a newer quote version. Rejection MUST NOT initiate payment or cancellation. |
  | Patch 6 | Backend payment-order submission | Create the payment order as `created`; move it `created -> pending` only after the configured mock/sandbox adapter accepts submission. Do not change assignment/request state. |
  | Patch 6 | Verified matching successful provider webhook | Move payment `pending -> succeeded`. Only after that success may an authorized assignment progress action move assignment `awaiting_payment -> in_progress`; that action MUST verify the succeeded payment. Browser/client callbacks cannot trigger either transition. |
  | Patch 7 | Reminder-originated service-request creation | Create the request as `submitted` through the existing service-request workflow and preserve all ownership, due-occurrence validation, and `X-Idempotency-Key` requirements. |

  Direct rider cancellation remains limited to request states `submitted`,
  `dispatching`, and `offered`. After assignment, only the assigned mechanic or
  an admin MAY use a separately authorized assignment-cancellation workflow.
  Patch 5 does not own or add that workflow; it remains unavailable unless an
  explicitly authorized task adds it. No patch may implement transitions
  outside its authorized subset.
- **FR-009**: Automatic dispatch eligibility MUST require
  `profile_status = active`, `is_available = true`, a matching broad
  `service_type` skill, a latest location satisfying FR-009A, and no assignment
  in an active-conflict state from FR-010F. Distance MUST participate in
  deterministic ranking only among eligible mechanics.
- **FR-009A**: `location_max_age_seconds` MUST equal `300`. Automatic dispatch
  MUST exclude a mechanic whose `latest_location` is missing or whose
  `location_updated_at` is more than 300 seconds old at candidate selection
  time.
- **FR-010**: Dispatch MUST use bounded rounds and manual escalation.
- **FR-010A**: A persisted `DispatchCandidate` MUST represent one candidate
  mechanic offer for one service request and MUST remain separate from the
  final assignment.
- **FR-010B**: The closed MVP dispatch-candidate status enum MUST contain
  exactly `pending`, `offered`, `accepted`, `rejected`, `expired`, and
  `cancelled`. Any additional status requires a specification and migration
  amendment.
- **FR-010C**: An assignment MUST be created only after a valid mechanic-accept
  transaction. The first valid accept MUST win.
- **FR-010D**: Dispatch configuration MUST use
  `initial_radius_km = 2`, `radius_steps_km = [2, 5, 8, 12]`,
  `max_radius_km = 12`, `offer_ttl_seconds = 60`,
  `max_dispatch_rounds = 4`, `candidate_batch_size = 10`, and
  `max_total_dispatch_wait_seconds = 360`.
- **FR-010E**: Eligible mechanics MUST be ranked deterministically in this
  order: nearest distance; higher `rating_avg`; earliest
  `availability_updated_at`; and `mechanic_user_id` ascending as the final
  tie-breaker. Mechanics with `rating_count = 0` remain eligible and use the
  stored default `rating_avg = 0`.
- **FR-010F**: Active workload conflict states MUST be `accepted`, `en_route`,
  `on_site`, `diagnosis`, `quoted`, `awaiting_payment`, and `in_progress`.
  Candidate statuses are defined normatively by FR-010B.
- **FR-011**: Offer acceptance MUST atomically prevent multiple active
  assignments for one request.
- **FR-012**: Offer acceptance MUST atomically enforce mechanic workload policy.
- **FR-012A**: A mechanic-accept transaction MUST lock the request and mechanic,
  verify that the request has no active assignment, verify that the mechanic
  has no conflicting active job, create the assignment, update request status,
  update candidate/offer statuses, and append applicable history, audit, and
  outbox records in one atomic operation.
- **FR-012B**: Rider cancellation and mechanic acceptance MUST lock and re-check
  the same service-request row. If cancellation commits first, acceptance MUST
  fail without an assignment, accepted candidate, assignment history, audit, or
  outbox residue. If acceptance commits first, direct rider cancellation MUST
  fail once the request is assigned unless a separate authorized assignment
  cancellation workflow is used. No committed state may contain both a
  canceled request and an active assignment, and the losing transaction MUST
  leave no inconsistent history, audit, or outbox rows.
- **FR-013**: Only assigned mechanics or admins MAY update assignment progress
  or create mechanic diagnosis.
- **FR-014**: Mechanic diagnosis MUST be text-first and category-light.
- **FR-014A**: MVP MUST maintain at most one current mechanic diagnosis per
  assignment. Only the assigned mechanic or an admin MAY create or revise it,
  and only while the assignment is in `on_site` or `diagnosis`.
- **FR-014B**: Diagnosis revision MUST lock and re-check both the assignment and
  current diagnosis. Once any quote version references the diagnosis, the
  diagnosis MUST become immutable. A post-quote correction requires a future,
  explicitly specified diagnosis-version workflow.
- **FR-014C**: Diagnosis creation and revision MUST atomically append applicable
  sanitized audit and outbox records. Audit and outbox payloads MUST NOT contain
  full diagnosis text.
- **FR-015**: Quotes MUST be immutable versions with server-calculated totals.
- **FR-016**: Only the latest pending quote MAY be approved or rejected by the
  owning rider.
- **FR-017**: Approved or rejected quotes MUST NOT be edited.
- **FR-018**: Feature 002 MUST implement only a provider-neutral payment-order
  model, adapter interface, verified webhook handler, idempotency behavior, and
  audit structure. It MUST use mock or sandbox adapters and webhook fixtures
  for tests and MUST NOT require real payment credentials.
- **FR-018A**: Payment orders MUST reference approved quotes and copy amount and
  currency.
- **FR-018B**: The closed payment-order status enum MUST contain exactly
  `created`, `pending`, `succeeded`, `failed`, `canceled`, and `needs_review`.
- **FR-018C**: Payment-order transitions MUST be limited to:

  | From | Allowed target | Authorized trigger |
  |---|---|---|
  | `created` | `pending` | The configured mock/sandbox adapter accepts backend order submission. |
  | `created` | `canceled` | An authorized backend payment-order workflow cancels before provider submission. |
  | `pending` | `succeeded` | A verified matching provider webhook confirms success. |
  | `pending` | `failed` | A verified matching provider event or controlled adapter result confirms failure. |
  | `pending` | `canceled` | A verified matching provider cancellation or authorized backend payment-order workflow confirms cancellation. |
  | `pending` | `needs_review` | A verified event resolves to the known order but its amount or currency mismatches. |
  | `failed` | `pending` | An authorized actor explicitly requests retry through the backend payment-order workflow and the mock/sandbox adapter accepts resubmission. |
  | `failed` | `canceled` | An authorized backend payment-order workflow cancels the failed order. |

  `needs_review` is unresolved and terminal for automated processing; manual or
  admin resolution is future scope unless separately specified. `succeeded` and
  `canceled` are terminal. Duplicate verified provider events are idempotent
  replay and MUST create no additional transition. Feature 002 MUST NOT add real
  checkout, settlement, refund, or production-payment behavior.
- **FR-019**: Payment creation MUST support idempotency keys.
- **FR-019A**: Payment-order creation MUST accept `X-Idempotency-Key` scoped by
  authenticated actor, endpoint, `provider_code`, `quote_id`, and key. The same
  key and payload MUST return the same existing logical result. Reuse with a
  different payload MUST return a controlled `409` conflict with a stable
  error code. The idempotency record MUST retain the payload hash and result
  metadata for at least 24 hours.
- **FR-020**: Verified provider webhooks MUST verify authenticity, order
  identity, amount, currency, and provider-event uniqueness. Payment integration
  tests MUST use mock or sandbox fixtures only.
- **FR-020A**: A browser or client callback MUST NOT mark a payment as paid or
  succeeded. Only a verified provider webhook MAY transition a payment order to
  a successful paid state.
- **FR-020B**: Duplicate webhook events MUST be processed idempotently.
- **FR-020D**: Webhook deduplication MUST use provider event id when available,
  otherwise provider order reference plus event type.
- **FR-020C**: Production checkout UI, real fund settlement, and refund
  workflows MUST remain out of scope.
- **FR-020E**: A verified webhook that resolves to a known payment order through
  the expected provider and provider-order reference, but whose amount or
  currency does not match, MUST transition that known order to `needs_review`
  and atomically append sanitized audit and outbox records. `needs_review` MUST
  NOT be treated as paid or advance the service workflow.
- **FR-020F**: Only a verified, matching webhook MAY transition `pending` to
  `succeeded`. Duplicate provider events MUST return the existing logical result
  without creating another payment transition.
- **FR-020G**: A verified webhook whose provider reference cannot be matched to
  any payment order MUST NOT update any payment order, assignment, request, or
  quote. If the payment event model supports unmatched events, the backend MAY
  persist a sanitized provider-event/audit record without a domain transition;
  otherwise it MUST return a controlled non-success result with no domain
  update. Browser/client callbacks remain non-authoritative and cannot mark a
  payment successful.
- **FR-021**: Riders MUST manage date/time-based, not odometer-based reminder
  rules for owned motorcycles. Reminder rules MUST NOT use odometer or
  kilometer telemetry.
- **FR-021A**: After reminder tables exist in Patch 7, a rider MAY create a
  `periodic_maintenance` service request from an existing due reminder
  occurrence owned by that rider and associated with the selected motorcycle.
  This reminder-originated path MAY omit `scheduled_start_at`, MUST persist
  `reminder_id` and `reminder_context_id`, and MUST reject non-due,
  cross-rider, or motorcycle-mismatched references.
- **FR-022**: Reminder occurrences MUST be deduplicated.
- **FR-023**: State-changing workflows marked as requiring an outbox event in
  the mutation matrix MUST write it in the same transaction as domain changes.
  Read-only operations require neither audit nor outbox records.
- **FR-024**: Outbox processing MUST support lease, retry, success, and
  dead-letter states.
- **FR-025**: Important mutations MUST append sanitized audit records.
- **FR-025A**: Domain mutation, audit record, and outbox event MUST commit
  atomically where the mutation matrix requires them. Privacy-sensitive values
  MUST be sanitized before audit or outbox persistence.
- **FR-026**: New APIs MUST live under `/api/v1`.
- **FR-027**: Route handlers MUST delegate business behavior to
  `src/features/*`.
- **FR-028**: Persistence MUST use interfaces in `src/server/repositories`.
- **FR-029**: Schema changes MUST be versioned under `supabase/migrations`.
- **FR-030**: Database constraints and transactions MUST enforce concurrency
  invariants.
- **FR-031**: APIs MUST return controlled JSON errors with stable codes.
- **FR-031A**: Error status mapping MUST preserve the Patch 1-4 behavior:
  - `400` with `INVALID_INPUT` when request parsing, route validation, Zod
    validation, or application-level input validation rejects the request
    before persistence, including invalid documented cross-field combinations;
  - `422` with `DATABASE_CONSTRAINT_VIOLATION` when accepted input reaches
    persistence but PostgreSQL rejects a non-conflict integrity constraint;
  - `409` with `CONFLICT` for application-detected state, active-work,
    idempotency-payload, illegal-transition, or stale-version conflicts;
  - `409` with `DATABASE_CONFLICT` for database-detected unique, exclusion,
    serialization, or deadlock conflicts after bounded retry behavior;
  - `401` for missing or invalid authentication;
  - `403` for suspended actors, role denial, ownership denial, or object-level
    authorization denial;
  - `404` for absent resources;
  - `503` for database unavailability;
  - controlled `500` responses for unexpected database or application errors.
- **FR-031B**: Every `/api/v1` route group MUST test every boundary applicable
  to that route contract:
  - bearer-protected routes test missing and invalid authentication as `401`;
  - worker routes test missing or invalid worker authority as `401`;
  - role-restricted routes test disallowed roles as `403`;
  - owned-resource routes test actor/resource ownership denial as `403`;
  - identifier-based routes test absent resources as `404`;
  - validated mutations test applicable `400` and `422` cases;
  - contested or replay-sensitive workflows test applicable `409` cases; and
  - every route group tests success with valid authority and input.
  Each controlled failure MUST assert its stable error code. Tests MUST NOT
  manufacture role, ownership, absence, validation, or conflict cases that do
  not exist for the route contract. Signed provider webhooks are governed by
  signature verification rather than bearer authentication.
- **FR-032**: Secrets and credentials MUST never enter responses or logs.
- **FR-032A**: Existing structured-log sanitization MUST remain active. Logs
  MUST NOT contain API keys, service-role keys, bearer tokens, raw audio, full
  symptom text, full transcription, phone numbers, email addresses, or
  payment/card/bank data.
- **FR-032B**: Final hardening MUST scan committed files and fixtures for
  service-role keys, API keys, bearer tokens, payment secrets, and inappropriate
  raw-audio fixtures; verify `/api/v1` responses and audit/outbox payloads omit
  secrets and full private text; and verify frontend bundles expose no
  server-only variables.
- **FR-033**: Existing chatbot routes, Gemini/OpenRouter chain, safety gate,
  fallback, post-validation, ASR, local knowledge retrieval, Zod schema
  validation, rate limiting, structured logging, and tests MUST remain active.
- **FR-034**: Raw audio MUST never be sent to remote AI.
- **FR-035**: Existing frontend UI MUST remain unchanged.
- **FR-036**: Tests MUST mock payment, remote AI, and ONNX integrations.
- **FR-036A**: Existing in-memory chatbot rate-limit behavior MUST remain
  available. New backend rate limits MAY be added but MUST NOT remove or weaken
  existing chatbot limits.
- **FR-037**: Repository-backed persistence for `chatbot_sessions`,
  `chatbot_messages`, and `diagnosis_results` MUST be implemented.
- **FR-037A**: The existing in-memory session-store implementation MUST remain
  available as a compatible local and test adapter.
- **FR-037B**: Chatbot persistence integration MUST NOT change diagnosis
  behavior, ASR behavior, Gemini-then-OpenRouter provider order, safety gate,
  local fallback, post-validation, rate limiting, public response schema, or
  logging redaction.

### Required Product Interfaces

- `GET /api/v1/auth/me`
- `POST /api/v1/auth/profile`
- User device registration under `/api/v1/auth/devices`
- Motorcycle CRUD under `/api/v1/motorcycles`
- Service request endpoints under `/api/v1/service-requests`, with
  `X-Idempotency-Key` required for every creation
- Request media metadata under `/api/v1/service-requests/{id}/media`
- Mechanic dispatch profile read/settings, availability, and location under
  `/api/v1/mechanics/me`
- Dispatch and offers under `/api/v1/service-requests/{id}/dispatch` and
  `/api/v1/dispatch/offers`
- Assignment status and diagnosis under `/api/v1/assignments`
- Quote create/read/approve/reject under `/api/v1/quotes`
- Payment orders and provider webhooks under `/api/v1/payments`
- Reminder rules under `/api/v1/reminders`
- Backend-protected reminder and outbox worker entry points

### Existing AI Chatbot + Voice Baseline Must Remain Operational

FR-033 through FR-037B are the normative chatbot and voice protections.
Feature 002 may add only compatible repository-backed persistence while keeping
the current `/api/chatbot/**` contracts, Gemini-to-OpenRouter provider order,
local ASR, safety gate, fallback, validation, rate limiting, sanitized logging,
in-memory adapters, secret isolation, raw-audio isolation, UI behavior, and
existing regression suite unchanged.

### Key Entities

ApplicationUser, UserRole, UserDevice, Motorcycle, MechanicProfile,
MechanicSkill, ServiceRequest, RequestMediaMetadata,
RequestStatusHistory, DispatchRound, DispatchCandidate, Assignment,
AssignmentStatusHistory, MechanicDiagnosis, Quote, QuoteLine, PaymentOrder,
PaymentEvent, ReminderRule,
ReminderOccurrence, Notification, OutboxEvent, AuditLog, IdempotencyRecord,
ChatbotSession, ChatbotMessage, and DiagnosisResult.

## Success Criteria

- **SC-001**: All protected route tests reject invalid or unauthorized actors.
- **SC-002**: Concurrent acceptance creates exactly one active assignment per
  request and no conflicting mechanic assignment.
- **SC-003**: All quote totals are server-calculated and stale approvals fail.
- **SC-004**: Replayed verified provider webhooks create no duplicate logical
  transition, and browser/client callbacks cannot mark payment successful.
- **SC-005**: Concurrent reminder workers create one occurrence per due rule.
- **SC-006**: Core mutations atomically create domain, outbox, and audit rows.
- **SC-007**: 100% of existing chatbot, ASR, provider, retrieval, schema,
  post-validation, route, rate-limiting, logging, and view-model tests continue
  to pass.
- **SC-008**: Typecheck, lint, test, and build pass after implementation.
- **SC-009**: No real secret appears in bundles, responses, logs, fixtures, or
  committed files.
- **SC-010**: Regression tests prove normal and fallback responses remain
  Vietnamese; diagnosis remains advisory only; estimated prices remain advisory
  estimates; chatbot output cannot initiate assignment, quote approval, or
  payment; dangerous-symptom safety overrides remain enforced; the
  Gemini-to-OpenRouter-to-local-fallback order remains unchanged; provider
  failure and invalid-provider-JSON fallback remain unchanged; local ASR
  remains local; and raw-audio isolation, rate limits, public response
  contracts, and log redaction remain unchanged.
- **SC-011**: Request-code tests prove uniqueness, required format, correct
  Asia/Ho_Chi_Minh date, monotonic daily sequence, and collision retry.
- **SC-012**: Service-request idempotency tests prove identical retries create
  one logical request and mismatched payload replays return a controlled `409`
  with a stable error code.
- **SC-013**: Concurrent mechanic-accept tests prove exactly one first valid
  accept succeeds and conflicting attempts do not create duplicate active jobs.
- **SC-014**: Payment tests use only mock/sandbox adapters and prove unverified
  client callbacks cannot mark payment successful while duplicate verified
  webhooks remain idempotent.
- **SC-015**: Mechanic-profile tests prove rating aggregates default to zero,
  are not mechanic-editable, and mechanics with zero rating count remain
  eligible for deterministic dispatch ranking.
- **SC-016**: Service-request tests prove both `other` fulfillment modes accept
  only their valid location/schedule combinations, fixed-mode service types
  reject client-supplied `fulfillment_mode`, Patch 3 periodic maintenance
  accepts only a future schedule, and Patch 7 reminder-originated maintenance
  accepts only a valid owned due-reminder occurrence for the selected
  motorcycle.
- **SC-017**: Cancel-versus-accept concurrency tests cover both commit orders
  and prove no canceled request coexists with an active assignment and no
  losing-transaction history, audit, or outbox residue remains.

## Assumptions

- Supabase provides managed PostgreSQL and Auth; this backend remains the
  business authority.
- Supabase uses asymmetric signing keys for local JWKS verification. Legacy
  HS256 projects may use controlled Auth-server verification.
- New routes use the Node.js runtime for transactional PostgreSQL access.
- Payments use provider-neutral mock/sandbox adapters and fixtures only; no real
  provider credentials or fund movement are required.
- Dispatch initially uses latest coordinates and broad skills without an
  external route/ETA provider.
- Reminders are date/time-based, not odometer-based; odometer or kilometer
  telemetry and model-specific catalogs are deferred.
- Notifications initially persist in-app records and outbox events.
- Existing chatbot sessions, messages, and diagnosis results MUST gain
  repository-backed persistence while the in-memory implementation remains a
  compatible local/test adapter.
- Frontend workflows, production checkout/settlement/refunds, inventory
  commerce, odometer-based reminders, live dispatch/tracking UI, and AI-only
  automatic booking, assignment, quote approval, or payment remain excluded.
