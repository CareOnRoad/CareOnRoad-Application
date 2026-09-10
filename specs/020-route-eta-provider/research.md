# Research: Route ETA Provider

## Google Routes as the initial adapter

- **Decision**: Use Google Routes REST `ComputeRoutes` with `travelMode=TWO_WHEELER` and field mask `routes.distanceMeters,routes.duration`.
- **Rationale**: The selected architecture favors motorcycle-aware routing. Google documents a distinct motorized two-wheeler mode and server REST contract.
- **Alternatives considered**: Mapbox Directions lacks a motorcycle-specific mode; OSRM requires routing infrastructure and has no configured traffic source.

## Advisory warning

- **Decision**: Return a stable warning code/text with every provider result.
- **Rationale**: Google marks two-wheeler routing as beta/region-dependent and requires a warning when such routes are displayed.

## Failure and fallback contract

- **Decision**: Normalize disabled, timeout, quota, authentication, network, server, no-route, and malformed responses. With usable coordinates, return Haversine distance and no duration; otherwise unavailable.
- **Rationale**: Preserves useful distance without fabricating duration and isolates routing failures from dispatch.
- **Alternatives considered**: Generic 500 couples provider health to assignment reads; derived fallback duration implies unjustified certainty.

## Cache and deduplication

- **Decision**: Use a bounded process-local TTL cache plus an in-flight Promise map keyed by assignment and coordinate snapshot.
- **Rationale**: Results are advisory and short-lived; no dependency is needed. Authorization/state checks remain outside cache.
- **Alternatives considered**: PostgreSQL cache adds write volume; distributed cache requires new infrastructure.

## Secret and logging boundary

- **Decision**: Read the API key only in the server adapter factory; never include headers, raw provider bodies, or precise coordinates in logs/audit/outbox.
- **Rationale**: Satisfies secret isolation and location privacy constraints.
