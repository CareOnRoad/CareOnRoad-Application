-- Historical profiles remain available to review-derived rating updates after role revoke.
-- Identity and operational changes still require the current mechanic role.
drop trigger mechanic_profiles_require_mechanic_role on mechanic_profiles;
create trigger mechanic_profiles_require_mechanic_role
  before insert or update of user_id, profile_status, is_available, service_radius_km,
    latest_location, location_updated_at, availability_updated_at, created_at
  on mechanic_profiles
  for each row execute function enforce_mechanic_profile_role();
