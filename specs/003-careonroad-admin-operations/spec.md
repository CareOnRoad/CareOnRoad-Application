# Feature Specification: CareOnRoad Admin Operations

**Feature Branch**: `003-careonroad-admin-operations`

**Created**: 2026-07-05

**Status**: Draft

**Input**: User description: "Add backend-only, command-based admin operations for users, mechanics, service requests, dispatch, assignments, diagnosis and quotes, reminders, notifications, outbox, audit queries, operational dashboards, and optional runtime configuration without changing existing rider, mechanic, chatbot, ASR, frontend, or payment behavior."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Safely Manage Users and Administrator Access (Priority: P1)

As an administrator, I need to find users, inspect admin-safe account details and
activity, manage account status, devices, and roles, so that compromised,
ineligible, or incorrectly configured accounts can be corrected without deleting
business history or exposing credentials.

**Why this priority**: User and administrator lifecycle controls are the minimum
safe foundation for every other administrative capability. The platform cannot
be operated safely if compromised accounts cannot be suspended or if the last
active administrator can be removed.

**Independent Test**: This story can be tested with user, role, and device
fixtures only. An administrator can search for a user, suspend and reactivate the
account, revoke a device, and grant or revoke a non-final role while each action
is authorized, reasoned, auditable, and free of secret material.

**Acceptance Scenarios**:

1. **Given** an active administrator and a target active rider, **When** the
   administrator suspends the rider with a valid reason, **Then** the rider is
   suspended, the reason and actor are recorded, and the rider's historical
   records remain intact.
2. **Given** a user device registration, **When** an administrator revokes it
   with a valid reason, **Then** the device can no longer be treated as enabled
   and no raw device key is returned or recorded.
3. **Given** exactly one active administrator remains, **When** any action would
   revoke that role, suspend that account, or archive that account, **Then** the
   action is rejected and no partial state change is committed.
4. **Given** a non-admin actor, **When** that actor invokes any admin user
   operation, **Then** access is denied without disclosing target-user details.

---

### User Story 2 - Approve and Govern Mechanics (Priority: P1)

As an administrator, I need to review mechanic profiles, approve or restrict
their participation, maintain their verified skills and service radius, and
inspect work performance, so that dispatch only considers mechanics who are
currently eligible to provide the requested service.

**Why this priority**: Mechanic eligibility directly affects rider safety,
dispatch quality, and assignment integrity.

**Independent Test**: This story can be tested with mechanic profiles and work
history. An administrator can approve a pending mechanic, suspend an active
mechanic, update verified skills and radius, and force the mechanic unavailable,
while rating aggregates remain read-only.

**Acceptance Scenarios**:

1. **Given** a pending mechanic with a valid profile, **When** an administrator
   approves the mechanic with a reason, **Then** the mechanic becomes eligible
   for dispatch only when all existing availability, skill, location, and
   workload rules are also satisfied.
2. **Given** an active mechanic, **When** an administrator suspends or bans the
   mechanic, **Then** the mechanic becomes ineligible for new dispatch offers
   without deleting prior assignments, diagnoses, quotes, or history.
3. **Given** a mechanic profile, **When** an administrator changes verified
   skills or service radius, **Then** the change is bounded, validated, audited,
   and used by subsequent eligibility decisions.
4. **Given** any administrator request to directly set rating values, **When**
   the request is evaluated, **Then** it is rejected because ratings remain
   derived from trusted data.

---

### User Story 3 - Recover Service Requests and Dispatch Operations (Priority: P1)

As an administrator, I need complete operational visibility into service
requests and dispatch rounds and a small set of valid recovery commands, so that
overdue rounds, exhausted searches, and requests with no valid offer can be
resolved without arbitrary status updates.

**Why this priority**: Current dispatch behavior needs operational completion
around active rounds that have passed their expiry. A stuck dispatch prevents
the rider from receiving service even when the underlying records are valid.

**Independent Test**: This story can be tested with a submitted request, several
mechanics, and active/expired dispatch rounds. An administrator can explain why
dispatch failed, expire an overdue round, retry an eligible request, cancel a
dispatch, or assign an eligible mechanic while invalid or conflicting commands
are rejected atomically.

**Acceptance Scenarios**:

1. **Given** a dispatch round whose expiry time has passed but whose status is
   still active, **When** an administrator expires the round with a reason,
   **Then** its open offers are closed consistently and the request becomes
   eligible for the next valid business action.
2. **Given** a dispatchable request and an eligible mechanic, **When** an
   administrator manually assigns the mechanic, **Then** the same one-active-job
   and one-active-assignment invariants used by normal acceptance are enforced.
3. **Given** an unavailable mechanic, stale location, mismatched skill, service
   radius violation, or active-job conflict, **When** an administrator attempts
   manual assignment, **Then** the assignment is rejected with a stable,
   non-sensitive reason and no partial changes.
4. **Given** a request with no eligible candidate, **When** an administrator
   requests a dispatch explanation, **Then** the response identifies all
   applicable bounded reason categories without exposing private location
   history or internal secrets.
5. **Given** a request in a non-dispatchable state, **When** an administrator
   retries dispatch, **Then** the command is rejected rather than forcing the
   request into a new state.

