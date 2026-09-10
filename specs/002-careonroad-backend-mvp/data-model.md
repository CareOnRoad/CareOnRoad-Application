# Data Model: CareOnRoad Backend MVP

## Conventions

- Primary keys: UUID.
- Timestamps: `timestamptz` in UTC.
- Money: integer VND amounts (`bigint`), never floating point.
- Mutable tables include `created_at`, `updated_at`, and optimistic version where
  useful.
- State history, outbox events, and audit logs are append-only. Future payment
  events, when Patch 6 is implemented, must also be append-only.
- Soft archival uses `archived_at` where user-visible history must remain.
- Free-text diagnosis and motorcycle brand/model fallback remain supported.

## Identity

### `app_users`

Application profile linked one-to-one to `auth.users`.

Fields:

- `id uuid` PK and FK to `auth.users.id`
- `display_name text`
- `phone_masked text null`
- `status user_status` (`active`, `suspended`, `archived`)
- `created_at`, `updated_at`

Rules:

- Profile bootstrap is idempotent by `id`.
- Raw auth tokens are never stored.

### `user_roles`

Fields:

- `user_id uuid` FK `app_users`
- `role app_role` (`rider`, `mechanic`, `admin`)
- `created_at`
- PK `(user_id, role)`

### `user_devices`

Backend-only notification device registration metadata.

Fields:

- `id uuid` PK
- `user_id uuid` FK `app_users`
- `device_key_hash text`
- `platform text`
- `enabled boolean`
- `last_registered_at timestamptz`
- `created_at`, `updated_at`

Rules:

- Raw device tokens are never stored in audit or outbox payloads.
- Registration/update writes domain, sanitized audit, and outbox rows atomically.

## Motorcycles

### `motorcycles`

Fields:

- `id uuid` PK
- `rider_id uuid` FK `app_users`
- `brand_text text`
- `model_text text`
- `license_plate text null`
- `year smallint null`
- `notes text null`
- `archived_at timestamptz null`
- `created_at`, `updated_at`

Rules:

- Rider ownership is immutable except admin migration.
- Brand/model text is required; catalog foreign keys are deferred.
- Year, when present, must be plausible.

Relationship:

- Rider has many motorcycles.
- Motorcycle has many service requests and reminder rules.

## Mechanic Dispatch Profile

### `mechanic_profiles`

Fields:

- `user_id uuid` PK/FK `app_users`
- `profile_status text` (`pending`, `active`, `suspended`, `banned`)
- `is_available boolean`
- `service_radius_km numeric(6,2)`
- `latest_location geography(Point, 4326) null`
- `location_updated_at timestamptz null`
- `availability_updated_at timestamptz`
- `rating_avg numeric(3,2)` default `0`
- `rating_count integer` default `0`
- `created_at`, `updated_at`

Rules:

- Only users with mechanic role may have a profile.
- `is_available = true` means both online and accepting jobs in MVP. Separate
  online and accepting states require a later schema change.
- Service radius must be positive and bounded.
- `location_max_age_seconds = 300`. Automatic dispatch excludes profiles with
  no location or a `location_updated_at` older than 300 seconds at candidate
  selection time.
- `rating_avg` must be between `0` and `5`; `rating_count` must be non-negative.
- `rating_avg` and `rating_count` are backend-owned, read-only aggregate/default
  fields. Mechanics cannot update them.
- Patch 2 does not add `service_reviews`; rating defaults to zero until a later
  review module owns aggregate updates. A zero-count rating remains eligible
  for deterministic dispatch ranking.
- Active workload is calculated from active assignments and is not stored as a
  mechanic-editable counter.

### `mechanic_skills`

Fields:

- `mechanic_id uuid` FK `mechanic_profiles`
- `service_type service_type`
- `created_at`
- PK `(mechanic_id, service_type)`

## Service Requests

### `service_requests`

Fields:

- `id uuid` PK
- `request_code text` unique
- `rider_id uuid` FK `app_users`
- `motorcycle_id uuid` FK `motorcycles`
- `service_type service_type`
- `fulfillment_mode fulfillment_mode null`
- `problem_description text`
- `status request_status`
- `priority request_priority`
- `service_location geography(Point, 4326) null`
- `address_text text null`
- `scheduled_start_at timestamptz null`
- `safety_answers jsonb null`
- `maintenance_notes text null`
- `manual_escalation_reason text null`
- `canceled_reason text null`
- `created_at`, `updated_at`

