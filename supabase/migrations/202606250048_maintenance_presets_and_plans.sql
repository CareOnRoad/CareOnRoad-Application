-- User plans, maintenance reminder presets, and VIP motorcycle details.
-- All new columns are nullable or defaulted, so existing rows stay valid.

alter table app_users
  add column plan_code text not null default 'free',
  add column plan_expires_at timestamptz,
  add constraint app_users_plan_code_check check (plan_code in ('free', 'advance', 'vip')),
  add constraint app_users_plan_expiry_check check (
    (plan_code = 'free' and plan_expires_at is null)
    or (plan_code <> 'free' and plan_expires_at is not null));

alter table reminder_rules
  add column item_code text,
  add column last_done_on date,
  add constraint reminder_rules_item_code_check check (item_code is null or
    item_code in ('engine_oil', 'gear_oil', 'brake_fluid', 'coolant', 'insurance_renewal')),
  add constraint reminder_rules_last_done_requires_item check (last_done_on is null or item_code is not null);

create unique index reminder_rules_motorcycle_item_uidx
  on reminder_rules (motorcycle_id, item_code) where item_code is not null;

alter table motorcycles
  add column color text check (color is null or length(color) between 1 and 50),
  add column frame_number text check (frame_number is null or length(frame_number) between 1 and 50),
  add column engine_number text check (engine_number is null or length(engine_number) between 1 and 50),
  add column purchase_date date,
  add column purchase_price_vnd numeric(12,0) check (purchase_price_vnd is null or purchase_price_vnd >= 0),
  add column insurance_provider text check (insurance_provider is null or length(insurance_provider) between 1 and 100),
  add column insurance_policy_number text check (insurance_policy_number is null or length(insurance_policy_number) between 1 and 100),
  add column insurance_expires_on date,
  add column warranty_expires_on date,
  add column preferred_service_center text check (preferred_service_center is null or length(preferred_service_center) between 1 and 200);
