-- Commit this enum-only migration before the following supervision migration.
alter type quote_status add value if not exists 'voided';