Patch 7 extension fields:

- `reminder_id uuid null` FK to the originating owned reminder rule
- `reminder_context_id uuid null` FK to the originating due occurrence/context

Service types:

- `emergency_rescue`
- `mobile_repair`
- `at_home_service`
- `periodic_maintenance`
- `other`

Fulfillment modes:

- `immediate_location`
- `scheduled_visit`

Service type is category-light and used for workflow and dispatch grouping.
Fault, component, suspected cause, repair action, and parts remain free text.
Service catalog and component references are optional and nullable.

Request-code rules:

- Public format:
  `COR-{SERVICE_PREFIX}-{YYYYMMDD}-{DAILY_SEQUENCE}`.
- Prefix mapping: `EMR`, `MOB`, `HOME`, `MNT`, `OTH` in service-type order.
- Date uses the `Asia/Ho_Chi_Minh` calendar date.
- Sequence is monotonic per prefix and local date.
- UUID remains the primary key.
- Generation retries after a unique conflict.

Request states:

```text
submitted
  -> dispatching
  -> offered
  -> assigned
  -> mechanic_en_route
  -> in_service
  -> awaiting_quote_approval
  -> awaiting_payment
  -> completed

submitted|dispatching|offered -> manual_escalation
submitted|dispatching|offered -> canceled
assigned -> canceled only through an authorized cancellation workflow
```

Rules:

- Motorcycle must belong to rider.
- `emergency_rescue` requires pickup location and `problem_description`, allows
  safety answers/media metadata, and prohibits `scheduled_start_at`.
- `mobile_repair` requires pickup location or service address and
  `problem_description`, allows safety answers/media metadata, and prohibits
  `scheduled_start_at`; scheduled work must use `at_home_service`.
- `at_home_service` requires service address, future `scheduled_start_at`, and
  `problem_description`; live pickup GPS is optional.
- In Patch 3, `periodic_maintenance` requires future `scheduled_start_at`.
  Missing or past schedules are rejected, and emergency safety answers are not
  required.
- Patch 3 does not store or validate reminder references.
- Patch 7 adds nullable `reminder_id` and `reminder_context_id` references to
  `service_requests`. Its reminder-originated creation path may omit
  `scheduled_start_at` only when the referenced occurrence is due, owned by the
  rider, and associated with the selected motorcycle. Free-form
  `reminder_context` metadata alone does not satisfy this rule.
- `other` requires `fulfillment_mode`.
- `other` plus `immediate_location` requires `problem_description` and
  pickup/service location or address, and prohibits `scheduled_start_at`.
- `other` plus `scheduled_visit` requires `problem_description`, service
  address, and future `scheduled_start_at`.
- `other` never triggers emergency dispatch; emergency behavior requires
  `service_type = emergency_rescue`.
- Other service types reject client-supplied `fulfillment_mode`; their mode is
  fixed by the service-type matrix.
- Completed requests are immutable except audit/admin annotations.

### `request_media_metadata`

Fields:

- `id uuid` PK
- `request_id uuid` FK
- `media_type text`
- `object_reference text`
- `content_type text`
- `size_bytes bigint null`
- `checksum text null`
- `created_by uuid`
- `created_at`

Rules:

- Request ownership/authorization is required.
- Raw media is not stored in this table, audit metadata, or outbox payloads.
- Adding metadata writes domain, sanitized audit, and outbox rows atomically.

### `request_status_history`

Fields:

- `id uuid` PK
- `request_id uuid` FK
- `from_status request_status null`
- `to_status request_status`
- `actor_id uuid null`
- `reason text null`
- `created_at`

### `daily_request_sequences`

Fields:

- `local_date date`
- `service_prefix text`
- `last_sequence bigint`
- `updated_at`
- PK `(local_date, service_prefix)`

Rules:

- Allocation is backend-only and transactional.
- Sequence increments are atomic and monotonic.
- A generated request code is protected by a unique constraint on
  `service_requests.request_code`.

Service-request creation uses an idempotency record scoped by authenticated
actor, creation endpoint, and `X-Idempotency-Key`. Replaying a different request
hash under the same scope/key returns a controlled `409` with a stable error
code. Motorcycle mutations, dispatch-offer acceptance, and quote decisions do
not use client idempotency headers in the MVP; their state and concurrency
rules provide the required replay/race protection.

## Dispatch

### `dispatch_rounds`

Fields:

