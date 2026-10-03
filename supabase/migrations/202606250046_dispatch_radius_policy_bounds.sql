-- Configurable dispatch radii use whole-meter precision within the existing 1–100 km policy bounds.
alter table dispatch_rounds drop constraint dispatch_rounds_radius_m_check;
alter table dispatch_rounds add constraint dispatch_rounds_radius_m_check
  check (radius_m between 1000 and 100000);
