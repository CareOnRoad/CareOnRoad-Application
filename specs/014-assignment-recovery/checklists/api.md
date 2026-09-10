# API Requirements Quality Checklist: Assignment Recovery

**Purpose**: Reviewer gate for authorization, lifecycle, and recovery API requirements  
**Created**: 2026-08-23

## Authorization and Scope

- [x] CHK001 Are actor-specific reason permissions explicitly defined? [Spec §FR-002]
- [x] CHK002 Are ownership, active-actor, and forbidden-role requirements documented? [Spec §BE-001]
- [x] CHK003 Is post-quote/payment recovery explicitly excluded? [Spec §FR-001, §FR-009]

## Consistency and Recovery

- [x] CHK004 Are atomic state, history, audit, and outbox requirements consistent? [Spec §FR-003]
- [x] CHK005 Are retry, replay, and concurrent handoff requirements measurable? [Spec §FR-004, §FR-007]
- [x] CHK006 Is partial worker failure behavior specified without unsafe rollback? [Spec §Edge Cases]
- [x] CHK007 Are privacy and redaction requirements defined for every output surface? [Spec §FR-010]
