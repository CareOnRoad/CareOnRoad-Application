# Feature Specification: Notification Inbox API

**Feature Branch**: `feature/backend-dispatch-push-lifecycle`

**Created**: 2026-08-23

**Status**: Draft

**Input**: Add an authenticated, owner-only notification inbox with cursor pagination, unread filtering/count, and idempotent read mutations.

## User Scenarios & Testing

### User Story 1 - Browse My Notification Inbox (Priority: P1)

As an authenticated user, I can browse only my notifications in newest-first pages and optionally restrict the list to unread items.

**Why this priority**: Persisted and delivered notifications need an owner-visible retrieval path.

**Independent Test**: Seed notifications for two users, paginate the first user's inbox with an unread filter, and verify stable order, ownership, bounded page size, and safe response fields.

**Acceptance Scenarios**:

1. **Given** notifications for multiple users, **When** one user lists the inbox, **Then** only that user's items are returned newest first.
2. **Given** more items than the page limit, **When** the next cursor is supplied, **Then** the next page has no duplicates or gaps.
3. **Given** unread filtering, **When** the inbox is listed, **Then** items with a read timestamp are excluded.

---

### User Story 2 - Read State and Unread Count (Priority: P2)

As an authenticated user, I can see my unread count and mark one owned notification read without changing its delivery state.

**Why this priority**: Users need consistent read badges and item-level acknowledgement.

**Independent Test**: Mark one item twice and verify one stable read timestamp, reduced unread count, unchanged sent/failed status, owner enforcement, and sanitized audit.

**Acceptance Scenarios**:

1. **Given** an unread owned item, **When** it is marked read, **Then** it receives one server timestamp and delivery status is unchanged.
2. **Given** an already-read item, **When** it is marked read again, **Then** the original timestamp and response remain stable.
3. **Given** another user's item, **When** access is attempted, **Then** no notification content is disclosed.

---

### User Story 3 - Mark Current Inbox Read (Priority: P3)

As an authenticated user, I can mark all notifications that currently exist in my inbox read in one idempotent operation.

**Why this priority**: Bulk acknowledgement is useful after returning to many accumulated notifications.

**Independent Test**: Capture a cutoff, run mark-all twice, and verify only the caller's notifications at or before the cutoff change and no recursive outbox event is created.

**Acceptance Scenarios**:

1. **Given** multiple unread owned items, **When** mark-all executes, **Then** all items existing at the operation cutoff are read with one server timestamp.
2. **Given** a concurrent notification created after the cutoff, **When** mark-all commits, **Then** the new item remains unread.
3. **Given** a replay, **When** no unread item remains before the cutoff, **Then** the operation succeeds with zero updates.

### Edge Cases

- Malformed or stale cursor.
- Requested page limit outside bounds.
- Notification metadata contains a key now considered sensitive.
- Admin or mechanic attempts to read another user's content.
- Delivery status changes concurrently with read state.

## Requirements

### Functional Requirements

- **FR-001**: The API MUST authenticate every inbox operation and scope all reads/mutations to the caller's user ID.
- **FR-002**: The API MUST list notifications newest first using deterministic cursor pagination with a bounded limit and optional unread-only filter.
- **FR-003**: The API MUST return the caller's unread count.
- **FR-004**: The API MUST mark one owned notification read idempotently while preserving its first read timestamp.
- **FR-005**: The API MUST mark all caller notifications existing at a server cutoff read, idempotently and without affecting later notifications.
- **FR-006**: Read mutations MUST NOT change delivery status, sent timestamp, or delivery error code.
- **FR-007**: Read mutations MUST append sanitized audit records and MUST NOT emit notification or outbox events.
- **FR-008**: Responses MUST omit dedupe keys, provider credentials, delivery receipts, internal errors, and sensitive metadata.
- **FR-009**: Ownership failures MUST not disclose whether another user's notification exists.
- **FR-010**: Admin role MUST NOT grant cross-user inbox content access through these endpoints.
- **FR-011**: Frontend UI and notification preferences remain out of scope.

### CareOnRoad Backend Workflow Requirements

- **BE-001**: Use existing Supabase authentication and repository/UoW boundaries.
- **BE-002**: Keep route handlers thin and map controlled errors consistently.
- **BE-003**: Preserve existing notification provider delivery and all chatbot/ASR/payment workflows.

### Key Entities

- **Inbox Notification**: Owner-safe view of a persisted notification and its independent read state.
- **Inbox Cursor**: Opaque position composed from creation timestamp and stable identifier.
- **Read Audit**: Sanitized mutation evidence containing resource ID and affected count only.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Pagination tests traverse 100 notifications without duplicates, gaps, or cross-user records.
- **SC-002**: Repeating mark-one or mark-all produces zero additional read-state changes after the first successful call.
- **SC-003**: Delivery status remains identical before and after every read-state mutation test.
- **SC-004**: Responses/audit contain zero dedupe keys, provider credentials, raw delivery errors, or forbidden metadata.
- **SC-005**: All unauthorized cross-owner attempts return a controlled non-disclosing error.

## Assumptions

- Existing notifications already persist `read_at` independently from delivery status.
- Cursor format is opaque to clients and may be rejected when malformed.
- Mark-all uses the request's server timestamp as a cutoff so concurrently created later items remain unread.
