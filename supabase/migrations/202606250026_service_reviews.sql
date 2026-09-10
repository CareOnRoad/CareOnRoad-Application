create unique index if not exists service_requests_id_rider_unique_idx
  on service_requests (id, rider_id);

create table service_reviews (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique,
  request_id uuid not null,
  rider_id uuid not null,
  mechanic_id uuid not null,
  rating smallint not null check (rating between 1 and 5),
  comment text check (
    comment is null
    or (comment = btrim(comment) and char_length(comment) between 1 and 1000)
  ),
  created_at timestamptz not null default now(),
  foreign key (assignment_id, request_id, mechanic_id)
    references assignments (id, request_id, mechanic_id)
    on delete restrict,
  foreign key (request_id, rider_id)
    references service_requests (id, rider_id)
    on delete restrict
);

create index service_reviews_mechanic_created_idx
  on service_reviews (mechanic_id, created_at desc, id desc);

create index service_reviews_rider_created_idx
  on service_reviews (rider_id, created_at desc, id desc);

create trigger service_reviews_reject_update_delete
  before update or delete
  on service_reviews
  for each row
  execute function reject_immutable_row_mutation();

alter table service_reviews enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on service_reviews from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on service_reviews from authenticated;
  end if;
end;
$$;

update mechanic_profiles profile
set
  rating_avg = coalesce(aggregate.rating_avg, 0),
  rating_count = coalesce(aggregate.rating_count, 0),
  updated_at = now()
from (
  select
    mechanic.user_id as mechanic_id,
    round(avg(review.rating)::numeric, 2) as rating_avg,
    count(review.id)::integer as rating_count
  from mechanic_profiles mechanic
  left join service_reviews review on review.mechanic_id = mechanic.user_id
  group by mechanic.user_id
) aggregate
where profile.user_id = aggregate.mechanic_id;
