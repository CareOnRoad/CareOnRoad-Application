# Data Model: Distributed Runtime Controls

## Runtime rate bucket

- Hashed logical key primary key, existing scope, non-negative count, reset time, update time.
- Atomic consume resets expired buckets or increments active buckets.

## Provider circuit state

- Provider name primary key, non-negative failure count, optional open-until, update time.
- Success clears state; failure atomically increments and opens at threshold; expired open state is closed.

## Privacy

No raw IP/session ID, message, audio, token, secret, error, or provider payload is stored. Both entities are ephemeral and eligible for bounded expiry cleanup.
