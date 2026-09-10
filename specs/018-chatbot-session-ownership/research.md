# Research: Chatbot Session Ownership

- **Credential**: 32 random bytes encoded base64url, SHA-256 persisted. UUID entropy alone is not treated as authorization.
- **Browser transport**: HttpOnly, SameSite=Lax cookie scoped to the created session path; explicit header supports API clients. JavaScript never needs the token.
- **Authenticated binding**: Separate claim command requires the current anonymous credential and a verified active app user; same-owner replay is idempotent, different-owner replay conflicts.
- **Denial**: Return generic session-not-found for absent/wrong credentials and legacy rows to reduce enumeration.
- **Legacy**: No insecure grace period; old clients naturally create a replacement session after denial.
