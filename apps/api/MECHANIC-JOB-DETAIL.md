# Mechanic job detail

`GET /api/v1/mechanics/me/jobs/{assignmentId}` requires a Supabase JWT for an
active app user with the current mechanic role. The assignment must belong to
that mechanic. Admin supervision continues through admin routes; rider detail
continues through the owner service-request route. No idempotency key is needed
for this read. Responses use `Cache-Control: private, no-store`.

The response contains:

- `assignment`: existing assignment DTO, including status, schedule, reservation,
  activation and agreement IDs.
- `request`: code, type, fulfillment mode, status, problem description and schedule.
  Active work also includes the stored service coordinates and address, when present.
- `motorcycle`: ID, brand/model/year, and active-work license plate when present.
  Archived motorcycles remain readable as historical vehicle summaries.
- `latest_quote`: latest quote belonging to this assignment, using the existing
  quote DTO. Quote versions from other assignments are excluded.
- `agreements`: relevant approved labor quote references/content and rescue payment
  timing, when recorded. Payment orders, provider results and ledger data are excluded.
- `completion_checklist`: latest revision, approved quote basis, work summary,
  safety checklist and timestamp. Private checklist notes are excluded.
- `media`: at most the 20 latest finalized request/current-assignment upload
  references, plus `has_more`. Each reference has upload-intent/media IDs, resource
  type, purpose, MIME, size and timestamp. Pending/expired uploads and another
  assignment's field media are excluded. These are opaque references, not signed
  download URLs. Raw storage paths, buckets, checksums and provider responses are
  excluded. The detail endpoint does not fetch image bytes or call a storage provider.
- `sensitive_details_redacted`: true for completed/canceled/recovery-canceled work.
  Terminal detail retains job/vehicle/quote/checklist summaries and omits coordinates,
  address, plate and media references immediately. Existing retention can remove
  upload records independently; this API does not extend their lifetime.

Internal admin notes, rider/device contact details and credentials are never part
of this DTO. Jobs list/dashboard summaries retain their smaller existing shape.
The detail composes a fixed number of repository queries; quote history is not
loaded, and media is bounded. Request/assignment locks serialize the read with
cancel/recovery so terminal redaction uses the current workflow state.

Missing/invalid JWT returns 401; inactive/former mechanic or another mechanic's
assignment returns 403; invalid UUID returns 400; missing assignment/request
returns 404. Terminal ownership still requires the current mechanic role.

The service can be reconstructed from PostgreSQL after restart without relying
on open offers. Local verification covers service/route/UoW/SQL behavior with a
test authenticator; deployed HTTP/JWT/provider/device E2E remains Batch 14.

Batch 10 assignment DTOs add `source` (`offer`, `admin_manual`,
`admin_reassignment`) and nullable `accepted_candidate_id` for manual sources.
No client should infer a fabricated offer from a manual assignment. See
[admin recovery operations](./ADMIN-RECOVERY-OPERATIONS.md).