---

### User Story 4 - Resolve Assignment, Diagnosis, and Quote Cases (Priority: P2)

As an administrator, I need to inspect assignment timelines and issue explicit
cancel, reassign, revision, expiry, void, or dispute-resolution commands, so that
stuck or disputed jobs can be resolved while preserving immutable diagnosis and
quote history.

**Why this priority**: Normal mechanic and rider flows already cover the primary
journey. Administrative intervention is needed for exceptions, but it must not
weaken state-machine or quote-version guarantees.

**Independent Test**: This story can be tested with one assigned job, a
diagnosis, and multiple quote versions. Valid commands produce a complete
history; attempts to overwrite used diagnosis text, overwrite quote versions,
or force an arbitrary state are rejected.

**Acceptance Scenarios**:

1. **Given** an active assignment in a cancelable state, **When** an
   administrator cancels it with a reason, **Then** assignment and request
   states remain consistent and the intervention is fully traceable.
2. **Given** an active assignment and a replacement mechanic who satisfies all
   eligibility rules, **When** an administrator reassigns the job, **Then** the
   previous assignment history is retained and only one active mechanic owns the
   resulting job.
3. **Given** a diagnosis already referenced by a quote, **When** an
   administrator requests a revision, **Then** the original diagnosis is not
   edited and a revision request is recorded for follow-up.
4. **Given** a pending quote with incorrect financial content, **When** an
   administrator requests revision or resolves a dispute, **Then** any changed
   financial content is represented by a new version rather than an overwrite.
5. **Given** an unsupported stuck-resolution action, **When** it is submitted,
   **Then** it is rejected; no general force-status capability is available.

---

### User Story 5 - Operate Audit, Notification, and Outbox Recovery (Priority: P2)

As an administrator, I need sanitized operational visibility into audit,
notification delivery, outbox processing, and dead letters, so that delivery
failures can be investigated and retried without leaking sensitive payloads or
reapplying completed business mutations.

**Why this priority**: Async operations and admin actions are unsafe to operate
without traceability, redaction, and controlled recovery.

**Independent Test**: This story can be tested with notification, audit, pending
outbox, processed outbox, and dead-letter fixtures. The administrator can query
sanitized timelines and retry or abandon eligible failures; immutable audit
records and processed domain effects remain unchanged.

**Acceptance Scenarios**:

1. **Given** a dead-letter event, **When** an administrator retries it with a
   reason, **Then** it becomes eligible for controlled processing without
   duplicating a completed domain mutation.
2. **Given** a pending notification, **When** an administrator cancels it with a
   reason, **Then** it is no longer delivered and cannot be manually marked sent.
3. **Given** a processed event or successfully delivered notification, **When**
   an administrator requests a retry, **Then** the request is rejected unless a
   separate valid domain command creates a new event.
4. **Given** audit or outbox data containing sensitive fields, **When** an
   administrator views or exports it, **Then** secrets, credentials, raw text,
   raw audio, provider payloads, and payment-sensitive data are absent.
5. **Given** an administrator action, **When** its audit history is queried,
   **Then** the administrator, command, reason, target, outcome, and timestamp
   are visible in a read-only record.

---

### User Story 6 - Recover Reminder Processing (Priority: P3)

As an administrator, I need to inspect reminder rules and occurrences, disable or
enable a rule for an operational reason, and retry eligible failed occurrences,
so that reminder failures can be corrected without duplicate rider messages.

**Why this priority**: Reminder management is operationally useful but less
urgent than user safety, mechanic eligibility, and dispatch recovery.

**Independent Test**: This story can be tested using due, sent, dismissed, and
failed reminder occurrences. Only failed, retryable occurrences can be retried,
and repeated requests do not produce duplicate reminders.

**Acceptance Scenarios**:

1. **Given** an enabled reminder causing repeated operational errors, **When**
   an administrator disables it with a reason, **Then** future claims stop while
   its rule and occurrence history remain available.
2. **Given** a failed occurrence that has not been successfully delivered,
   **When** an administrator retries it with a reason, **Then** it is processed
   at most once for that recovery attempt.
3. **Given** a sent or dismissed occurrence, **When** retry is requested,
   **Then** the command is rejected to prevent duplicate spam.
4. **Given** any reminder operation in this feature, **Then** no odometer or
   kilometer-based behavior is introduced.

---

### User Story 7 - Monitor Operational Health (Priority: P3)

As an administrator, I need a read-only operational summary and focused metrics,
so that I can quickly find stuck workflows and prioritize intervention without
claiming a production analytics platform.

**Why this priority**: Visibility reduces diagnosis time after command-based
recovery is available, but it does not itself resolve an operational incident.

**Independent Test**: This story can be tested from prepared operational data.
The dashboard reports counts and stuck cases for dispatch, assignments,
mechanics, requests, workers, dead letters, and repeated reminder failures
without changing any state.

**Acceptance Scenarios**:

1. **Given** known operational fixtures, **When** the administrator requests a
   summary, **Then** all totals reconcile with the corresponding filtered
   records.
