# Service location and scheduled visits

Migration `202606250037_service_request_coordinates.sql` is required before this
API version is enabled. Apply and verify it through the release checklist.

Every new request requires `location: { latitude, longitude }`. Address text
does not replace coordinates. At-home and `other/scheduled_visit` also require
`address_text` and a future `scheduled_start_at`. Emergency rescue and mobile
repair remain immediate; maintenance retains its existing reminder exception.

Owner `PATCH /api/v1/service-requests/{requestId}` requires `X-Idempotency-Key`.
It accepts `location`, `address_text`, and `scheduled_start_at` before any dispatch
round, assignment, quote, or unresolved payment. Only `submitted` and legacy
`manual_escalation` requests are editable. Editing escalation preserves its state;
admin retry remains a separate operation. Only submitted maintenance emits the
maintenance matching event. Other services still use the dispatch endpoint.

Every scheduled offer acceptance requires `estimated_duration_minutes` (integer
15–480). The reservation is `[appointment - 30 minutes, appointment + duration +
30 minutes)`. Immediate acceptance keeps its existing optional duration. Future
reservations do not occupy the current work slot. Travel activation is allowed
from exactly 30 minutes before the appointment through its scheduled start,
inclusive. Later activation returns 409 and retains the reservation for admin
investigation. Activation requires a current mechanic role, active profile, and
an empty current work slot. Existing quote/payment commitments still apply.

Maintenance notification types/dedupe keys remain compatible. At-home and other
scheduled visits use `appointment.*` notifications without maintenance wording.

## Legacy inventory and reviewed repair

`pnpm.cmd run preflight:schema --test --inventory` performs a read-only inventory
on the isolated test DB. Omit `--test` only for an authorized read-only target
check. The report includes missing coordinates, active scheduled work without
reservation fields (including traveled legacy work), and overdue unactivated
appointments. It never repairs data automatically and hashes reported IDs.

Admin `POST /api/v1/admin/service-requests/{requestId}/repair-reservation` requires
`X-Idempotency-Key` and this body:

```json
{
  "assignment_id": "<assignment UUID>",
  "reason": "Duration confirmed with mechanic; reviewed booking",
  "estimated_duration_minutes": 60,
  "dry_run": true
}
```

`dry_run` defaults to true and writes nothing. Review the IDs and calculated
window before explicitly setting false. Repair only supports legacy at-home/other
future accepted bookings: no recorded travel, activation, quote, agreement,
unresolved money, or overlapping reservation, with coordinates and an eligible mechanic. Commit
rechecks under request/profile/assignment locks, uses the native DB exclusion,
and appends audit/outbox with idempotent replay. It changes reservation fields
without rewriting status history. Traveled, overdue, or overlapping work returns
a bounded reason code and remains available for admin investigation/cancellation
under existing commitment guards. Location-less already matched legacy jobs must
be investigated/canceled under those guards and recreated with coordinates;
this command does not invent a location. Acceptance and scheduled activation also
reject missing coordinates. Reassign/retry commands belong to later batches.

No production repair or migration is part of local batch verification. Clients
that previously submitted address-only requests or accepted scheduled offers
without a duration must send the new required fields.
