# Feature Specification: CareOnRoad Mechanic Operations

**Feature Branch**: `004-careonroad-mechanic-operations`

**Created**: 2026-07-07

**Status**: Implemented through T070 in the current workspace

**Input**: User description: "Plan backend-only mechanic-facing operational services and functions for dashboard, job list, performance, ETA updates, field media metadata, and completion checklist without frontend work, payment checkout, live tracking UI, Maps UI, inventory, settlement, chatbot, or ASR changes."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mechanic Dashboard MVP (Priority: P1)

As a mechanic, I need a backend summary of my current operational state, so that
I can see whether I am available, whether my location is fresh, how many offers
are open, whether I have an active job, and what action is expected next.

**Why this priority**: The mechanic needs one safe read model before any deeper
job or performance workflow can be useful.

**Independent Test**: With one mechanic profile, offers, assignments, and
location timestamps, request the dashboard and verify availability, stale
location, open offers, active assignment, today counts, seven-day metrics,
rating summary, and next action codes.

**Acceptance Scenarios**:

1. **Given** an authenticated active mechanic, **When** the mechanic requests the
   dashboard, **Then** the response contains only that mechanic's operational
   summary and safe next action codes.
2. **Given** the mechanic has no current offers or assignments, **When** the
   dashboard is requested, **Then** the response returns a valid empty-state
   summary instead of an error.
3. **Given** the mechanic's latest location is stale by dispatch policy,
   **When** the dashboard is requested, **Then** the response includes a stale
   location indicator and a next action asking for a location update.
4. **Given** a non-mechanic actor, **When** that actor invokes the dashboard,
   **Then** access is denied without disclosing mechanic-specific data.

---

### User Story 2 - Mechanic Job List and Performance (Priority: P1)

As a mechanic, I need a backend job list and performance summary, so that I can
review assigned work, filter work by time or status, and understand my recent
operational metrics without seeing other mechanics' jobs.

**Why this priority**: Mechanics need history and active work context before ETA
or completion updates can be reliable.

**Independent Test**: Seed assignments for two mechanics, request jobs with
filters and pagination, then request performance metrics and verify no data from
the other mechanic appears.

**Acceptance Scenarios**:

1. **Given** a mechanic has active and completed assignments, **When** the
   mechanic lists jobs with `active_only=true`, **Then** only active jobs owned
   by that mechanic are returned.
2. **Given** date and status filters, **When** the mechanic lists jobs, **Then**
   only matching assignments are returned in stable cursor order.
3. **Given** known offer and assignment history, **When** the mechanic requests
   performance metrics, **Then** completed count, canceled count, acceptance
   rate, decline rate, average accept time, workflow durations, quote approval
   rate, and rating summary reconcile with trusted rows.
4. **Given** another mechanic's job exists, **When** this mechanic requests jobs
   or performance, **Then** the other mechanic's details are never returned.

---

### User Story 3 - ETA and Delay Updates (Priority: P2)

As a mechanic, I need to update my ETA or submit a delay reason for an active
assignment, so that riders and operations have current status metadata without
introducing live tracking UI.

**Why this priority**: ETA changes are common during roadside work, but they
must stay bounded and auditable.

**Independent Test**: With an assigned active job, submit valid ETA and delay
updates, verify assignment ownership and state checks, and confirm sanitized
audit/outbox metadata.

**Acceptance Scenarios**:

1. **Given** an assigned mechanic with an active assignment, **When** the
   mechanic submits a valid future ETA, **Then** the ETA metadata is stored and
   a sanitized audit/outbox event is appended.
2. **Given** a mechanic is not assigned to the job, **When** the mechanic submits
   an ETA update, **Then** the request is denied without changing the assignment.
3. **Given** an assignment is already terminal, **When** an ETA update is
   submitted, **Then** the request is rejected as an invalid state.
4. **Given** a delay reason is empty, too long, or unsafe to store in operational
   metadata, **When** it is submitted, **Then** validation fails and no partial
   write occurs.

---

### User Story 4 - Mechanic Field Media Metadata (Priority: P2)

As a mechanic, I need to attach field media metadata to my assignment, so that
diagnosis or work proof can be referenced without storing raw files in audit,
outbox, or this planning scope.

**Why this priority**: Work evidence is operationally useful, but raw media
handling and file storage are outside this feature.

**Independent Test**: Submit media metadata for an active owned assignment and
verify metadata validation, ownership, state policy, and no raw media in audit
or outbox.

**Acceptance Scenarios**:

1. **Given** an assigned mechanic and active assignment, **When** the mechanic
   submits valid media metadata, **Then** the metadata is attached to the
   assignment and raw file content is not persisted by this API.
2. **Given** an invalid content type, oversized metadata, missing reference, or
   prohibited raw payload, **When** media metadata is submitted, **Then** the
   request is rejected.
3. **Given** another mechanic owns the assignment, **When** media metadata is
   submitted, **Then** the request is denied and no target details leak.

---

### User Story 5 - Completion Checklist (Priority: P2)