2. **Given** overdue active rounds, offered requests with no valid offer, stale
   assignments, request/assignment mismatches, dead letters, and repeated
   reminder failures, **When** stuck workflows are requested, **Then** each case
   is reported once with its reason category and target identifier.
3. **Given** repeated dashboard reads, **When** no underlying data changes,
   **Then** no workflow, audit, notification, or outbox record is mutated.

---

### User Story 8 - Manage Optional Operational Configuration (Priority: P4)

As an administrator, I may need to view and change a bounded set of dispatch
limits and inspect read-only provider budget metadata, so that approved runtime
controls can be reviewed or changed without exposing credentials or altering
chatbot/provider behavior.

**Why this priority**: Runtime configuration is optional and lower priority. The
platform can deliver safe administration using fixed, deployed configuration.

**Independent Test**: If this slice is included, an administrator can change one
of the four allowlisted dispatch settings with a reason and see the new effective
value, while unknown keys, feature flags, provider-budget mutations, secret-like
values, and out-of-range settings are rejected.

**Acceptance Scenarios**:

1. **Given** an allowlisted operational setting, **When** an administrator
   changes it within its accepted bounds and supplies a reason, **Then** the new
   value is visible and the change is audited.
2. **Given** a request to store or return a provider credential, **When** the
   request is evaluated, **Then** it is rejected.
3. **Given** provider budget metadata, **When** an administrator reads it or
   attempts to modify it, **Then** the metadata is returned without credentials
   and the mutation is rejected without changing chatbot/provider behavior.
4. **Given** a maintenance-mode command, **When** no later explicit maintenance
   policy has been authorized, **Then** no maintenance route or runtime behavior
   is available through this feature.

### Edge Cases

- An administrator attempts to suspend, archive, or remove the admin role from
  the last active administrator, including concurrent requests from two admins.
- An administrator acts on a user, mechanic, request, offer, assignment, quote,
  reminder, notification, or event that was changed after it was read.
- A target user or mechanic is already in the requested status.
- A mechanic status change is requested while that mechanic has an active
  assignment; the command must not silently orphan or reassign the job.
- A role grant or revoke is repeated after the first request succeeded.
- A dispatch expiry and a mechanic offer acceptance race with each other.
- Two administrators attempt manual assignment or reassignment concurrently.
- A dispatch retry is requested while an unexpired active round exists.
- A request has reached the maximum round limit or is already terminal.
- A request has no location, stale relevant location, no matching skill, no
  available mechanic, only mechanics outside service radius, or only mechanics
  with active jobs.
- A request is offered but every offer is expired, rejected, canceled, or
  otherwise invalid.
- An assignment and its request disagree about state when an admin command is
  attempted.
- A diagnosis or quote revision is requested after the related workflow has
  advanced beyond a revisable state.
- A pending quote is approved by the rider while an administrator attempts to
  void or expire it.
- A failed reminder occurrence is retried concurrently by an administrator and
  a worker.
- A notification is delivered while an administrator attempts cancellation.
- An outbox lease is active when an administrator requests retry or abandon.
- A dead-letter retry is requested more than once.
- An audit export exceeds the bounded export size or includes a prohibited
  sensitive field.
- Filter values, page sizes, date ranges, note text, reasons, and configuration
  values exceed documented bounds.
- A non-admin or suspended/archived administrator invokes any admin operation.
- Existing rider, mechanic, public chatbot, or worker routes are used after the
  feature is enabled; their responses and authorization boundaries must remain
  unchanged.

## Requirements *(mandatory)*

### Functional Requirements

#### Administrative foundation and command safety

- **ADM-001**: Every capability in this feature MUST require an active actor
  holding the admin role.
- **ADM-002**: Every admin mutation MUST require a trimmed, human-readable
  reason between 10 and 500 characters.
- **ADM-003**: Every admin mutation MUST either commit all intended domain,
  history, audit, and operational-event changes or commit none of them.
- **ADM-004**: Every mutation that depends on current state MUST protect the
  target from concurrent conflicting changes and MUST re-check authorization,
  existence, and current state before committing.
- **ADM-005**: Every admin mutation MUST create an append-only audit record
  identifying the admin actor, command type, reason, target entity, outcome, and
  timestamp.
- **ADM-006**: Every workflow-affecting mutation MUST create a deduplicated
  operational event suitable for downstream processing.
- **ADM-007**: Admin commands MUST use explicit business actions; the system
  MUST NOT expose an arbitrary status setter or a general constraint-bypass
  operation.
- **ADM-008**: Admin operations MUST preserve all existing state-machine and
  uniqueness rules, including one active assignment per request and one active
  assignment per mechanic.
- **ADM-009**: No admin operation may hard-delete a user, mechanic, request,
  assignment, diagnosis, quote, reminder, notification, outbox event, or audit
  record.
- **ADM-010**: Admin-facing results MUST use bounded, admin-safe views that omit
  passwords, access or refresh tokens, raw device keys, session secrets,
  provider credentials, raw provider payloads, raw text or audio, payment
  details, and any field classified as secret.
- **ADM-011**: Every list operation MUST support validated pagination with a
  default page size of 50 and a maximum page size of 100.
