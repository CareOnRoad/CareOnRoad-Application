# Quickstart

1. Create a session and retain the response cookie.
2. Send message/transcription/latest diagnosis requests with that cookie; expect normal behavior.
3. Repeat with no/wrong cookie; expect the same 404 response.
4. Claim with valid bearer identity plus cookie, then access with that bearer identity.
5. Run focused security, full unit, DB integration, typecheck, lint, and build gates.
