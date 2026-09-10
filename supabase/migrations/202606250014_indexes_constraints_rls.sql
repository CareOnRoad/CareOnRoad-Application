-- Patch 9: final relational consistency, retention/pagination indexes, and
-- authenticated read policies. Backend services remain the workflow authority;
-- no direct-client mutation policies are added.

create index idempotency_records_cleanup_idx
  on idempotency_records (expires_at, id);

create index outbox_events_processed_retention_idx
  on outbox_events (processed_at, id)
  where status = 'processed';

create index audit_logs_created_retention_idx
  on audit_logs (created_at, id);

create index service_requests_rider_pagination_idx
  on service_requests (rider_id, created_at desc, id desc);

create index request_status_history_created_retention_idx
  on request_status_history (created_at, id);

create index assignment_status_history_created_retention_idx
  on assignment_status_history (created_at, id);

create index reminder_occurrences_processed_retention_idx
  on reminder_occurrences (processed_at, id)
  where processed_at is not null;

create index notifications_read_retention_idx
  on notifications (read_at, id)
  where read_at is not null;

create index chatbot_sessions_updated_pagination_idx
  on chatbot_sessions (updated_at desc, id desc);

create index chatbot_messages_created_retention_idx
  on chatbot_messages (created_at, id);

create index diagnosis_results_created_retention_idx
  on diagnosis_results (created_at, id);

-- Composite keys make cross-table ownership and identity invariants enforceable
-- by foreign keys instead of relying only on service checks and triggers.
create unique index motorcycles_id_rider_unique_idx
  on motorcycles (id, rider_id);

create unique index dispatch_rounds_id_request_unique_idx
  on dispatch_rounds (id, request_id);

create unique index dispatch_candidates_identity_unique_idx
  on dispatch_candidates (id, request_id, mechanic_id);

create unique index assignments_identity_unique_idx
  on assignments (id, request_id, mechanic_id);

create unique index assignments_id_request_unique_idx
  on assignments (id, request_id);

create unique index mechanic_diagnoses_identity_unique_idx
  on mechanic_diagnoses (id, assignment_id, request_id);

create unique index reminder_rules_identity_unique_idx
  on reminder_rules (id, rider_id, motorcycle_id);

create unique index reminder_occurrences_identity_unique_idx
  on reminder_occurrences (id, rule_id, rider_id, motorcycle_id);

create unique index notifications_identity_unique_idx
  on notifications (id, user_id);

create unique index chatbot_messages_identity_unique_idx
  on chatbot_messages (id, session_id);

alter table service_requests
  add constraint service_requests_motorcycle_owner_fk
  foreign key (motorcycle_id, rider_id)
  references motorcycles (id, rider_id)
  on delete restrict;

alter table dispatch_candidates
  add constraint dispatch_candidates_round_request_fk
  foreign key (round_id, request_id)
  references dispatch_rounds (id, request_id)
  on delete cascade;

alter table assignments
  add constraint assignments_candidate_identity_fk
  foreign key (accepted_candidate_id, request_id, mechanic_id)
  references dispatch_candidates (id, request_id, mechanic_id)
  on delete restrict;

alter table mechanic_diagnoses
  add constraint mechanic_diagnoses_assignment_identity_fk
  foreign key (assignment_id, request_id, mechanic_id)
  references assignments (id, request_id, mechanic_id)
  on delete cascade;

alter table quotes
  add constraint quotes_assignment_request_fk
  foreign key (assignment_id, request_id)
  references assignments (id, request_id)
  on delete cascade;

alter table quotes
  add constraint quotes_diagnosis_identity_fk
  foreign key (diagnosis_id, assignment_id, request_id)
  references mechanic_diagnoses (id, assignment_id, request_id)
  on delete restrict;

alter table reminder_rules
  add constraint reminder_rules_motorcycle_owner_fk
  foreign key (motorcycle_id, rider_id)
  references motorcycles (id, rider_id)
  on delete cascade;

alter table reminder_occurrences
  add constraint reminder_occurrences_rule_identity_fk
  foreign key (rule_id, rider_id, motorcycle_id)
  references reminder_rules (id, rider_id, motorcycle_id)
  on delete cascade;

alter table service_requests
  add constraint service_requests_reminder_rule_identity_fk
  foreign key (reminder_id, rider_id, motorcycle_id)
  references reminder_rules (id, rider_id, motorcycle_id)
  on delete restrict;

alter table service_requests
  add constraint service_requests_reminder_occurrence_identity_fk
  foreign key (reminder_context_id, reminder_id, rider_id, motorcycle_id)
  references reminder_occurrences (id, rule_id, rider_id, motorcycle_id)
  on delete restrict;

alter table reminder_occurrences
  add constraint reminder_occurrences_notification_owner_fk
  foreign key (notification_id, rider_id)
  references notifications (id, user_id)
  on delete set null (notification_id);

alter table diagnosis_results
  add constraint diagnosis_results_message_session_fk
  foreign key (message_id, session_id)
  references chatbot_messages (id, session_id)
  on delete set null (message_id);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select on
      app_users,
      user_roles,
      user_devices,
      motorcycles,
      mechanic_profiles,
      mechanic_skills,
      service_requests,
      request_media_metadata,
      request_status_history
    to authenticated;
  end if;
end;
$$;

create policy app_users_self_select
  on app_users
  for select
  using (id = auth.uid());

create policy user_roles_self_select
  on user_roles
  for select
  using (user_id = auth.uid());

create policy user_devices_owner_select
  on user_devices
  for select
  using (user_id = auth.uid());

create policy motorcycles_owner_select
  on motorcycles
  for select
  using (rider_id = auth.uid());

create policy mechanic_profiles_self_select
  on mechanic_profiles
  for select
  using (user_id = auth.uid());

create policy mechanic_skills_self_select
  on mechanic_skills
  for select
  using (mechanic_id = auth.uid());

create policy service_requests_actor_select
  on service_requests
  for select
  using (rider_id = auth.uid());

create policy request_media_metadata_actor_select
  on request_media_metadata
  for select
  using (
    exists (
      select 1
      from service_requests request
      left join assignments assignment on assignment.request_id = request.id
      where request.id = request_media_metadata.request_id
        and (
          request.rider_id = auth.uid()
          or assignment.mechanic_id = auth.uid()
        )
    )
  );

create policy request_status_history_actor_select
  on request_status_history
  for select
  using (
    exists (
      select 1
      from service_requests request
      left join assignments assignment on assignment.request_id = request.id
      where request.id = request_status_history.request_id
        and (
          request.rider_id = auth.uid()
          or assignment.mechanic_id = auth.uid()
        )
    )
  );

create policy dispatch_candidates_rider_select
  on dispatch_candidates
  for select
  using (
    exists (
      select 1
      from service_requests request
      where request.id = dispatch_candidates.request_id
        and request.rider_id = auth.uid()
    )
  );

create policy dispatch_rounds_rider_select
  on dispatch_rounds
  for select
  using (
    exists (
      select 1
      from service_requests request
      where request.id = dispatch_rounds.request_id
        and request.rider_id = auth.uid()
    )
  );
