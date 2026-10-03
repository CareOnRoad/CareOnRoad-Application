-- Admin retries open a new bounded search; existing rounds remain immutable history.
alter table service_requests
  add column dispatch_episode_start_round integer not null default 1,
  add column dispatch_retry_count integer not null default 0,
  add constraint service_requests_dispatch_episode_check check (
    dispatch_episode_start_round between 1 and 64 and dispatch_retry_count between 0 and 3
  );
