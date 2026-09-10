alter type assignment_status add value if not exists 'recovery_canceled';

alter table assignments
  add constraint assignments_recovery_canceled_timestamp_check
  check (status::text <> 'recovery_canceled' or (canceled_at is not null and completed_at is null));

create index assignments_recovery_canceled_idx
  on assignments (request_id, canceled_at desc, id)
  where canceled_at is not null;