As a mechanic, I need to submit a work summary and safety checklist before or
alongside completion, so that completed work has traceable field confirmation
without bypassing the existing assignment state machine.

**Why this priority**: Completion evidence improves operational confidence, but
it must not become an arbitrary status transition.

**Independent Test**: Submit a completion checklist for an eligible owned
assignment, verify required fields and append-only persistence, then attempt the
same action from invalid states and non-owner mechanics.

**Acceptance Scenarios**:

1. **Given** an assigned mechanic and eligible active assignment, **When** the
   mechanic submits a valid work summary and safety checklist, **Then** a
   durable checklist record is stored.
2. **Given** required checklist fields are missing, **When** the checklist is
   submitted, **Then** validation fails and no record is stored.
3. **Given** a checklist has been submitted, **When** assignment completion is
   later requested through the existing assignment status workflow, **Then** the
   normal state machine remains the source of truth.
4. **Given** this specification has not explicitly authorized blocking
   completion without a checklist, **When** checklist implementation is planned,
   **Then** checklist storage remains separate metadata and does not change the
   existing completion transition.

### Edge Cases

- A mechanic has role `rider` only, is inactive, or has no mechanic profile.
- A mechanic has a profile but is unavailable or has stale location.
- A mechanic has multiple open offers and one active assignment.
- Offer acceptance, assignment status, ETA update, checklist submission, and
  media metadata submission occur concurrently.
- A job changes from active to terminal between read and mutation.
- A mechanic attempts to access another mechanic's assignment, performance, or
  media metadata.
- ETA is less than one minute in the future, more than 24 hours in the future,
  malformed, or paired with an oversized delay reason.
- Media metadata includes raw base64, signed secrets, private provider payloads,
  or files instead of references.
- Completion checklist contains private rider narrative, unsafe free-form
  content, or attempts to force assignment status.
- Dashboard or performance reads are repeated while no data changes.

## Requirements *(mandatory)*

### Functional Requirements

- **MOP-001**: Every route in this feature MUST require an authenticated active
  mechanic actor unless explicitly stated otherwise.
- **MOP-002**: Every read model MUST be scoped to the current mechanic and MUST
  reject or hide other mechanics' operational data.
- **MOP-003**: `GET /api/v1/mechanics/me/dashboard` MUST return availability,
  location freshness, open offers count, active assignment summary, today
  counts, seven-day performance, rating average/count, and next action codes.
- **MOP-004**: Dashboard reads MUST derive from existing mechanic profile,
  dispatch, assignment, quote, and rating data; no persisted dashboard table may
  be introduced.
- **MOP-005**: `GET /api/v1/mechanics/me/jobs` MUST return mechanic-owned
  assignment summaries plus safe service-request context.
- **MOP-006**: Job listing MUST support validated `status`, `active_only`,
  `date_from`, `date_to`, `limit`, and `cursor` filters.
- **MOP-007**: Job list pagination MUST be stable, bounded, and capped at 100
  records per page.
- **MOP-008**: `GET /api/v1/mechanics/me/performance` MUST return completed
  jobs, canceled jobs, acceptance rate, decline rate, average accept time,
  average workflow durations, quote approval rate, rating average, and rating
  count.
- **MOP-009**: Performance metrics MUST be derived from trusted existing rows
  and new mechanic-authored metadata only where needed; no earnings, payout, or
  settlement metric may be added.
- **MOP-010**: `POST /api/v1/assignments/[assignmentId]/eta` MUST allow only the
  assigned mechanic to update ETA or delay metadata for an active assignment.
- **MOP-011**: ETA updates MUST validate that ETA is at least one minute and no
  more than 24 hours in the future, and MUST validate delay reason length before
  any write.
- **MOP-012**: `POST /api/v1/assignments/[assignmentId]/media` MUST store only
  mechanic field media metadata, not raw media bytes.
- **MOP-013**: Media metadata MUST be validated for reference, type, size,
  purpose, and ownership, and MUST omit raw media from audit and outbox records.
- **MOP-014**: `POST /api/v1/assignments/[assignmentId]/completion-checklist`
  MUST store a mechanic-authored work summary and safety checklist for eligible
  active assignment statuses: `accepted`, `en_route`, `on_site`, `diagnosis`,
  `quoted`, `awaiting_payment`, and `in_progress`. Checklist records are
  append-only revisions. The latest revision for an assignment is the effective
  checklist.
- **MOP-015**: Completion checklist storage MUST NOT bypass or replace the
  existing assignment status state machine.
- **MOP-016**: Mutations MUST run transactionally, re-check current assignment
  ownership and state, and append sanitized audit/outbox metadata when
  operationally meaningful.
- **MOP-017**: New durable persistence is allowed only for assignment ETA or
  progress metadata, mechanic assignment media metadata, and completion
  checklist metadata.
- **MOP-018**: The feature MUST preserve current dispatch, offer acceptance,
  assignment, mechanic diagnosis, quote, reminder, notification, outbox,
  chatbot, ASR, rider, admin, and worker behavior.
