# Contract: Health API

## GET `/api/v1/internal/health/live`

`200 { "status": "ok" }`

## GET `/api/v1/internal/health/ready`

Ready: `200`

```json
{"status":"ready","checks":[{"name":"database","status":"up"}]}
```

Not ready: `503`

```json
{"status":"not_ready","checks":[{"name":"database","status":"down"}]}
```

The response never includes duration, URL, account/project/provider ID, raw error, SQL, secret, or stack trace.
