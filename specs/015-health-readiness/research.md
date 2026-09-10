# Research: Health and Readiness

## Probe authentication

**Decision**: Unauthenticated internal-path probes with a minimal fixed schema.  
**Rationale**: Deployment platforms require reliable probes before application auth is ready; fixed redacted data prevents useful disclosure.  
**Alternative**: Worker-secret authentication complicates platform probes and turns secret rotation into false downtime.

## Dependency behavior

**Decision**: PostgreSQL connectivity is mandatory; optional providers are configuration-validated only when enabled or partially present.  
**Rationale**: `/api/v1` cannot operate without PostgreSQL, while real external calls could cost money or mutate state.  
**Alternative**: Call each provider (unsafe/destructive); ignore partial config (hides deployment mistakes).

## Timeout

**Decision**: One bounded readiness deadline, default 1500 ms and clamped to 100–5000 ms.  
**Rationale**: Stable orchestration behavior without unbounded connection waits.  
**Alternative**: Per-provider long timeouts (slow and nondeterministic).