- **ADM-012**: List filters MUST be allowlisted, bounded, and rejected when
  malformed rather than interpreted loosely.
- **ADM-013**: Missing, forbidden, invalid, conflicting, and retryable outcomes
  MUST be distinguishable through stable, non-sensitive error categories.
- **ADM-014**: Existing rider, mechanic, worker, and public routes MUST NOT
  return admin-only notes, audit details, operational explanations, or redacted
  admin payloads introduced by this feature.
- **ADM-015**: Repeating an already completed admin command MUST not create
  duplicate domain effects, duplicate notifications, or duplicate downstream
  work.

#### User management

- **USR-001**: Administrators MUST be able to list users using bounded filters
  for role, account status, identifier, and creation/update period.
- **USR-002**: Administrators MUST be able to view an admin-safe user detail
  containing profile status, roles, device summary, and relevant operational
  relationships without credential material.
- **USR-003**: Administrators MUST be able to suspend an eligible active user
  with a reason.
- **USR-004**: Administrators MUST be able to reactivate an eligible suspended
  user with a reason.
- **USR-005**: Administrators MUST be able to archive an eligible user with a
  reason while preserving all history and references.
- **USR-006**: Account-status changes MUST NOT silently cancel, complete, or
  reassign active business workflows.
- **USR-007**: Administrators MUST be able to list a user's devices using only
  hashed-key metadata and non-secret registration information.
- **USR-008**: Administrators MUST be able to revoke an enabled device with a
  reason; revocation MUST NOT reveal its original device key.
- **USR-009**: Administrators MUST be able to grant an existing supported role
  to an eligible user with a reason.
- **USR-010**: Administrators MUST be able to revoke an existing role from an
  eligible user with a reason.
- **USR-011**: The system MUST reject any role or account-status mutation that
  would leave zero active administrators, including concurrent mutations.
- **USR-012**: Administrators MUST be able to view a sanitized activity timeline
  for a user, ordered consistently and bounded by date and pagination.

#### Mechanic management

- **MEC-001**: Administrators MUST be able to list mechanics by profile status,
  availability, service type, location freshness category, and work-state
  category.
- **MEC-002**: Administrators MUST be able to view admin-safe mechanic details,
  verified skills, service radius, availability, location freshness, trusted
  rating aggregates, and operational history.
- **MEC-003**: Administrators MUST be able to approve an eligible pending
  mechanic with a reason.
- **MEC-004**: Administrators MUST be able to reject an eligible pending
  mechanic with a reason, leaving the mechanic in a durable non-dispatchable
  outcome.
- **MEC-005**: Administrators MUST be able to suspend an eligible mechanic with
  a reason, preventing new dispatch eligibility.
- **MEC-006**: Administrators MUST be able to ban an eligible mechanic with a
  reason, preventing new dispatch eligibility until an explicitly authorized
  future policy permits reversal.
- **MEC-007**: Administrators MUST be able to reactivate an eligible suspended
  mechanic with a reason; generic reactivation MUST NOT reverse a ban.
- **MEC-008**: Administrators MUST be able to replace a mechanic's verified
  service-type set with a validated, non-empty supported set and a reason.
- **MEC-009**: Administrators MUST be able to update a mechanic's service radius
  within the same accepted business bounds as mechanic profile management and
  with a reason.
- **MEC-010**: Administrators MUST be able to force a mechanic unavailable with
  a reason without silently canceling that mechanic's active assignment.
- **MEC-011**: Status changes that would conflict with an active assignment MUST
  be rejected until a separate valid assignment command resolves the job.
- **MEC-012**: Administrators MUST be able to view bounded work history and
  operational performance derived from trusted assignment and dispatch data.
- **MEC-013**: The feature MUST NOT permit direct setting of rating average or
  rating count; it may only display existing trusted aggregates.

#### Service-request management

- **REQ-001**: Administrators MUST be able to list service requests using
  bounded filters for status, service type, priority, rider, mechanic,
  request code, and date range.
- **REQ-002**: The main service-request detail operation MUST return an
  admin-safe request detail with embedded summaries of its current dispatch,
  assignment, quote, and reminder relationships.
- **REQ-003**: Administrators MUST be able to view the complete sanitized request
  status timeline in deterministic order.
- **REQ-004**: Administrators MUST be able to cancel a request only from states
  where the service-request state machine allows cancellation.
- **REQ-005**: Administrators MUST be able to manually escalate a request only
  from states where escalation is a valid business outcome.
- **REQ-006**: Cancel and escalation commands MUST consistently close or
  reconcile open dispatch work associated with the request.
- **REQ-007**: Administrators MUST be able to add an internal note of 1 to 2,000
  characters to a request with a mutation reason.
- **REQ-008**: Internal notes MUST be visible only through authorized admin
  operations and MUST NOT appear in rider, mechanic, chatbot, notification, or
  public responses.
- **REQ-009**: Administrators MUST be able to view request media metadata, but
  MUST NOT receive raw media through this feature.
- **REQ-010**: Administrators MUST be able to retrieve standalone admin-safe
  relationship summaries for a request's assignment and quote versions through
  dedicated relationship endpoints, even when the main request detail endpoint
  is not requested.
