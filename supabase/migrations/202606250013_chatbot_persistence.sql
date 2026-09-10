create table chatbot_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (updated_at >= created_at)
);

create table chatbot_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chatbot_sessions(id) on delete cascade,
  input_mode text not null check (input_mode in ('text', 'voice')),
  content_text text,
  transcribed_text text,
  normalized_text text not null,
  safety_answers jsonb,
  created_at timestamptz not null default now(),
  check (
    (input_mode = 'text' and content_text is not null)
    or input_mode = 'voice'
  )
);

create index chatbot_messages_session_created_idx
  on chatbot_messages (session_id, created_at, id);

create table diagnosis_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chatbot_sessions(id) on delete cascade,
  message_id uuid references chatbot_messages(id) on delete set null,
  result jsonb not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  fallback_used boolean not null,
  provider_name text,
  provider_model text,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(result) = 'object')
);

create index diagnosis_results_session_latest_idx
  on diagnosis_results (session_id, created_at desc, id desc);

alter table chatbot_sessions enable row level security;
alter table chatbot_messages enable row level security;
alter table diagnosis_results enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on chatbot_sessions, chatbot_messages, diagnosis_results from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on chatbot_sessions, chatbot_messages, diagnosis_results from authenticated;
    grant select on chatbot_sessions, chatbot_messages, diagnosis_results to authenticated;
  end if;
end;
$$;

create policy chatbot_sessions_owner_select
  on chatbot_sessions
  for select
  using (owner_user_id = auth.uid());

create policy chatbot_messages_owner_select
  on chatbot_messages
  for select
  using (
    exists (
      select 1
      from chatbot_sessions session
      where session.id = chatbot_messages.session_id
        and session.owner_user_id = auth.uid()
    )
  );

create policy diagnosis_results_owner_select
  on diagnosis_results
  for select
  using (
    exists (
      select 1
      from chatbot_sessions session
      where session.id = diagnosis_results.session_id
        and session.owner_user_id = auth.uid()
    )
  );
