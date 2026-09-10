# Data Model: Route ETA Provider

This feature adds no persistent table.

## Route ETA context (read model)

- Assignment/request/mechanic IDs and current status.
- Owning rider ID for authorization.
- Origin coordinate and update timestamp from mechanic profile.
- Destination coordinate from service request.

## Route estimate (ephemeral)

- `status`: `available`, `fallback`, or `unavailable`.
- `source`: `google_routes`, `straight_line_fallback`, or `none`.
- Optional positive distance; optional positive duration only for provider routes.
- Calculation/expiry timestamps and optional safe unavailability reason.
- Stable advisory warning code/text.

## Cache entry (process-local)

- Key: assignment ID plus exact origin/destination snapshot.
- Value: provider-neutral estimate; expiry is calculation time plus TTL.
- In-flight Promise entry removed after settlement.

Authorization and active-state are intentionally not cached.
