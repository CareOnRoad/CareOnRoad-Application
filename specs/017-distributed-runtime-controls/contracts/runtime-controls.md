# Internal Runtime Control Contracts

## Rate limiter

- `checkDiagnosisRequest` and `checkTranscriptionRequest` return the existing decision, synchronously or asynchronously.
- Shared failures invoke local fallback and preserve existing error/header fields.

## Provider circuit

- `isOpen`, `recordSuccess`, and `recordFailure` are awaitable.
- Provider-chain behavior remains skip-open, try next, then safe local fallback.

## Configuration

- `RUNTIME_CONTROLS_MODE=memory|postgres`, default `memory`.
- `RUNTIME_CONTROLS_TIMEOUT_MS` bounds shared operations.
- No public route is introduced.
