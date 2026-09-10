# Destructive Operation Safety Checklist

- [x] Exact tables/statuses are allowlisted
- [x] No raw SQL target from request input
- [x] Dry-run defaults true
- [x] Execution flag defaults false
- [x] Class retention days have no default
- [x] Per-class deletion capped at 100
- [x] Audit/payment/business records excluded