- `id uuid` PK
- `request_id uuid` FK
- `round_number smallint`
- `radius_m integer`
- `status dispatch_round_status`
- `started_at`, `expires_at`, `completed_at null`
- unique `(request_id, round_number)`

States: `active`, `accepted`, `expired`, `canceled`.

### `dispatch_candidates`

Fields:

- `id uuid` PK
- `round_id uuid` FK
- `request_id uuid` FK
- `mechanic_id uuid` FK
- `rank smallint`
- `distance_m integer null`
- `status dispatch_candidate_status`
- `offered_at`, `expires_at`, `responded_at null`
- unique `(round_id, mechanic_id)`

States form the closed MVP enum defined in `spec.md` FR-010B:
`pending`, `offered`, `accepted`, `rejected`, `expired`, and `cancelled`.
Adding a status requires a specification and migration amendment.

Rules:

- Candidate records represent mechanic offers and remain separate from final
  assignments.
- Only offered, unexpired candidates may be accepted.
- The first valid accept wins.
- Dispatch constants are: initial radius 2 km, radius steps `[2, 5, 8, 12]` km,
  maximum radius 12 km, offer TTL 60 seconds, maximum 4 rounds, candidate batch
  size 10, maximum total wait 360 seconds, and location maximum age 300 seconds.
- Candidate selection excludes mechanics without a latest location or whose
  `location_updated_at` is older than 300 seconds.
- Eligibility/ranking order is: online and accepting jobs, matching broad
  service-type skill, no active assignment/job, nearest distance, higher
  rating, lower active workload, earliest updated availability, then
  `mechanic_id` ascending.
- Active workload conflicts are `accepted`, `en_route`, `on_site`, `diagnosis`,
  `quoted`, `awaiting_payment`, and `in_progress`.
- Accept locks the request and mechanic, verifies request/mechanic active-work
  invariants, creates the assignment, updates request and candidate statuses,
  and writes history/audit/outbox records atomically.

## Assignments

### `assignments`

Fields:

- `id uuid` PK
- `request_id uuid` FK
- `mechanic_id uuid` FK
- `accepted_candidate_id uuid` FK
- `status assignment_status`
- `accepted_at`
- `started_at null`
- `completed_at null`
- `canceled_at null`
- `created_at`, `updated_at`

States:

```text
accepted -> en_route -> on_site -> diagnosis -> quoted
  -> awaiting_payment -> in_progress -> completed
accepted|en_route|on_site|diagnosis|quoted|awaiting_payment|in_progress
  -> canceled
```

Database invariants:

- Partial unique index: one active assignment per `request_id`.
- Mechanic active-work policy is enforced transactionally and, for the
  single-active default, by partial unique index on `mechanic_id`.
- Assignment request/mechanic/candidate identities must agree.

### `assignment_status_history`

Same history shape as request history with `assignment_id`.

### `assignment_eta_metadata`

Fields:

- `id uuid` PK
- `assignment_id uuid` FK
- `request_id uuid`
- `mechanic_id uuid`
- `eta_at timestamptz null`
- `delay_reason text null`
- `created_by uuid`
- `created_at`

Rules:

- `(assignment_id, request_id, mechanic_id)` must match the assignment row.
- `created_by` must equal `mechanic_id`.
- At least one of `eta_at` or `delay_reason` is required.
- ETA must be in the future at insert time; the service additionally enforces
  one minute to 24 hours from backend processing time.
- Records are append-only operational metadata and do not change assignment
  status.

### `assignment_media_metadata`

Fields:

- `id uuid` PK
- `assignment_id uuid` FK
- `request_id uuid`
- `mechanic_id uuid`
- `purpose text` (`diagnosis`, `work_proof`, `safety`, `other`)
- `media_reference text`
- `content_type text`
- `size_bytes bigint`
- `checksum text null`
- `created_by uuid`
- `created_at`
- unique `(assignment_id, media_reference)`

Rules:

- Stores metadata references only; no raw file, base64, blob, or provider
  payload is stored.
- `size_bytes` is bounded to 1 through 25,000,000 bytes.
- `(assignment_id, request_id, mechanic_id)` must match the assignment row.
- `created_by` must equal `mechanic_id`.
- Records are metadata only and do not change assignment status.

### `assignment_completion_checklists`

Fields:

- `id uuid` PK
- `assignment_id uuid` FK
- `request_id uuid`
- `mechanic_id uuid`
- `revision integer`
- `work_summary text`
- `safety_checklist jsonb`
- `notes text null`
- `created_by uuid`
- `created_at`
- unique `(assignment_id, revision)`

