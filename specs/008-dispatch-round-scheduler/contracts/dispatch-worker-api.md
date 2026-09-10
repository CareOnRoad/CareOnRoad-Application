# Contract: POST /api/v1/internal/workers/dispatch/run

## Authority

Requires `X-Worker-Secret`; optional `X-Worker-Id` identifies lease owner.

## Success

HTTP 202:

```json
{"claimed":2,"advanced":1,"escalated":1,"skipped":0,"failed":0}
```

No request, rider, mechanic, coordinate, secret, or candidate detail is returned.

## Repository claim

Claim only active rounds with `expires_at <= now` and absent/expired lease,
ordered by expiry then ID, limited by batch size, with skip-locked semantics.
Failed items release their own lease for later retry.
