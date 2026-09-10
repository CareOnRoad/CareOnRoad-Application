# Privacy Requirements Quality Checklist: Live Location Tracking

**Purpose**: Privacy/security release gate for requirements  
**Created**: 2026-08-23  
**Audience**: PR reviewer

## Data Minimization

- [x] CHK001 - Is one-point-only storage explicitly distinguished from location history? [Completeness, Spec §FR-005, FR-008]
- [x] CHK002 - Is an explicit short retention required with no implicit default? [Clarity, Spec §FR-001, FR-009]
- [x] CHK003 - Are lifecycle-triggered deletion and expiry cleanup both specified? [Coverage, Spec §FR-010]

## Authorization and Isolation

- [x] CHK004 - Are publisher and reader roles/object ownership unambiguous? [Clarity, Spec §FR-002, FR-007]
- [x] CHK005 - Are cross-assignment access and direct client database access addressed? [Security, Spec §FR-007, FR-013]
- [x] CHK006 - Are terminal/non-travel state races covered by a database invariant? [Concurrency, Spec §FR-010]

## Abuse and Replay Resistance

- [x] CHK007 - Are coordinate, accuracy, old/future timestamp bounds measurable? [Measurability, Spec §FR-003–FR-004]
- [x] CHK008 - Are monotonic replay rejection and minimum update interval explicit under concurrency? [Coverage, Spec §FR-005–FR-006]

## Disclosure Boundaries

- [x] CHK009 - Are logs, audit, outbox, errors, and worker summaries prohibited from containing raw coordinates? [Privacy, Spec §FR-012]
- [x] CHK010 - Are history, public sharing, frontend, and realtime transports clearly excluded? [Scope, Spec §FR-014]
