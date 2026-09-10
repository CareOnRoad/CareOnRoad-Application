# Feature Specification: Data Retention Worker

**Feature Branch**: `feature/backend-dispatch-push-lifecycle`  
**Created**: 2026-08-23  
**Status**: Draft

## User Scenarios & Testing

### User Story 1 - Review before deletion (Priority: P1)

An operator runs a protected dry-run and sees bounded eligible counts per explicitly configured data class without modifying data.

### User Story 2 - Bounded policy execution (Priority: P2)

An authorized worker deletes only rows older than each class-specific confirmed period, under a lease and per-run limit.

**Acceptance Scenarios**:

1. **Given** execution is disabled or a class has no period, **When** the worker runs, **Then** that class is skipped and no destructive default is inferred.
2. **Given** execution is enabled with explicit periods, **When** dry-run is false, **Then** only eligible rows in the three allowed classes are deleted up to the limit.

### Edge Cases

- Concurrent workers: one lease holder executes; peers return busy without deletion.
- A repeated run is idempotent and reports zero after eligible rows are gone.
- Audit, payment/financial, service request, assignment, quote, review, notification, and media metadata business records are never targeted.
- Tracking data is reported unsupported because no tracking table exists.

## Requirements

- **FR-001**: The worker MUST require `X-Worker-Secret` and use a lease.
- **FR-002**: Dry-run MUST be the default and MUST never mutate retained data.
- **FR-003**: Destructive execution MUST require an explicit enable flag and a positive class-specific retention period; no deletion period has a default.
- **FR-004**: Allowed classes are expired/finalized upload-intent control rows, disabled device delivery credentials, and old worker-run metadata.
- **FR-005**: Each class MUST be queried/deleted separately with an overall 1–100 row class limit; no broad purge target is allowed.
- **FR-006**: Audit, finance/payment, and durable business records MUST be excluded.
- **FR-007**: Summaries contain only class, cutoff, eligible/deleted counts, mode, and status; no raw row/payload/token/media data.
- **FR-008**: Failures MUST release/expire the lease safely and a repeated run MUST be idempotent.

## Policy Decision

No retention duration is assumed. Operators must set one or more of:

- `RETENTION_MEDIA_UPLOAD_INTENTS_DAYS`
- `RETENTION_DEVICE_CREDENTIALS_DAYS`
- `RETENTION_WORKER_RUNS_DAYS`

Actual deletion additionally requires `DATA_RETENTION_ENABLED=true` and request `dry_run=false`.

## Success Criteria

- Dry-run changes zero rows in 100% of tests.
- Concurrent execution has at most one lease holder.
- Every deletion stays within 100 rows per class and exact cutoff.
- Static scope tests prove excluded durable tables are absent from deletion SQL.

## Out of Scope

Audit/business/payment deletion, raw media deletion (handled by existing orphan cleanup), tracking not yet implemented, UI, scheduler infrastructure.