Rules:

- Checklist revisions are append-only; latest revision is effective.
- Required safety keys are `test_ride_completed`, `tools_removed`,
  `area_safe`, `rider_briefed`, and `no_fluid_leak`.
- `(assignment_id, request_id, mechanic_id)` must match the assignment row.
- `created_by` must equal `mechanic_id`.
- Checklist storage does not complete, cancel, reassign, or bypass the
  assignment state machine.

## Mechanic Diagnosis

### `mechanic_diagnoses`

Fields:

- `id uuid` PK
- `assignment_id uuid` FK
- `request_id uuid` FK
- `mechanic_id uuid` FK
- `diagnosis_text text`
- `recommended_work_text text null`
- `safety_notes text null`
- `created_at`, `updated_at`

Rules:

- Only assigned mechanic/admin can create.
- Text is required; component taxonomy is optional.
- One current diagnosis per assignment in MVP; revisions remain auditable.

## Quotes

### `quotes`

Fields:

- `id uuid` PK
- `request_id uuid` FK
- `assignment_id uuid` FK
- `diagnosis_id uuid null` FK
- `version integer`
- `status quote_status`
- `currency text` fixed `VND`
- `subtotal_amount bigint`
- `discount_amount bigint`
- `total_amount bigint`
- `notes text null`
- `expires_at timestamptz null`
- `created_by uuid`
- `created_at`
- `responded_at null`
- unique `(request_id, version)`

States: `pending`, `approved`, `rejected`, `superseded`, `expired`.

Rules:

- Amounts are non-negative.
- `total = subtotal - discount`.
- Lines and amounts are immutable after insert.
- Creating a newer version supersedes the prior pending version.
- Only latest pending version may transition to approved/rejected.

### `quote_lines`

Fields:

- `id uuid` PK
- `quote_id uuid` FK
- `line_type quote_line_type` (`labor`, `part`, `other`)
- `description text`
- `quantity numeric(10,2)`
- `unit_amount bigint`
- `line_total_amount bigint`
- `sort_order smallint`

Rules:

- Positive quantity; non-negative unit amount.
- Server calculates line total and quote totals.

## Payments

Feature 005 implements backend-only payOS/VietQR payments. Payment persistence
is defined by `202606250020_payments.sql` with `payment_orders` and
`payment_events`.

Quote approval still moves the request and assignment to `awaiting_payment`
without creating a payment order and without starting work. The owning rider
then creates a payment order for the latest approved quote. A verified matching
payOS webhook marks the order `succeeded`. Only after a succeeded payment may
the authorized assignment status workflow move `awaiting_payment -> in_progress`.

Refunds, settlement, payout, invoices, card storage, and payment UI remain out
of scope.

## Reminders

### `reminder_rules`

Fields:

- `id uuid` PK
- `rider_id uuid` FK
- `motorcycle_id uuid` FK
- `title text`
- `interval_days integer null`
- `next_due_at timestamptz`
- `snoozed_until timestamptz null`
- `enabled boolean`
- `last_completed_at timestamptz null`
- `created_at`, `updated_at`

Rules:

- Motorcycle must belong to rider.
- Positive interval when recurring.
- Effective due time is `snoozed_until` when present, otherwise `next_due_at`.

### `reminder_occurrences`

Fields:

- `id uuid` PK
- `rule_id uuid` FK
- `due_at timestamptz`
- `status reminder_occurrence_status`
- `notification_id uuid null`
- `created_at`, `processed_at null`
- unique `(rule_id, due_at)`

States: `due`, `queued`, `sent`, `dismissed`, `failed`.

## Notifications, Outbox, Audit, Idempotency

### `notifications`

Fields:

- `id uuid` PK
- `user_id uuid` FK
- `type text`
- `title text`
- `body text`
- `data jsonb`
- `status notification_status`
- `read_at null`
- `created_at`, `sent_at null`

### `outbox_events`

Fields:

- `id uuid` PK
- `topic text`
- `aggregate_type text`
- `aggregate_id uuid`
- `dedupe_key text` unique
- `payload jsonb`
- `status outbox_status`
- `attempt_count integer`
- `next_attempt_at timestamptz`
- `lease_owner text null`
- `lease_expires_at timestamptz null`
- `last_error_code text null`
- `created_at`, `processed_at null`

States: `pending`, `processing`, `processed`, `dead_letter`.

### `audit_logs`

Fields:

