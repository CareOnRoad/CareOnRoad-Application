-- Future appointments reserve time without occupying the current-work slot.
create extension if not exists btree_gist;

alter table assignments
  add column scheduled_start_at timestamptz,
  add column reservation_start_at timestamptz,
  add column reservation_end_at timestamptz,
  add column activated_at timestamptz,
  add constraint assignments_reservation_window_check check (
    (reservation_start_at is null and reservation_end_at is null and scheduled_start_at is null)
    or (reservation_start_at is not null and reservation_end_at is not null and reservation_end_at > reservation_start_at
      and (scheduled_start_at is null or scheduled_start_at >= reservation_start_at))
  ),
  add constraint assignments_activation_time_check check (
    activated_at is null or (activated_at >= accepted_at and activated_at >= reservation_start_at)
  ),
  add constraint assignments_reservation_no_overlap exclude using gist (
    mechanic_id with =, tstzrange(reservation_start_at, reservation_end_at, '[)') with &&
  ) where (reservation_start_at is not null and status in
    ('accepted', 'en_route', 'on_site', 'diagnosis', 'quoted', 'awaiting_payment', 'in_progress'));

drop index assignments_one_active_mechanic_idx;
create unique index assignments_one_active_mechanic_idx on assignments (mechanic_id)
  where status in ('accepted', 'en_route', 'on_site', 'diagnosis', 'quoted', 'awaiting_payment', 'in_progress')
    and (scheduled_start_at is null or activated_at is not null);
create index assignments_scheduled_preparation_idx on assignments (reservation_start_at, id)
  where scheduled_start_at is not null and activated_at is null;

alter table notification_delivery_receipts
  add column lease_token text,
  add column lease_expires_at timestamptz,
  add column next_attempt_at timestamptz,
  add constraint notification_delivery_lease_pair_check check (
    (lease_token is null) = (lease_expires_at is null)
  );

alter table service_requests drop constraint service_requests_periodic_maintenance_time_or_reminder_check;
alter table service_requests add constraint service_requests_periodic_maintenance_time_or_reminder_check check (
  service_type <> 'periodic_maintenance'
  or ((scheduled_start_at is null or scheduled_start_at > created_at)
    and (scheduled_start_at is not null or (reminder_id is not null and reminder_context_id is not null)))
);
-- Legacy location-less rows can still be canceled; new bookings must have coordinates.
create function validate_maintenance_location() returns trigger language plpgsql as $$
begin
  if new.service_type = 'periodic_maintenance' and new.service_location is null then
    raise exception 'maintenance location is required' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger service_requests_validate_maintenance_location
  before insert or update of service_location, service_type on service_requests
  for each row execute function validate_maintenance_location();

-- Updating the rules serializes archive against reminder generation.
create function disable_archived_motorcycle_reminders() returns trigger language plpgsql as $$
begin
  if new.archived_at is not null and old.archived_at is null then
    update reminder_rules set enabled = false, updated_at = new.updated_at where motorcycle_id = new.id;
  end if;
  return new;
end;
$$;
create trigger motorcycles_disable_reminders after update of archived_at on motorcycles
  for each row execute function disable_archived_motorcycle_reminders();
