# Research: Dispatch Active-Workload Filtering

## Decision 1: Query active workload through AssignmentRepository

- **Decision**: Add one batch method that returns active-assignment counts for a supplied mechanic ID set.
- **Rationale**: Assignments own workload semantics, both adapters already exist, and `UnitOfWork.assignments` is available to production dispatch without new wiring.
- **Rejected**: A join in DispatchRepository mixes geographic eligibility with assignment ownership; per-mechanic locking causes N+1 queries; a materialized counter needs a migration and risks drift.

## Decision 2: Positive count means busy

- **Decision**: Use canonical `ACTIVE_ASSIGNMENT_STATUSES` and exclude any mechanic whose count is greater than zero.
- **Rationale**: This directly models the invariant and handles inconsistent historical data with more than one active row.
- **Rejected**: Duplicating active status names in dispatch ranking can drift.

## Decision 3: Ranking read is advisory; acceptance remains authoritative

- **Decision**: Do not lock workload rows during ranking. Preserve the atomic acceptance transaction and partial unique indexes as the final concurrency guard.
- **Rationale**: Workload can change after ranking. Existing service checks, database conflict normalization, transaction retry, and constraints safely resolve races.

## Decision 4: No external API or schema change

- **Decision**: Keep dispatch request/response contracts and database schema unchanged.
- **Rationale**: Existing assignment indexes support the grouped query and workload is internal data that must not leak job details.

## Production gap found

`DispatchService` currently defaults an optional workload callback to an empty
map, while production constructs the service without that callback. Some tests
inject fake maps and do not exercise production wiring. Implementation removes
that silent path and validates default construction with persisted assignments.
