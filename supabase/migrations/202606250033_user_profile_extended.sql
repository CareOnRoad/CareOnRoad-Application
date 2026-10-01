-- Extend app_users with editable profile fields.
--
-- Rationale:
--   The CareOnRoad prototype allows riders/mechanics to keep personal data on
--   their device (mock data). To remove the mock profile address and to display
--   the phone number captured at registration, the backend needs persistent
--   columns for phone (plaintext - the column owner can already see it via
--   their auth user), address, and avatar_url.
--
-- Scope:
--   - phone: optional text, soft-validated client-side (digits, 9-13 chars).
--     Kept in addition to phone_masked (which is purely an admin search hint).
--   - address: optional free-text address (rider home/work).
--   - avatar_url: optional remote URL of the user avatar image.
--
-- No enum is added. RLS is unchanged (table was already locked down to the
-- service role); the application is the only writer via /api/v1/auth/profile.

alter table app_users
  add column if not exists phone text
    check (phone is null or phone ~ '^\+?[0-9 .\-()]{9,20}$'),
  add column if not exists address text
    check (address is null or length(address) between 1 and 500),
  add column if not exists avatar_url text
    check (avatar_url is null or length(avatar_url) between 1 and 2048);
