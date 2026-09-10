# Data Model: Rider Review and Mechanic Rating

## `service_reviews`

- `id uuid` primary key
- `assignment_id uuid` unique
- `request_id uuid`
- `rider_id uuid`
- `mechanic_id uuid`
- `rating smallint` check 1-5
- `comment text` nullable, trimmed length 1-1000
- `created_at timestamptz`

Identity constraints:
- `(assignment_id, request_id, mechanic_id)` references the exact assignment.
- `(request_id, rider_id)` references the request owner.
- one assignment has one review.
- immutable trigger rejects update/delete.

## Mechanic aggregate

`mechanic_profiles.rating_avg` and `rating_count` remain dispatch/read-model fields,
but are recomputed solely from `service_reviews`.

```text
rating_avg = COALESCE(ROUND(AVG(service_reviews.rating), 2), 0)
rating_count = COUNT(service_reviews.id)
```