- **REQ-011**: The system MUST NOT provide administrators with a general request
  status setter.

#### Dispatch operations

- **DSP-001**: Administrators MUST be able to retrieve a request's current
  dispatch status, all rounds, round timing, candidate outcome summary, and
  whether a valid offer remains.
- **DSP-002**: Administrators MUST be able to retrieve one dispatch round and
  its admin-safe candidate summary.
- **DSP-003**: Administrators MUST be able to expire a round only when it is
  active and its expiry time has passed.
- **DSP-004**: Expiring a round MUST close all still-open candidates in that
  round and preserve already terminal candidate outcomes.
- **DSP-005**: Administrators MUST be able to retry dispatch only when the
  request remains dispatchable, no unexpired active round exists, and round and
  total-wait policy permit another attempt.
- **DSP-006**: Administrators MUST be able to cancel active dispatch work with a
  reason without arbitrarily changing the request to an unrelated state.
- **DSP-007**: Administrators MUST be able to list currently eligible mechanics
  for a request using the same eligibility policy applied to real assignment.
- **DSP-008**: `explainDispatchFailure` MUST return all applicable failure reason
  categories covering: no matching skill, stale mechanic location, mechanic
  unavailable, outside service radius, active mechanic job conflict, maximum
  round limit reached, request not dispatchable, and no valid offer remaining.
  It MUST return safe counts per category where meaningful and only allowlisted
  next-command categories derived from the request's current state, without
  private location history or secrets.
- **DSP-009**: A dispatch explanation MUST report reason categories and counts,
  not raw private location history or secret operational payloads.
- **DSP-010**: Administrators MUST be able to manually assign a mechanic only
  when the request is assignable and the mechanic is active, available, skill
  matched, sufficiently location-fresh when location is required, inside both
  applicable radii, and free of active-job conflict.
- **DSP-011**: Manual assignment MUST enforce the same contested assignment
  invariants as normal mechanic acceptance.
- **DSP-012**: Administrators MUST be able to reassign a request only through an
  explicit command that resolves the prior active assignment and validates the
  replacement mechanic.
- **DSP-013**: Manual assignment and reassignment MUST preserve provenance so
  that later readers can distinguish admin intervention from normal offer
  acceptance.
- **DSP-014**: The outcome of a race between expiry, acceptance, retry, manual
  assignment, or reassignment MUST have one winner and no partial or duplicate
  assignment.

#### Assignment operations

- **ASN-001**: Administrators MUST be able to view an assignment detail and its
  request, mechanic, accepted-offer provenance, diagnosis, and quote summary.
- **ASN-002**: Administrators MUST be able to view the assignment status timeline
  and admin intervention history in deterministic order.
- **ASN-003**: Administrators MUST be able to cancel an assignment only through
  a valid cancel business command for its current state.
- **ASN-004**: Administrators MUST be able to reassign an active assignment only
  after validating the request, existing assignment, and replacement mechanic
  in one contested operation.
- **ASN-005**: Reassignment MUST preserve the old assignment and history as
  historical records and MUST leave exactly one valid active assignment.
- **ASN-006**: Stuck-assignment resolution MUST accept only an allowlisted set of
  explicit actions, each mapped to an existing valid business transition or a
  separate cancellation/reassignment command.
- **ASN-007**: Administrators MUST be able to add a 1-to-2,000-character internal
  assignment note with a mutation reason.
- **ASN-008**: The system MUST NOT expose a force-status assignment operation.

#### Diagnosis, quote, and dispute operations

- **DQ-001**: Administrators MUST be able to view admin-safe diagnosis metadata
  for an assignment, including identifiers, timestamps, revision state, and
  bounded non-narrative flags; full diagnosis, recommended-work, and safety-note
  text MUST NOT be returned by this feature.
- **DQ-002**: Administrators MUST be able to view all quote versions for a
  request in deterministic version order.
- **DQ-003**: Administrators MUST be able to request diagnosis revision with a
  reason without editing or replacing the original diagnosis in place.
- **DQ-004**: Administrators MUST be able to request quote revision with a reason
  without editing an existing quote version.
- **DQ-005**: Any change to quote financial content MUST create a new quote
  version and retain all earlier versions.
- **DQ-006**: Administrators MUST be able to void an eligible pending quote
  through an explicit command that cannot affect an already approved or
  rejected version.
- **DQ-007**: Administrators MUST be able to expire an eligible pending quote
  through an explicit command and reason.
- **DQ-008**: Administrators MUST be able to resolve a quote dispute using an
  allowlisted resolution and reason; the resolution MUST NOT be an arbitrary
  request, assignment, or quote status mutation.
- **DQ-009**: Diagnosis and quote commands MUST re-check related assignment,
  request, and latest-version state before committing.
- **DQ-010**: Full diagnosis text, full internal notes, and quote-sensitive
  narrative content MUST NOT be copied into audit or outbox metadata.

#### Reminder operations

- **REM-001**: Administrators MUST be able to list reminder rules by rider,
  motorcycle, enabled state, due-time range, and failure category.
- **REM-002**: Administrators MUST be able to view a reminder rule and its
  bounded occurrence history.
