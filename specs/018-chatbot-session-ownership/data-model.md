# Data Model

`chatbot_sessions` gains:

- `owner_credential_hash`: nullable 64-character lowercase SHA-256 digest; new sessions require it at service level.
- `owner_claimed_at`: nullable timestamp, present when `owner_user_id` is set through claim.
- Index on `owner_user_id` for authenticated access.

Claim transition: anonymous credential-owned → user-owned. It cannot transition to another user or back to anonymous.
