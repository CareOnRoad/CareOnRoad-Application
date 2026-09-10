# Research: Distributed Runtime Controls

## Shared store

- **Decision**: Use existing PostgreSQL atomic upserts/functions.
- **Rationale**: Already required, cross-instance consistent, and adds no dependency/provider credential.
- **Alternatives**: Redis/external cache offers native expiry and lower latency but adds an unapproved service, dependency, secret, and operating plan; memory cannot coordinate instances.

## Failure behavior

- **Decision**: Shared mode is opt-in and every failed shared operation falls back to the existing process-local control.
- **Rationale**: Chatbot availability and safe local fallback must survive database incidents. Controls are abuse mitigation, not authorization.
- **Alternatives**: Fail closed denies all chatbot use; unbounded fail open removes controls entirely.

## Privacy and expiry

- **Decision**: Hash purpose-prefixed keys, store only counts/timestamps/provider names, ignore expired rows immediately, clean at most 100 per call.
- **Rationale**: Coordination does not require content or reversible identifiers.

## Compatibility

- **Decision**: Generalize route limiter and circuit interfaces to awaitable operations while retaining synchronous in-memory methods.
- **Rationale**: Existing unit tests/default behavior remain compatible; PostgreSQL can be awaited.
