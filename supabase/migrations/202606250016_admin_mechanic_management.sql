alter type mechanic_profile_status add value if not exists 'rejected' after 'active';

create index mechanic_profiles_admin_status_available_updated_idx
  on mechanic_profiles (profile_status, is_available, updated_at desc, user_id);

create index assignments_mechanic_history_idx
  on assignments (mechanic_id, created_at desc, id);