- `id uuid` PK
- `actor_id uuid null`
- `actor_role app_role null`
- `action text`
- `entity_type text`
- `entity_id uuid null`
- `request_id text null`
- `metadata jsonb`
- `created_at`

Rules:

- Append-only.
- Metadata must already be sanitized.

### `idempotency_records`

Fields:

- `id uuid` PK
- `actor_id uuid`
- `scope text`
- `idempotency_key text`
- `request_hash text`
- `response_status integer null`
- `response_body jsonb null`
- `resource_type text null`
- `resource_id uuid null`
- `expires_at timestamptz`
- `created_at`, `completed_at null`
- unique `(actor_id, scope, idempotency_key)`

Rules:

- Current client idempotency records are required for service-request creation,
  admin command mutations, and mechanic assignment metadata mutations
  (ETA/media/checklist).
- Future payment provider webhook deduplication must not use
  `X-Idempotency-Key`; it should use provider event id when supplied, otherwise
  a provider reference plus event type.

## Existing Chatbot Persistence Integration

These tables preserve the existing `/api/chatbot/**` contracts. They do not
change diagnosis behavior or send raw audio to persistence or remote AI.

### `chatbot_sessions`

Fields:

- `id uuid` PK matching the existing session identifier
- `owner_user_id uuid null` FK `app_users`
- `created_at`, `updated_at`

Rules:

- Anonymous demo sessions remain supported.
- An authenticated owner may be attached without changing existing route shape.

### `chatbot_messages`

Fields:

- `id uuid` PK
- `session_id uuid` FK `chatbot_sessions`
- `input_mode text` (`text`, `voice`)
- `content_text text`
- `transcribed_text text null`
- `normalized_text text`
- `safety_answers jsonb null`
- `created_at`

Rules:

- Raw audio is never stored.
- Existing privacy-safe logging rules still apply.

### `diagnosis_results`

Fields:

- `id uuid` PK
- `session_id uuid` FK `chatbot_sessions`
- `message_id uuid null` FK `chatbot_messages`
- `result jsonb`
- `risk_level text`
- `fallback_used boolean`
- `provider_name text null`
- `provider_model text null`
- `created_at`

Rules:

- `result` must already pass existing diagnosis schema and post-validation.
- Latest diagnosis is selected by `created_at` and stable identifier.
- Provider metadata is optional and must contain no secret or raw response.
- Existing in-memory repositories remain available for tests.

## Transaction Boundaries

### Create Service Request

One transaction:

- validate rider/motorcycle ownership;
- insert request and initial history;
- insert outbox event;
- insert audit log;
- complete idempotency record when supplied.

### Accept Dispatch Offer

One transaction:

- lock candidate, request, mechanic, and mechanic active assignment set;
- validate candidate offer expiry and request state;
- insert assignment;
- accept selected candidate and cancel competing candidates;
- update request state/history;
- create outbox and audit rows.

### Cancel Request Versus Accept Offer

Both transactions lock the same service-request row and re-check status after
the lock:

- cancellation committing first causes acceptance to fail without an
  assignment, accepted candidate, assignment history, audit, or outbox residue;
- acceptance committing first causes direct rider cancellation to fail once
  assigned unless a separate authorized assignment-cancellation workflow runs;
- no committed state may combine a canceled request with an active assignment;
- the losing transaction leaves no inconsistent history, audit, or outbox rows.

### Create Quote Version

One transaction:

- lock request quote stream;
- supersede prior pending quote;
- allocate next version;
- calculate and insert quote/lines;
- update request state if applicable;
- create outbox and audit rows.

### Process Payment Event

Feature 005 owns payment event processing. Verified payOS webhook events are
deduplicated by provider event identity, matched to a known payment order,
checked against quote amount/currency, and applied transactionally. A succeeded
payment is the prerequisite for `awaiting_payment -> in_progress`; mismatches
move the order to `needs_review` and do not advance service work.

### Claim Reminder/Outbox Work

Workers select eligible rows with `FOR UPDATE SKIP LOCKED`, set a lease, commit,
then perform external work. Completion/retry is recorded in a second
transaction.

## RLS and Access Summary

- Direct client writes to domain tables are denied by default.
- Riders may only read their own motorcycles, requests, quotes, reminders,
  payment orders, and notifications if direct read access is enabled later.
- Mechanics may only read offers addressed to them and assignments assigned to
  them.
- Admin access is explicit and audited.
- Backend services still enforce role, ownership, and state regardless of RLS.
