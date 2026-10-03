-- Commit enum additions before migration 043.
alter type notification_status add value if not exists 'canceled';
alter type notification_delivery_status add value if not exists 'canceled';
alter type outbox_status add value if not exists 'abandoned';