- **MOP-019**: The feature MUST NOT add frontend UI, mobile UI, payment routes,
  payment providers, payment checkout, settlement, inventory, Maps UI, live
  tracking UI, odometer reminders, chatbot changes, or ASR changes.
- **MOP-020**: Responses, audit metadata, outbox metadata, logs, and fixtures
  MUST not expose credentials, raw media, raw audio, raw provider payloads,
  payment-sensitive fields, or unrestricted private narrative text.
- **MOP-021**: ETA, media metadata, and completion checklist mutations MUST
  require `X-Idempotency-Key`. Replaying the same key with the same request body
  MUST return the original successful result without creating duplicate metadata,
  audit, or outbox records. Reusing the same key with a different request body
  MUST be rejected as a conflict.

### Security and Privacy Constraints

- Object existence MUST not be disclosed to unauthorized actors.
- Mechanic-owned reads and mutations MUST use backend-verified actor identity,
  not client-submitted mechanic identifiers.
- Raw file handling is outside this feature; APIs accept metadata references
  only.
- ETA, media, checklist, dashboard, and performance responses MUST be
  metadata-first and operationally bounded.
- Audit and outbox records MUST contain IDs, codes, timestamps, safe counts, and
  sanitized bounded strings only.

### Research Basis

- Urgently documents roadside service-provider operations with real-time
  service acceptance, status updates, location tracking, dashboards, and
  performance metrics: <https://www.geturgently.com/>.
- Uber's Driver app model includes a home summary, going online, trip requests,
  navigation/contact flows, and earnings/activity sections; CareOnRoad uses the
  operational pattern but excludes earnings, payout, and frontend work:
  <https://www.uber.com/us/en/drive/driver-app/>.
- Housecall Pro's field-service model includes a jobs dashboard, job details,
  schedules, customer history, estimates, invoices, offline job access, and time
  tracking; CareOnRoad uses job-detail and work-proof concepts but excludes
  invoicing, payments, and frontend app scope:
  <https://www.housecallpro.com/features/mobile-app/>.

### Key Entities

- **Mechanic Actor**: The authenticated active application user with mechanic
  role and profile.
- **Mechanic Dashboard Summary**: Derived read model containing availability,
  location freshness, offers, active assignment, short-window metrics, rating,
  and next action codes.
- **Mechanic Job Summary**: Mechanic-owned assignment view with safe request
  context, assignment state, timestamps, quote status, and next action.
- **Mechanic Performance Summary**: Derived metrics from offers, assignments,
  quotes, histories, and trusted rating aggregates.
- **Assignment ETA Metadata**: Mechanic-authored ETA, delay reason, timestamps,
  and provenance for an active assignment.
- **Assignment Media Metadata**: Mechanic-authored reference metadata for field
  media, purpose, content type, size, and timestamps.
- **Completion Checklist Record**: Mechanic-authored work summary and structured
  safety checks associated with an assignment.

## Success Criteria *(mandatory)*

- **SC-001**: 100% of non-mechanic, inactive, or unauthorized actors are denied
  from mechanic operation routes without protected data leakage.
- **SC-002**: Dashboard, job list, and performance responses return only the
  current mechanic's data in all cross-mechanic fixtures.
- **SC-003**: Dashboard values reconcile with seeded offer, assignment,
  location, and rating fixtures for empty, stale-location, open-offer, and
  active-job cases.
- **SC-004**: Job list filters and pagination return deterministic results with
  no page larger than 100 records.
- **SC-005**: Performance calculations match seeded fixtures for completion,
  cancellation, acceptance, decline, accept-time, workflow-duration,
  quote-approval, and rating metrics.
- **SC-006**: ETA, media metadata, and completion checklist mutations reject
  invalid ownership, invalid states, malformed payloads, stale concurrent
  changes, missing idempotency keys, and idempotency conflicts with no partial
  writes.
- **SC-007**: Successful mutations append sanitized audit/outbox metadata where
  expected and never include raw media, raw audio, provider payloads, secrets,
  or payment-sensitive content.
- **SC-008**: Existing dispatch, assignment, diagnosis, quote, reminder,
  notification, outbox, chatbot, ASR, rider, admin, and worker regression suites
  retain their pre-feature behavior.
- **SC-009**: Static scope tests confirm no frontend UI, payment, Maps/live
  tracking UI, inventory, odometer reminder, chatbot rewrite, or ASR rewrite is
  introduced.

## Assumptions

- This feature is backend-only and mechanic-owned runtime workflow, separate
  from `specs/003-careonroad-admin-operations/`.
- Dashboard and performance data are derived from existing records unless new
  mechanic-authored metadata is explicitly required.
- Live tracking UI is excluded; ETA and location freshness are backend metadata
  only.
- Payment is owned by feature 005; no earnings, payout, checkout, settlement,
  refund, or payment-provider behavior is planned in this mechanic operations
  feature.
- Checklist records are separate append-only metadata revisions unless a later
  specification explicitly authorizes completion gating.
