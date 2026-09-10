# Research: Assignment Recovery and Re-dispatch

## Decision 1: Distinct terminal assignment status

**Decision**: Add `recovery_canceled` rather than reuse `canceled`.  
**Rationale**: Ordinary cancellation currently synchronizes the request to terminal `canceled`; recovery must preserve a non-terminal request and make operational history explicit.  
**Alternatives considered**: Reuse `canceled` with a reason (ambiguous and conflicts with current mapping); delete the assignment (destroys history).

## Decision 2: Eligible lifecycle window

**Decision**: Allow only `accepted` and `en_route`.  
**Rationale**: These cover decline-after-accept/no-show/lost-contact without unwinding diagnoses, quotes, payments, or started work.  
**Alternatives considered**: Allow all active states (unsafe financial/business rollback); accepted only (does not cover lost contact en route).

## Decision 3: Durable dispatch handoff

**Decision**: Emit `assignment.recovery.requested` and consume it through the existing outbox worker.  
**Rationale**: Recovery remains atomic while dispatch restart is retryable after commit. Existing outbox leases/dead-letter behavior handles process failure.  
**Alternatives considered**: Nested service transaction after recovery (partial failure); direct round creation inside recovery (duplicates dispatch rules and couples locks).

## Decision 4: Idempotency boundary

**Decision**: Scope by actor and assignment, with request hash covering reason; return the completed response on replay.  
**Rationale**: Matches existing mutation conventions and prevents the same key from changing reason.  
**Alternatives considered**: Rely only on terminal state (cannot distinguish retry from conflicting second command).
