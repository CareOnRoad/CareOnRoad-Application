# Feature Specification: Media Signed Upload

**Feature Branch**: `feature/backend-dispatch-push-lifecycle`

**Created**: 2026-08-23

**Status**: Draft

**Input**: Add secure signed upload intents for service-request and assignment images, followed by verified metadata finalization and orphan cleanup.

## User Scenarios & Testing

### User Story 1 - Request a Bound Upload Intent (Priority: P1)

As a rider who owns a service request, or the mechanic assigned to an assignment, I can request a short-lived upload intent for one allowlisted image.

**Why this priority**: The backend must authorize and choose the storage path before any client can upload field evidence.

**Independent Test**: Request intents as an owner, assigned mechanic, unrelated actor, and admin; verify authorization, server-generated private path, content/size/checksum validation, expiry, and per-resource quota.

**Acceptance Scenarios**:

1. **Given** an authorized rider or assigned mechanic, **When** valid image metadata is submitted, **Then** the backend returns a signed upload URL and a server-owned object reference.
2. **Given** an unrelated actor or arbitrary path/bucket fields, **When** an intent is requested, **Then** access is denied or the unknown fields are rejected without disclosing private data.
3. **Given** an unsupported MIME type, invalid SHA-256, oversized file, or exhausted quota, **When** an intent is requested, **Then** no signed URL is issued.

---

### User Story 2 - Finalize Verified Media (Priority: P2)

As the actor who created an upload intent, I can finalize it only after the exact object has been uploaded and verified.

**Why this priority**: Existing media tables must contain trusted storage references rather than arbitrary client-provided URLs.

**Independent Test**: Finalize against a fake provider returning missing, mismatched type, mismatched size, mismatched digest, and exact metadata; verify only the exact case creates existing request/assignment media metadata once.

**Acceptance Scenarios**:

1. **Given** an unexpired intent and matching object, **When** finalize is called, **Then** the object is linked through the existing metadata model and the intent becomes finalized atomically.
2. **Given** a missing or mismatched object, **When** finalize is called, **Then** no media metadata is created and the object is removed when unsafe.
3. **Given** a finalized intent, **When** finalize is retried, **Then** the same safe result is returned without duplicate metadata, audit, or outbox effects.

---

### User Story 3 - Clean Expired Orphans (Priority: P3)

As an operator, I can run a protected worker that expires stale intents and removes their exact orphan objects.

**Why this priority**: Direct uploads can be abandoned before finalization and must not accumulate indefinitely.

**Independent Test**: Seed expired and live pending intents, run the worker with correct and incorrect secret, and verify only expired exact paths are removed and marked expired with retry-safe behavior.

**Acceptance Scenarios**:

1. **Given** expired pending intents, **When** the protected cleanup worker runs, **Then** it leases a bounded batch, removes exact object keys if present, and marks each intent expired.
2. **Given** a live or finalized intent, **When** cleanup runs, **Then** its object and state are unchanged.
3. **Given** an invalid worker secret, **When** cleanup is requested, **Then** no intent or object is changed.

### Edge Cases

- MIME extension and declared MIME disagree.
- Object is uploaded after application intent expiry but before cleanup.
- Two finalize requests race for one intent.
- Storage returns a response larger than the declared size while streaming verification.
- Object key contains encoded traversal or client sends bucket/path-like fields.
- Storage is temporarily unavailable during signing, verification, or deletion.

## Requirements

### Functional Requirements

- **FR-001**: Every operation MUST authenticate the actor and enforce request ownership or active assignment membership; admin role MUST NOT grant implicit upload authority.
- **FR-002**: The backend MUST generate the bucket and object key from normalized server values containing actor, resource type, resource ID, intent ID, and allowlisted extension.
- **FR-003**: Create-intent input MUST reject bucket, path, object key, URL, raw bytes, base64, unsupported MIME, non-positive/oversized size, invalid SHA-256, and excessive pending/finalized file count.
- **FR-004**: Supported types MUST be limited to JPEG, PNG, and WebP with a default maximum size of 8 MiB, five media items per resource, and a ten-minute application intent lifetime.
- **FR-005**: The provider MUST return a direct signed upload URL without exposing the service-role credential.
- **FR-006**: Finalize MUST download/stream the exact private object through the backend provider only for verification, compute SHA-256, and compare exact content type, byte size, and digest before persisting metadata.
- **FR-007**: Finalize MUST atomically mark one intent finalized and create exactly one existing request-media or assignment-media metadata row with a private storage reference.
- **FR-008**: Finalize replay and concurrent finalize MUST not duplicate metadata, audit, outbox, or quota counts.
- **FR-009**: Failed verification MUST not create metadata and MUST attempt removal of the exact unsafe object.
- **FR-010**: A worker-secret-protected cleanup route MUST lease bounded expired intents, remove only their exact object keys, and mark them expired with retry-safe behavior.
- **FR-011**: Raw bytes, signed URLs, provider tokens, service-role credentials, and full checksums MUST NOT be stored in PostgreSQL audit/outbox payloads or logged.
- **FR-012**: Provider failures MUST map to controlled retryable API errors without leaking provider response bodies.
- **FR-013**: The storage bucket MUST be private and independently configured with matching MIME and size restrictions.
- **FR-014**: Frontend upload UI, image processing, moderation, thumbnails, and public media URLs remain out of scope.

### CareOnRoad Backend Workflow Requirements

- **BE-001**: Use existing Supabase authentication, transaction/UoW, idempotency, audit, outbox, and worker-secret patterns.
- **BE-002**: Use a provider interface with production Supabase Storage and deterministic fake adapters.
- **BE-003**: Keep route handlers thin and preserve existing request/assignment workflow authorization.
- **BE-004**: Use a versioned migration with constraints, indexes, RLS enabled, and direct table privileges revoked.

### Key Entities

- **Media Upload Intent**: Actor-bound, resource-bound, expiring authorization for one exact storage object and declared verification metadata.
- **Storage Object Inspection**: Ephemeral provider result containing observed content type, byte count, and computed SHA-256.
- **Finalized Media Metadata**: Existing request or assignment media record linked exactly once to an intent.
- **Cleanup Lease**: Short bounded claim that prevents workers from processing the same expired intent concurrently.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Authorization tests show zero cross-owner, cross-assignment, admin-bypass, bucket override, or path traversal successes.
- **SC-002**: Every mismatch across MIME, byte count, and SHA-256 yields zero persisted media rows.
- **SC-003**: Twenty concurrent finalization attempts produce exactly one media row and one finalized intent.
- **SC-004**: Cleanup removes only expired orphan paths and can be replayed without additional destructive effects.
- **SC-005**: Privacy regression tests find zero raw bytes, signed tokens, service-role keys, or full checksums in logs, audit, outbox, and API responses after finalization.

## Assumptions

- The storage bucket is private and provisioned separately from application migrations because Supabase Storage schema must remain API-managed/read-only.
- Supabase signed upload URLs may remain provider-valid for up to two hours; the application accepts finalization only within its stricter ten-minute intent window.
- Verification streams at most 8 MiB and never persists the bytes.
- Request images are rider-owned request evidence; assignment images are accepted only from the currently assigned mechanic while the assignment is active.
