# Security Checklist

- [x] Session ID alone never grants production access
- [x] Raw credential never enters persistence/audit/outbox/logging
- [x] Constant-time hash comparison is used in memory; SQL compares fixed hashes
- [x] Failure response does not disclose session existence
- [x] Claim requires credential plus authenticated active app user
- [x] Cookie is HttpOnly, SameSite=Lax, session-scoped path, Secure in production
