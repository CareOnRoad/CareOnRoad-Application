-- New requests and explicit location/service changes require dispatchable coordinates.
-- Status-only updates deliberately allow safe cancellation of legacy address-only rows.
drop trigger service_requests_validate_maintenance_location on service_requests;

create function validate_service_request_location()
returns trigger language plpgsql as $$
begin
  if new.service_location is null then
    raise exception 'Service requests require location coordinates' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger service_requests_location_guard
before insert or update of service_location, service_type on service_requests
for each row execute function validate_service_request_location();
