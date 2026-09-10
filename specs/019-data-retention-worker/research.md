# Research: Data Retention Worker

- **No default periods**: Regulatory/business policy was not supplied, so absence means skip; it never means a conventional 30/90-day delete.
- **Allowed rows**: Upload-intent control rows in `expired/finalized`, disabled delivery credentials, and worker run metadata. Final media metadata and durable notification/business records stay intact.
- **Lease**: One database lease row prevents parallel destructive batches. Lease expiration permits recovery after crashes.
- **Dry-run**: Uses the same cutoff/status predicates and bounded selection as delete, but performs count-only reads.
- **Append-only worker runs**: Migration narrows the previous mutation trigger to update-only so explicit retention delete is possible; application APIs still expose no update/delete operation.
