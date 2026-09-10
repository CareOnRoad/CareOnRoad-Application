# HTTP Contract

`POST /api/v1/internal/workers/retention/run`

Headers: `X-Worker-Secret`, optional `X-Worker-Id`.  
Body: `{ "dry_run": true, "limit": 25 }` (both optional; dry-run defaults true).

Response: `{worker_id, mode, status, classes:[{data_class,status,cutoff?,eligible,deleted}]}`. No record IDs or payloads are returned.

`dry_run=false` while execution is disabled returns controlled conflict and deletes nothing.
