# Data Model: Health and Readiness

No persistent entity or migration is required.

Ephemeral response model:

- `HealthStatus`: `ok | ready | not_ready`
- `HealthCheckName`: `database | workers | notifications | media | payments`
- `HealthCheckStatus`: `up | configured | disabled | down | invalid`

Only fixed enum-like values cross the HTTP boundary.
