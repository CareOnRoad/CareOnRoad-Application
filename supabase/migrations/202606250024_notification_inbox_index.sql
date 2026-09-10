create index notifications_user_unread_created_idx
  on notifications (user_id, created_at desc, id desc)
  where read_at is null;