- **REM-003**: Administrators MUST be able to disable an enabled reminder with a
  reason without deleting the rule or its occurrences.
- **REM-004**: Administrators MUST be able to enable an eligible disabled
  reminder with a reason and a valid future effective due time.
- **REM-005**: Administrators MUST be able to retry only a failed, retryable
  occurrence that has not already been sent or dismissed.
- **REM-006**: Reminder retry MUST remain idempotent when admin and worker
  processing overlap.
- **REM-007**: Administrators MUST be able to view reminder-worker health from
  bounded, non-secret operational facts.
- **REM-008**: This feature MUST NOT introduce odometer- or kilometer-based
  reminder behavior.

#### Notification operations

- **NOT-001**: Administrators MUST be able to list notifications by user, type,
  delivery status, error category, and date range.
- **NOT-002**: Administrators MUST be able to view a sanitized notification
  detail and its related outbox delivery summary.
- **NOT-003**: Administrators MUST be able to retry only a failed or otherwise
  explicitly retryable notification, with a reason.
- **NOT-004**: Administrators MUST be able to cancel only a pending,
  not-yet-delivered notification, with a reason.
- **NOT-005**: Notification retry and cancellation MUST coordinate with related
  outbox state so that delivery cannot be both canceled and processed.
- **NOT-006**: Administrators MUST NOT be able to submit a raw provider payload
  or mark a notification sent without a verified delivery result.
- **NOT-007**: Administrators MUST be able to view a read-only delivery summary
  by status, type, and bounded date range.

#### Outbox and dead-letter operations

- **OUT-001**: Administrators MUST be able to list outbox events by status,
  topic, aggregate type, error category, and date range.
- **OUT-002**: Administrators MUST be able to view a redacted event detail,
  attempt history summary, lease state, and aggregate identifiers.
- **OUT-003**: Administrators MUST be able to list dead-letter events with
  bounded filters and pagination.
- **OUT-004**: Administrators MUST be able to retry an eligible dead-letter
  event with a reason only when it is not actively leased.
- **OUT-005**: Administrators MUST be able to abandon an eligible pending or
  dead-letter event with a reason, producing a durable terminal operational
  outcome without deleting the event.
- **OUT-006**: Retry or abandon MUST NOT replay a domain mutation that already
  committed successfully; only the eligible downstream delivery work may be
  resumed or ended.
- **OUT-007**: Administrators MUST be able to view worker health based on
  pending, processing, retry, dead-letter, lease-expiry, and recent processing
  summaries.
- **OUT-008**: Outbox results and exports MUST redact secret material, raw text,
  raw audio, provider payloads, contact details where not operationally needed,
  and payment-sensitive data.

#### Audit query operations

- **AUD-001**: Administrators MUST be able to search audit records by actor,
  action, entity type, entity identifier, request identifier, and bounded date
  range.
- **AUD-002**: Administrators MUST be able to retrieve a deterministic,
  paginated timeline for one entity.
- **AUD-003**: Administrators MUST be able to retrieve a deterministic,
  paginated timeline for one actor.
- **AUD-004**: Administrators MUST be able to retrieve admin-action history that
  includes admin actor, command, reason, target, outcome, and timestamp.
- **AUD-005**: Administrators MUST be able to export a sanitized audit result for
  a bounded filter and a maximum of 10,000 records per export.
- **AUD-006**: Audit query and export operations MUST NOT update, delete,
  reorder, or replace source audit records. Every export MUST append a separate
  sanitized access-audit record identifying the requesting admin, filter hash,
  exported record count, and timestamp without storing exported content.
- **AUD-007**: Audit query results MUST preserve the same or stricter redaction
  policy used for operational responses.

#### Operational dashboard

- **DASH-001**: Administrators MUST be able to view a read-only operational
  summary covering users, eligible mechanics, service requests, active
  assignments, failed reminders, notifications, and outbox state.
- **DASH-002**: Administrators MUST be able to view dispatch metrics by outcome
  and bounded time range.
- **DASH-003**: Administrators MUST be able to view assignment metrics by state,
  completion outcome, and bounded time range.
- **DASH-004**: Administrators MUST be able to view mechanic operational metrics
  derived from trusted profile, dispatch, and assignment data.
- **DASH-005**: Administrators MUST be able to view service-request counts by
  state and service type.
- **DASH-006**: Administrators MUST be able to view worker failure summaries for
  outbox and reminders.
- **DASH-007**: Stuck-workflow detection MUST identify overdue active dispatch
  rounds, offered requests with no valid offer, assignments beyond their
  documented state threshold, request/assignment state mismatches, dead-letter
  events, and reminder rules with repeated failures.
- **DASH-008**: Each stuck-workflow result MUST include a reason category,
  target identifier, age or failure count, and the safe next command categories
  available to an administrator.
- **DASH-009**: Dashboard reads MUST not mutate business or operational state and
  MUST be presented as operational MVP visibility rather than financial or
  production analytics.

#### Optional operational configuration

CFG-001 through CFG-007 apply only when Patch J is explicitly authorized for
delivery. When Patch J is deferred, no configuration route, migration, or
runtime behavior is included, and CFG-008 remains applicable.

