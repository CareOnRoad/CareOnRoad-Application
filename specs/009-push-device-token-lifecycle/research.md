# Research: Push Device Token Lifecycle

- Existing device registration stores only a hashed installation key and already
  returns a redacted device response.
- `enabled` describes the installation; push delivery credentials therefore live
  in a separate backend-only table with their own lifecycle state.
- Hash-only token storage cannot deliver notifications, while plaintext violates
  the roadmap. AES-256-GCM plus a SHA-256 fingerprint meets both needs using Node crypto.
- A partial unique index over active fingerprints prevents race duplicates.
- Existing admin device views map explicit fields, and the separate credential
  repository prevents secret fields from entering the `UserDevice` model at all.
- Existing logger sanitizer removes keys containing `token`/`credential`; services
  still must avoid raw values in thrown messages and event metadata.
