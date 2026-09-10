# Push Token API Contract

## POST /api/v1/auth/devices

Existing fields remain valid. Optional paired fields: `push_token`,
`push_provider`. Response adds `push_token_registered: boolean` only.

## PUT /api/v1/auth/devices/{deviceId}/push-token

Authenticated owner body: `{ "push_token": "...", "push_provider": "fcm" }`.
Returns device ID, platform, enabled, provider, registered boolean, and timestamp.

## DELETE /api/v1/auth/devices/{deviceId}/push-token

Authenticated owner revoke. Returns the same redacted shape with
`push_token_registered: false`.

No response or error includes raw token, ciphertext, IV, tag, encryption key, or
full fingerprint.