The only mutable configuration keys in Patch J are:

- `dispatch.radius_steps_km`: `array<number>` containing 1 to 8 ascending
  values; each value MUST be between 1 and 100 km; default `[2, 5, 8, 12]`.
- `dispatch.offer_expiry_seconds`: integer from 30 to 300; default `60`.
- `dispatch.max_rounds`: integer from 1 to 8; default `4`.
- `dispatch.total_wait_seconds`: integer from 60 to 1,800, MUST be greater than
  or equal to `dispatch.offer_expiry_seconds`; default `360`.

- **CFG-001**: Administrators MUST be able to view the allowlisted non-secret
  effective dispatch settings and read-only provider budget metadata.
- **CFG-002**: Administrators MUST be able to update only allowlisted dispatch
  limits listed above, within their documented bounds and with a reason.
- **CFG-003**: Provider budgets are read-only metadata in this feature. Patch J
  MUST NOT allow changes to provider budgets, feature flags, chatbot/provider
  selection, provider order, fallback, or safety behavior.
- **CFG-004**: Provider budget metadata MUST contain limits and usage metadata
  only, never credentials, and MUST NOT be accepted in a mutation payload.
- **CFG-005**: Maintenance mode behavior is deferred in this feature unless a
  later explicit policy defines blocked command categories, allowed recovery
  command categories, HTTP error category, effect on active workflows, and
  confirms that authentication, worker authorization, chatbot safety, ASR
  behavior, and emergency advice are not weakened.
- **CFG-006**: Configuration changes MUST be versioned or otherwise retain prior
  values for audit and rollback review.
- **CFG-007**: Unknown keys, feature-flag mutations, provider-budget mutations,
  maintenance-mode mutations without a later explicit policy, secret-like keys,
  out-of-range values, and changes that weaken authentication or safety MUST be
  rejected.
- **CFG-008**: Deferring the optional configuration slice MUST NOT block delivery
  of the other admin modules.

#### Existing behavior preservation and excluded scope

- **PRES-001**: Existing chatbot text and voice behavior, provider order, safety
  gate, local fallback, post-validation, rate limits, privacy-safe logging, and
  frontend behavior MUST remain unchanged.
- **PRES-002**: Existing dangerous-symptom overrides, validated diagnosis output,
  Vietnamese-first behavior, and local-ASR boundary MUST not be weakened.
- **PRES-003**: Existing rider and mechanic authorization, ownership, state
  transitions, and response boundaries MUST not regress.
- **PRES-004**: The feature MUST be backend-only and MUST NOT add rider,
  mechanic, or admin frontend UI.
- **PRES-005**: Payment is owned by feature 005, not this admin operations
  feature. This feature MUST NOT add payment routes, payment providers, payment
  repositories, payment migrations, settlement, refunds, or payment state
  advancement.
- **PRES-006**: The feature MUST NOT add inventory commerce, odometer reminders,
  live tracking UI, Maps integration, or chatbot/ASR rewrites.
- **PRES-007**: Admin operations MUST not cause AI output to book service,
  assign a mechanic, approve a quote, initiate payment, or make an operational
  decision automatically.

### Security and Privacy Constraints

- Admin authorization MUST be evaluated for every operation and MUST not rely
  solely on route naming or client-provided role claims.
- Object existence MUST not be disclosed to unauthorized actors.
- Sensitive values MUST be redacted before they enter an admin response, audit
  record, operational event, export, or log.
- Admin mutation reasons and internal notes are operational records and MUST not
  be included in rider, mechanic, chatbot, or notification content.
- Concurrent last-admin protection MUST be enforced as a platform invariant,
  not as a best-effort pre-check.
- Operational exports MUST be bounded, attributable to the requesting admin,
  and audited without copying the full exported content into the audit record.
- Full diagnosis, recommended-work, safety-note, internal-note, rider-problem,
  and chatbot text MUST NOT be returned by this feature or copied into audit,
  dashboard, outbox, export, or log views.

### Excluded Scope

- Any frontend or admin console.
- Payment checkout, settlement, reconciliation, or refunds; payment APIs are
  owned by feature 005.
- Inventory or spare-part commerce.
- Odometer- or kilometer-based reminders.
- Live location tracking, live dispatch UI, or Maps integration.
- Chatbot, ASR, AI provider-order, prompt, safety-gate, fallback,
  post-validation, rate-limit, logging, or frontend rewrites.
- Direct rating setters or review moderation; no review domain exists in this
  feature.
- Arbitrary force-status or constraint-bypass operations.
- Hard deletion of business or operational records.
- Direct mutation or deletion of audit records.
- Production-grade business intelligence or financial analytics.
- Raw provider payload submission or display.

### Key Entities

- **Admin Actor**: An active application user holding the admin role and
  authorized to issue commands or read operational views.
- **Admin Command Record**: The traceable context of an admin mutation,
  including actor, command category, reason, target, outcome, and time.
- **Application User**: Existing user profile, roles, status, and non-secret
  device relationships.
- **Mechanic Profile**: Existing mechanic eligibility, verified service types,
  service radius, availability, location freshness, and trusted rating
  aggregates.
