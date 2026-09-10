# Research: Operational Monitoring

## Worker-run source

**Decision**: Persist explicit append-only run records.  
**Rationale**: Inferring invocations from business/audit rows is incomplete and can falsely report health.  
**Alternatives**: External telemetry only (not available in current local/hosted scope); audit-log inference (misleading).

## Cursor design

**Decision**: Opaque base64url cursor over `(created_at,id)` with strict decode validation.  
**Rationale**: Stable pagination without exposing SQL or accepting arbitrary filters.

## Privacy

**Decision**: Dedicated select lists and response DTOs; never select raw outbox payload or private request/payment fields.  
**Rationale**: Redaction after broad selects is easier to regress.
