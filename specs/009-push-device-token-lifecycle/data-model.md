# Data Model: Push Device Token Lifecycle

## device_delivery_credentials

| Field | Rule |
|---|---|
| `device_id`, `user_id` | composite FK guarantees device ownership |
| `provider` | `fcm`, `apns`, or `webpush` |
| `credential_ciphertext` | nullable base64 encrypted credential |
| `credential_iv`, `credential_tag` | nullable GCM nonce and authentication tag |
| `credential_fingerprint` | 64-char SHA-256 hex, never returned |
| `credential_version` | version guard for stale provider invalidation |
| `enabled` | true only while encrypted delivery material exists |
| `disabled_at`, `disabled_reason` | required after disable |

Partial unique indexes enforce one active credential per device and one active
fingerprint globally. Disabling clears ciphertext, IV, and tag
(crypto-erasure), while retaining non-delivery lifecycle metadata. The existing
`user_devices` table remains redacted and gains no push secret columns.
