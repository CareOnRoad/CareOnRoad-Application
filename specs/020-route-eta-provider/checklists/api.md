# API Requirements Quality Checklist: Route ETA Provider

**Purpose**: Review the API, provider-failure, privacy, and cost-control requirements before implementation  
**Created**: 2026-08-23  
**Audience**: PR reviewer

## Requirement Completeness

- [x] CHK001 - Are all actors permitted to read ETA explicitly enumerated? [Completeness, Spec §FR-002]
- [x] CHK002 - Are active-state, fresh-origin, and stored-destination prerequisites specified? [Completeness, Spec §FR-003–FR-004]
- [x] CHK003 - Are both provider-success and provider-unavailable response semantics defined? [Completeness, Spec §FR-005–FR-007]

## Requirement Clarity

- [x] CHK004 - Is fallback distance clearly distinguished from a provider-computed route and duration? [Clarity, Spec §FR-007]
- [x] CHK005 - Are timestamps, TTL, source, and advisory fields required without implying an arrival guarantee? [Clarity, Spec §FR-005, FR-011]

## Scenario and Risk Coverage

- [x] CHK006 - Are timeout, quota, authentication, network, server, and malformed-response cases covered? [Coverage, Spec §FR-006]
- [x] CHK007 - Are stale/missing coordinates and terminal assignments covered before provider invocation? [Coverage, Spec §User Story 2]
- [x] CHK008 - Are cache expiry and concurrent request deduplication requirements measurable? [Measurability, Spec §FR-008, SC-003–SC-004]
- [x] CHK009 - Are provider-secret, raw-payload, and location-disclosure boundaries explicit? [Security, Spec §FR-002, FR-009]
- [x] CHK010 - Is the two-wheeler advisory requirement documented for downstream clients? [Dependency, Spec §FR-012]