- **Service Request**: Existing rider request and its status, dispatch,
  assignment, media metadata, quote, and reminder relationships.
- **Dispatch Round and Candidate**: Existing search attempt, timing, candidate
  eligibility snapshot, offer outcome, and operational completion state.
- **Assignment**: Existing exclusive mechanic-to-request work record and its
  status history.
- **Diagnosis and Quote Version**: Existing immutable diagnostic and commercial
  records, plus explicit revision or dispute requests where required.
- **Internal Note**: Admin-only operational context attached to a request or
  assignment; not rider- or mechanic-visible.
- **Reminder Rule and Occurrence**: Existing time-based reminder policy,
  processing state, and retry history.
- **Notification**: Existing user-facing delivery record and its safe delivery
  status.
- **Outbox Event**: Existing asynchronous event, lease, attempt, failure, and
  terminal-processing state with a redacted admin representation.
- **Audit Record**: Existing append-only, sanitized record of actor and domain
  activity.
- **Operational Summary**: Read-only counts, metrics, health indicators, and
  stuck-workflow findings derived from trusted records.
- **Operational Configuration**: Optional allowlisted, non-secret, bounded
  runtime settings and their prior values.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of admin mutations attempted by a
  non-admin or inactive admin are denied without revealing protected target
  details.
- **SC-002**: In concurrent last-admin tests, 100% of mutation races leave at
  least one active administrator and produce no partial role or status changes.
- **SC-003**: For every successful admin mutation sampled in acceptance testing,
  the target change, admin actor, reason, command, outcome, and time are
  traceable, and every required operational event exists exactly once.
- **SC-004**: Across all security test fixtures, zero prohibited secrets, raw
  device keys, raw provider payloads, raw audio, private full text, or
  payment-sensitive fields appear in admin list responses, exports, audit
  metadata, operational events, or logs.
- **SC-005**: In 100% of manual assignment and reassignment race tests, exactly
  one valid active assignment remains for both the request and the selected
  mechanic.
- **SC-006**: For every seeded dispatch-failure combination, one admin
  explanation response returns all applicable failure reason categories and
  safe counts, together with only the next command categories valid for the
  request's current state.
- **SC-007**: All overdue active dispatch-round fixtures are detected, and each
  can be safely expired or rejected as no longer eligible without leaving open
  candidate offers.
- **SC-008**: Notification, reminder, and dead-letter retry tests produce no
  duplicate rider-facing delivery or duplicate committed domain mutation under
  repeated and concurrent requests.
- **SC-009**: Audit query tests leave source audit content, ordering, and record
  count unchanged. Each successful audit export preserves all existing source
  audit records and appends exactly one sanitized export-access audit record
  containing only the requesting admin, filter hash, exported record count, and
  timestamp.
- **SC-010**: Dashboard totals reconcile exactly with the corresponding bounded
  operational records for every acceptance-test dataset.
- **SC-011**: Stuck-workflow detection finds all seeded cases in the six required
  categories with no duplicate finding for the same category and target.
- **SC-012**: Existing rider, mechanic, worker, chatbot, ASR, provider fallback,
  safety, rate-limit, logging, and frontend regression suites retain their
  pre-feature behavior.
- **SC-013**: After five warm-up requests, every bounded admin list and detail
  operation is executed 20 times against the agreed MVP operational dataset. At
  least 19 of 20 requests per operation complete within two seconds, and every
  accepted response respects its documented page or export bound.
- **SC-014**: No payment, inventory, odometer, tracking, Maps, frontend, or
  chatbot-rewrite capability is introduced by this feature.

## Assumptions

- CareOnRoad continues to use the existing application roles `rider`,
  `mechanic`, and `admin`; this feature does not introduce separate support,
  dispatcher, finance, or super-admin roles.
- “Last active administrator” means an application user whose account is active
  and who currently holds the admin role.
- Bootstrap of ordinary application profiles continues to grant rider access
  only; administrator role grants occur through authorized administrative or
  controlled provisioning paths.
- Banned mechanics are not reactivated by the generic reactivation command.
  Reversing a ban requires a separately approved future policy.
- Suspending or forcing a mechanic unavailable prevents new dispatch
  eligibility but does not silently change an active assignment.
- Admin operations reuse existing domain eligibility and transition rules;
  where an operational outcome does not yet exist, planning may add only the
  minimum durable state needed for that explicit command.
- Internal notes and revision/dispute requests may require new durable records,
  but they remain admin-only and do not replace immutable domain history.
- Location freshness and service-radius rules use the same business policy as
  normal dispatch; this feature does not create a different admin threshold.
- Assignment stuck thresholds are documented operational policies. They may be
  fixed for the initial delivery and become configurable only if the optional
  configuration slice is included.
- Outbox retry resumes downstream processing only; it does not repeat the
  original business transaction.
- Audit export is bounded to 10,000 records per request; larger exports are
  intentionally outside this feature.
- Runtime configuration is an optional final slice and may be deferred without
  reducing the readiness of all higher-priority admin modules.
- Existing notification delivery limitations remain visible as operational
  facts; this feature does not add a real external notification provider.
