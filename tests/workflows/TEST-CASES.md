# Workflow API test cases

Oracle theo tài liệu nghiệp vụ/API. HTTP thật; payOS/FCM được kiểm soát ở biên mạng. BLOCKED không được tính PASS.

| ID | Nhóm | Trường hợp | Kỳ vọng |
|---|---|---|---|
| SEC-001 | SEC | GET /api/v1/service-requests / anonymous | 401; no side effect or secret leakage |
| SEC-002 | SEC | GET /api/v1/service-requests / invalid | 401; no side effect or secret leakage |
| SEC-003 | SEC | POST /api/v1/service-requests / anonymous | 401; no side effect or secret leakage |
| SEC-004 | SEC | POST /api/v1/service-requests / invalid | 401; no side effect or secret leakage |
| SEC-005 | SEC | GET /api/v1/service-requests/:id / anonymous | 401; no side effect or secret leakage |
| SEC-006 | SEC | GET /api/v1/service-requests/:id / invalid | 401; no side effect or secret leakage |
| SEC-007 | SEC | PATCH /api/v1/service-requests/:id / anonymous | 401; no side effect or secret leakage |
| SEC-008 | SEC | PATCH /api/v1/service-requests/:id / invalid | 401; no side effect or secret leakage |
| SEC-009 | SEC | POST /api/v1/service-requests/:id/cancel / anonymous | 401; no side effect or secret leakage |
| SEC-010 | SEC | POST /api/v1/service-requests/:id/cancel / invalid | 401; no side effect or secret leakage |
| SEC-011 | SEC | POST /api/v1/service-requests/:id/dispatch / anonymous | 401; no side effect or secret leakage |
| SEC-012 | SEC | POST /api/v1/service-requests/:id/dispatch / invalid | 401; no side effect or secret leakage |
| SEC-013 | SEC | GET /api/v1/dispatch/offers / anonymous | 401; no side effect or secret leakage |
| SEC-014 | SEC | GET /api/v1/dispatch/offers / invalid | 401; no side effect or secret leakage |
| SEC-015 | SEC | POST /api/v1/dispatch/offers/:id/accept / anonymous | 401; no side effect or secret leakage |
| SEC-016 | SEC | POST /api/v1/dispatch/offers/:id/accept / invalid | 401; no side effect or secret leakage |
| SEC-017 | SEC | POST /api/v1/dispatch/offers/:id/decline / anonymous | 401; no side effect or secret leakage |
| SEC-018 | SEC | POST /api/v1/dispatch/offers/:id/decline / invalid | 401; no side effect or secret leakage |
| SEC-019 | SEC | GET /api/v1/assignments / anonymous | 401; no side effect or secret leakage |
| SEC-020 | SEC | GET /api/v1/assignments / invalid | 401; no side effect or secret leakage |
| SEC-021 | SEC | POST /api/v1/assignments/:id/status / anonymous | 401; no side effect or secret leakage |
| SEC-022 | SEC | POST /api/v1/assignments/:id/status / invalid | 401; no side effect or secret leakage |
| SEC-023 | SEC | GET /api/v1/assignments/:id/completion-checklist / anonymous | 401; no side effect or secret leakage |
| SEC-024 | SEC | GET /api/v1/assignments/:id/completion-checklist / invalid | 401; no side effect or secret leakage |
| SEC-025 | SEC | POST /api/v1/assignments/:id/completion-checklist / anonymous | 401; no side effect or secret leakage |
| SEC-026 | SEC | POST /api/v1/assignments/:id/completion-checklist / invalid | 401; no side effect or secret leakage |
| SEC-027 | SEC | GET /api/v1/service-requests/:id/quotes / anonymous | 401; no side effect or secret leakage |
| SEC-028 | SEC | GET /api/v1/service-requests/:id/quotes / invalid | 401; no side effect or secret leakage |
| SEC-029 | SEC | POST /api/v1/service-requests/:id/quotes / anonymous | 401; no side effect or secret leakage |
| SEC-030 | SEC | POST /api/v1/service-requests/:id/quotes / invalid | 401; no side effect or secret leakage |
| SEC-031 | SEC | POST /api/v1/quotes/:id/approve / anonymous | 401; no side effect or secret leakage |
| SEC-032 | SEC | POST /api/v1/quotes/:id/approve / invalid | 401; no side effect or secret leakage |
| SEC-033 | SEC | POST /api/v1/quotes/:id/reject / anonymous | 401; no side effect or secret leakage |
| SEC-034 | SEC | POST /api/v1/quotes/:id/reject / invalid | 401; no side effect or secret leakage |
| SEC-035 | SEC | GET /api/v1/service-requests/:id/payment-summary / anonymous | 401; no side effect or secret leakage |
| SEC-036 | SEC | GET /api/v1/service-requests/:id/payment-summary / invalid | 401; no side effect or secret leakage |
| SEC-037 | SEC | POST /api/v1/payments/orders / anonymous | 401; no side effect or secret leakage |
| SEC-038 | SEC | POST /api/v1/payments/orders / invalid | 401; no side effect or secret leakage |
| SEC-039 | SEC | GET /api/v1/payments/orders/:id / anonymous | 401; no side effect or secret leakage |
| SEC-040 | SEC | GET /api/v1/payments/orders/:id / invalid | 401; no side effect or secret leakage |
| SEC-041 | SEC | POST /api/v1/payments/orders/:id/cancel / anonymous | 401; no side effect or secret leakage |
| SEC-042 | SEC | POST /api/v1/payments/orders/:id/cancel / invalid | 401; no side effect or secret leakage |
| SEC-043 | SEC | GET /api/v1/reminders / anonymous | 401; no side effect or secret leakage |
| SEC-044 | SEC | GET /api/v1/reminders / invalid | 401; no side effect or secret leakage |
| SEC-045 | SEC | POST /api/v1/reminders / anonymous | 401; no side effect or secret leakage |
| SEC-046 | SEC | POST /api/v1/reminders / invalid | 401; no side effect or secret leakage |
| SEC-047 | SEC | PATCH /api/v1/reminders/:id / anonymous | 401; no side effect or secret leakage |
| SEC-048 | SEC | PATCH /api/v1/reminders/:id / invalid | 401; no side effect or secret leakage |
| SEC-049 | SEC | POST /api/v1/reminders/:id/snooze / anonymous | 401; no side effect or secret leakage |
| SEC-050 | SEC | POST /api/v1/reminders/:id/snooze / invalid | 401; no side effect or secret leakage |
| SEC-051 | SEC | GET /api/v1/notifications / anonymous | 401; no side effect or secret leakage |
| SEC-052 | SEC | GET /api/v1/notifications / invalid | 401; no side effect or secret leakage |
| SEC-053 | SEC | GET /api/v1/notifications/unread-count / anonymous | 401; no side effect or secret leakage |
| SEC-054 | SEC | GET /api/v1/notifications/unread-count / invalid | 401; no side effect or secret leakage |
| SEC-055 | SEC | POST /api/v1/notifications/:id/read / anonymous | 401; no side effect or secret leakage |
| SEC-056 | SEC | POST /api/v1/notifications/:id/read / invalid | 401; no side effect or secret leakage |
| SEC-057 | SEC | POST /api/v1/notifications/read-all / anonymous | 401; no side effect or secret leakage |
| SEC-058 | SEC | POST /api/v1/notifications/read-all / invalid | 401; no side effect or secret leakage |
| SEC-059 | SEC | POST /api/v1/auth/devices / anonymous | 401; no side effect or secret leakage |
| SEC-060 | SEC | POST /api/v1/auth/devices / invalid | 401; no side effect or secret leakage |
| SEC-061 | SEC | PUT /api/v1/auth/devices/:id/push-token / anonymous | 401; no side effect or secret leakage |
| SEC-062 | SEC | PUT /api/v1/auth/devices/:id/push-token / invalid | 401; no side effect or secret leakage |
| SEC-063 | SEC | DELETE /api/v1/auth/devices/:id/push-token / anonymous | 401; no side effect or secret leakage |
| SEC-064 | SEC | DELETE /api/v1/auth/devices/:id/push-token / invalid | 401; no side effect or secret leakage |
| SEC-065 | SEC | GET /api/v1/admin/operations/payments-needs-review / anonymous | 401; no side effect or secret leakage |
| SEC-066 | SEC | GET /api/v1/admin/operations/payments-needs-review / invalid | 401; no side effect or secret leakage |
| SEC-067 | SEC | POST /api/v1/admin/payments/orders/:id/resolve / anonymous | 401; no side effect or secret leakage |
| SEC-068 | SEC | POST /api/v1/admin/payments/orders/:id/resolve / invalid | 401; no side effect or secret leakage |
| SEC-069 | SEC | Worker outbox/run rejects anonymous | User JWT cannot replace worker authority |
| SEC-070 | SEC | Worker outbox/run rejects rider | User JWT cannot replace worker authority |
| SEC-071 | SEC | Worker outbox/run rejects mechanic | User JWT cannot replace worker authority |
| SEC-072 | SEC | Worker outbox/run rejects admin | User JWT cannot replace worker authority |
| SEC-073 | SEC | Worker outbox/run wrong secret | Reject wrong worker secret |
| SEC-074 | SEC | Worker reminders/run rejects anonymous | User JWT cannot replace worker authority |
| SEC-075 | SEC | Worker reminders/run rejects rider | User JWT cannot replace worker authority |
| SEC-076 | SEC | Worker reminders/run rejects mechanic | User JWT cannot replace worker authority |
| SEC-077 | SEC | Worker reminders/run rejects admin | User JWT cannot replace worker authority |
| SEC-078 | SEC | Worker reminders/run wrong secret | Reject wrong worker secret |
| SEC-079 | SEC | Worker dispatch/run rejects anonymous | User JWT cannot replace worker authority |
| SEC-080 | SEC | Worker dispatch/run rejects rider | User JWT cannot replace worker authority |
| SEC-081 | SEC | Worker dispatch/run rejects mechanic | User JWT cannot replace worker authority |
| SEC-082 | SEC | Worker dispatch/run rejects admin | User JWT cannot replace worker authority |
| SEC-083 | SEC | Worker dispatch/run wrong secret | Reject wrong worker secret |
| SEC-084 | SEC | Worker payments/reconcile rejects anonymous | User JWT cannot replace worker authority |
| SEC-085 | SEC | Worker payments/reconcile rejects rider | User JWT cannot replace worker authority |
| SEC-086 | SEC | Worker payments/reconcile rejects mechanic | User JWT cannot replace worker authority |
| SEC-087 | SEC | Worker payments/reconcile rejects admin | User JWT cannot replace worker authority |
| SEC-088 | SEC | Worker payments/reconcile wrong secret | Reject wrong worker secret |
| MNT-001 | MNT | Booking rejects invalid motorcycle_id: "bad" | 400/422; no invalid request persisted |
| MNT-002 | MNT | Booking rejects invalid service_type: "unknown" | 400/422; no invalid request persisted |
| MNT-003 | MNT | Booking rejects invalid problem_description: "" | 400/422; no invalid request persisted |
| MNT-004 | MNT | Booking rejects invalid problem_description: "  " | 400/422; no invalid request persisted |
| MNT-005 | MNT | Booking rejects invalid problem_description: 2 | 400/422; no invalid request persisted |
| MNT-006 | MNT | Booking rejects invalid problem_description: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx | 400/422; no invalid request persisted |
| MNT-007 | MNT | Booking rejects invalid scheduled_start_at: "bad" | 400/422; no invalid request persisted |
| MNT-008 | MNT | Booking rejects invalid scheduled_start_at: "2020-01-01T00:00:00Z" | 400/422; no invalid request persisted |
| MNT-009 | MNT | Booking rejects invalid scheduled_start_at: null | 400/422; no invalid request persisted |
| MNT-010 | MNT | Booking rejects invalid location: null | 400/422; no invalid request persisted |
| MNT-011 | MNT | Booking rejects invalid location: {} | 400/422; no invalid request persisted |
| MNT-012 | MNT | Booking rejects invalid location: {"latitude":91,"longitude":107} | 400/422; no invalid request persisted |
| MNT-013 | MNT | Booking rejects invalid location: {"latitude":11,"longitude":-181} | 400/422; no invalid request persisted |
| MNT-014 | MNT | Booking rejects invalid location: {"latitude":"11","longitude":107} | 400/422; no invalid request persisted |
| MNT-015 | MNT | Booking rejects invalid location: {"latitude":11} | 400/422; no invalid request persisted |
| MNT-016 | MNT | Booking rejects invalid address_text: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx | 400/422; no invalid request persisted |
| MNT-017 | MNT | Booking rejects invalid rider_id: "567d6e64-1968-4293-aea0-2148a7a877fe" | 400/422; no invalid request persisted |
| MNT-018 | MNT | Booking rejects invalid status: "completed" | 400/422; no invalid request persisted |
| MNT-019 | MNT | Booking rejects invalid paid_amount: 1 | 400/422; no invalid request persisted |
| MNT-020 | MNT | Booking rejects invalid reminder_id: "a2885099-f5c0-4c93-8e9d-edbd88d0bd4c" | 400/422; no invalid request persisted |
| MNT-021 | MNT | Booking rejects invalid reminder_context_id: "679b5df6-42e1-45c4-b394-281f13da7f28" | 400/422; no invalid request persisted |
| MNT-022 | MNT | Coordinates required even with address | Missing coordinates rejected |
| MNT-023 | MNT | Schedule required without reminder references | Missing appointment rejected |
| MNT-024 | MNT | Foreign motorcycle booking | 403; ownership enforced |
| MNT-025 | MNT | Missing booking idempotency key | 400/422 |
| MNT-026 | MNT | Booking key length boundary | Invalid key rejected |
| MNT-027 | MNT | Booking key length boundary | Invalid key rejected |
| MNT-028 | MNT | Booking retry and conflicting payload | Same ID on replay; changed payload 409; cancel successful |
| MNT-029 | MNT | Concurrent booking retry | Exactly one request and one logical dispatch event |
| MNT-030 | MNT | Owner edits coordinates before dispatch | Idempotent PATCH, changed replay conflicts, foreign owner rejected |
| MNT-031 | MNT | Cancel before matching then replay worker | Canceled request never generates a live offer |
| MNT-032 | MNT | Automatic matching immediately after booking | Outbox generates offers without client dispatch; not confirmed yet |
| MNT-033 | MNT | Scheduled accept duration undefined invalid | 400/422; offer remains available |
| MNT-034 | MNT | Scheduled accept duration 14 invalid | 400/422; offer remains available |
| MNT-035 | MNT | Scheduled accept duration 481 invalid | 400/422; offer remains available |
| MNT-036 | MNT | Scheduled accept duration 15.5 invalid | 400/422; offer remains available |
| MNT-037 | MNT | Scheduled accept duration 90 invalid | 400/422; offer remains available |
| MNT-038 | MNT | Scheduled accept duration null invalid | 400/422; offer remains available |
| MNT-039 | MNT | Foreign mechanic cannot accept offer | 403/404 |
| MNT-040 | MNT | Accept confirms buffered reservation | Confirmed; start -30 minutes; end duration +30 minutes; retry same assignment |
| MNT-041 | MNT | Skip labor approval to en_route | 409; no state advance |
| MNT-042 | MNT | Skip labor approval to in_progress | 409; no state advance |
| MNT-043 | MNT | Skip labor approval to awaiting_payment | 409; no state advance |
| MNT-044 | MNT | Skip labor approval to completed | 409; no state advance |
| MNT-045 | MNT | Unassigned rider2 progresses assignment | 403/404 |
| MNT-046 | MNT | Unassigned mechanic2 progresses assignment | 403/404 |
| MNT-047 | MNT | Labor quote rejects no labor | 400/422/409; no invalid immutable quote |
| MNT-048 | MNT | Labor quote rejects zero labor | 400/422/409; no invalid immutable quote |
| MNT-049 | MNT | Labor quote rejects part mixed | 400/422/409; no invalid immutable quote |
| MNT-050 | MNT | Labor quote rejects negative | 400/422/409; no invalid immutable quote |
| MNT-051 | MNT | Labor quote rejects fraction money | 400/422/409; no invalid immutable quote |
| MNT-052 | MNT | Labor quote rejects zero quantity | 400/422/409; no invalid immutable quote |
| MNT-053 | MNT | Labor quote rejects empty description | 400/422/409; no invalid immutable quote |
| MNT-054 | MNT | Labor quote rejects overflow | 400/422/409; no invalid immutable quote |
| MNT-055 | MNT | Labor quote rejects discount_amount | 400/422/409; server owns pricing |
| MNT-056 | MNT | Labor quote rejects diagnosis_id | 400/422/409; server owns pricing |
| MNT-057 | MNT | Labor quote rejects labor_pricing | 400/422/409; server owns pricing |
| MNT-058 | MNT | Labor quote rejects total_amount | 400/422/409; server owns pricing |
| MNT-059 | MNT | Work quote before approved labor | 409 |
| MNT-060 | MNT | New maintenance rejects legacy standard purpose | 409 |
| MNT-061 | MNT | Labor rejection retains mechanic; replacement immutable | Rejected cannot travel; replacement supersedes prior pending; latest only |
| MNT-062 | MNT | Labor quote decision by rider2 | 403/404 |
| MNT-063 | MNT | Labor quote decision by mechanic | 403/404 |
| PAY-001 | PAY | Pending labor cannot be paid | 409; payment is after service |
| MNT-064 | MNT | Maintenance rejects rescue payment timing | 400/422/409 |
| MNT-065 | MNT | Approve fixed labor | Accepted/assigned; total 12000; no payment or automatic travel |
| PAY-002 | PAY | Approved labor still cannot create a payment | 409; no upfront payment for new maintenance |
| MNT-066 | MNT | No second labor after fixed approval | 409 |
| MNT-067 | MNT | Travel and arrival synchronize request; cannot skip diagnosis | Active reservation; en_route / on_site / diagnosis |
| MNT-068 | MNT | Initial work cannot add duplicate labor | 409/400/422 |
| MNT-069 | MNT | Materials rejected then revised | Rejected work blocks start; revised work has fixed labor plus approved parts |
| PAY-003 | PAY | Unapproved material quote cannot be paid | 409 |
| MNT-070 | MNT | Approve scope then start work | Approval returns diagnosis; manual in_progress; no implicit payment |
| PAY-004 | PAY | Cannot charge during work | 409 |
| MNT-071 | MNT | Cannot collect without checklist | 409 |
| MNT-072 | MNT | Cannot complete without verified payment | 409 |
| MNT-073 | MNT | Addition needs latest approved basis | 409 or invalid; no scope changes |
| MNT-074 | MNT | Addition needs latest approved basis | 409 or invalid; no scope changes |
| MNT-075 | MNT | Addition needs latest approved basis | 409 or invalid; no scope changes |
| MNT-076 | MNT | Pending addition blocks collection; rejection preserves scope | No payment for rejected amount; still assigned to same mechanic |
| PAY-005 | PAY | Rejected addition cannot be charged | 409 |
| MNT-077 | MNT | Approved addition cumulative, prior labor fixed | 21000 total; original labor preserved; no automatic completion |
| MNT-078 | MNT | Old approved basis cannot create another addition | 409 |
| MNT-079 | MNT | Checklist invalid or price/state mass assignment | 400/422; cannot bypass approval |
| MNT-080 | MNT | Checklist invalid or price/state mass assignment | 400/422; cannot bypass approval |
| MNT-081 | MNT | Checklist invalid or price/state mass assignment | 400/422; cannot bypass approval |
| MNT-082 | MNT | Checklist invalid or price/state mass assignment | 400/422; cannot bypass approval |
| MNT-083 | MNT | Checklist invalid or price/state mass assignment | 400/422; cannot bypass approval |
| MNT-084 | MNT | Checklist version, ownership and idempotency | Quote binding server-owned; replay same; changed payload conflict; read does not complete |
| MNT-085 | MNT | Approval after checklist makes checklist stale | Old checklist cannot unlock payment; new revision binds latest quote |
| PAY-006 | PAY | Payment summary computed from approved work | 24000; unpaid 0; remaining full; timing after_service |
| PAY-007 | PAY | Payment input malformed/unknown/mass assignment | Invalid input or nonexistent quote; no provider request |
| PAY-008 | PAY | Payment input malformed/unknown/mass assignment | Invalid input or nonexistent quote; no provider request |
| PAY-009 | PAY | Payment input malformed/unknown/mass assignment | Invalid input or nonexistent quote; no provider request |
| PAY-010 | PAY | Payment input malformed/unknown/mass assignment | Invalid input or nonexistent quote; no provider request |
| PAY-011 | PAY | Payment input malformed/unknown/mass assignment | Invalid input or nonexistent quote; no provider request |
| PAY-012 | PAY | Payment input malformed/unknown/mass assignment | Invalid input or nonexistent quote; no provider request |
| PAY-013 | PAY | Payment input malformed/unknown/mass assignment | Invalid input or nonexistent quote; no provider request |
| PAY-014 | PAY | Foreign payment creation by rider2 | 403/404 |
| PAY-015 | PAY | Foreign payment creation by mechanic | 403/404 |
| PAY-016 | PAY | Payment missing idempotency | 400/422 |
| PAY-017 | PAY | Client cannot reduce charge amount | 400/422 |
| PAY-018 | PAY | Payment create and replay | 201 same ID; amount equals remaining; provider called once for logical link |
| PAY-019 | PAY | Concurrent different keys never create two active links | At most one active provider link and one active payment order |
| PAY-020 | PAY | Read order as rider | Visible to owner/assigned mechanic/admin |
| PAY-021 | PAY | Read order as mechanic | Visible to owner/assigned mechanic/admin |
| PAY-022 | PAY | Read order as admin | Visible to owner/assigned mechanic/admin |
| PAY-023 | PAY | Foreign rider2 cannot read order | 403/404 |
| PAY-024 | PAY | Foreign mechanic2 cannot read order | 403/404 |
| PAY-025 | PAY | Return URL query cannot mark paid | Only verified webhook/provider reconciliation is evidence |
| PAY-026 | PAY | Webhook missing rejected | 400/401/422; no credit and no state advance |
| PAY-027 | PAY | Webhook badSignature rejected | 400/401/422; no credit and no state advance |
| PAY-028 | PAY | Webhook tamper rejected | 400/401/422; no credit and no state advance |
| PAY-029 | PAY | Signed unknown order is safely ignored | 200 controlled acknowledgment; no fixture credit |
| PAY-030 | PAY | Pending order cannot complete work | 409 |
| PAY-031 | PAY | Verified webhook credits exact money once | Succeeded, remaining zero, still awaiting_payment |
| PAY-032 | PAY | Concurrent/replayed webhook cannot double-credit | Paid amount unchanged; one logical success notification |
| PAY-033 | PAY | Already paid cannot create another charge | 409; no zero or double payment |
| PAY-034 | PAY | Succeeded order cannot be canceled | 409; paid evidence preserved |
| MNT-086 | MNT | Paid maintenance manually completes | Both request/assignment completed; no backward transition |
| MNT-087 | MNT | Completed assignment allows one immutable owner review | 201; duplicate blocked; foreign forbidden |
| NTF-001 | NTF | Maintenance lifecycle notices and navigation | Owner receives assignment, quote, verified payment, completion; unrelated user never receives IDs |
| MNT-088 | MNT | E2E no parts | Booking → labor → materials approval → checklist → verified payment → completed |
| MNT-089 | MNT | E2E parts quantity 2 | Booking → labor → materials approval → checklist → verified payment → completed |
| MNT-090 | MNT | E2E fractional part quantity | Booking → labor → materials approval → checklist → verified payment → completed |
| MNT-091 | MNT | Expired labor cannot be approved; revised quote succeeds | Expired quote cannot travel/charge; replacement allows whole workflow |
| PAY-035 | PAY | Cancel pending, replay cancel, new payment then complete | Old link canceled; replacement unique; only replacement credit |
| PAY-036 | PAY | Signed webhook underpaid needs intervention | No credit/close; review or controlled rejection; admin must independently verify provider |
| PAY-037 | PAY | Signed webhook overpaid needs intervention | No credit/close; review or controlled rejection; admin must independently verify provider |
| PAY-038 | PAY | Signed webhook currency needs intervention | No credit/close; review or controlled rejection; admin must independently verify provider |
| PAY-039 | PAY | Signed webhook wrong link needs intervention | No credit/close; review or controlled rejection; admin must independently verify provider |
| PAY-040 | PAY | Late success after canceled link requires review | No automatic credit; admin proof and ownership/idempotency required |
| PAY-041 | PAY | Reconcile recovers missed webhook | Stale provider PAID credits once, remains awaiting_payment until mechanic closes |
| PAY-042 | PAY | Provider create outage cannot mark paid; recovery retry | Controlled 502/503; same key recovers link; no duplicate credit |
| MNT-092 | MNT | Future reservation blocks overlap but allows unrelated immediate job | Future confirmed does not occupy current job; early travel blocked; active job blocks later activation |
| MNT-093 | MNT | No available mechanic never confirms appointment | After bounded dispatch rounds becomes manual_escalation and rider notified |
| NTF-002 | NTF | Reminder invalid title | 400/422; no invalid reminder persisted |
| NTF-003 | NTF | Reminder invalid title | 400/422; no invalid reminder persisted |
| NTF-004 | NTF | Reminder invalid interval_days | 400/422; no invalid reminder persisted |
| NTF-005 | NTF | Reminder invalid interval_days | 400/422; no invalid reminder persisted |
| NTF-006 | NTF | Reminder invalid interval_days | 400/422; no invalid reminder persisted |
| NTF-007 | NTF | Reminder invalid enabled | 400/422; no invalid reminder persisted |
| NTF-008 | NTF | Reminder invalid next_due_at | 400/422; no invalid reminder persisted |
| NTF-009 | NTF | Reminder invalid odometer_km | 400/422; no invalid reminder persisted |
| NTF-010 | NTF | Reminder invalid rider_id | 400/422; no invalid reminder persisted |
| NTF-011 | NTF | Reminder motorcycle ownership | 403 |
| NTF-012 | NTF | Due reminder atomic inbox and repeated workers | One occurrence/inbox; queued truthfully; worker sent counter zero |
| NTF-013 | NTF | Reminder snooze and schedule edit clears snooze | Effective due moves; not early; PATCH removes old snooze |
| NTF-014 | NTF | Foreign reminder mutation PATCH | 403 |
| NTF-015 | NTF | Foreign reminder mutation /snooze | 403 |
| NTF-016 | NTF | Disabled reminder does not notify | No occurrence inbox after due |
| NTF-017 | NTF | Archived motorcycle disables reminders | Worker never sends due reminder for archived vehicle |
| NTF-018 | NTF | Recurring date reminder advances once without drift duplication | Next due + interval; no duplicate on worker repeat; next cycle gets new context |
| NTF-019 | NTF | Reminder creates immediate maintenance once; completion leaves recurrence intact | References owned/due/vehicle-bound; occurrence consumed only after successful request |
| NTF-020 | NTF | Inbox invalid filter limit=0 | 400/422 |
| NTF-021 | NTF | Inbox invalid filter limit=101 | 400/422 |
| NTF-022 | NTF | Inbox invalid filter limit=abc | 400/422 |
| NTF-023 | NTF | Inbox invalid filter cursor=invalid | 400/422 |
| NTF-024 | NTF | Inbox invalid filter unread_only=wrong | 400/422 |
| NTF-025 | NTF | Inbox opaque cursor pagination | No duplicates/missing across pages; limit respected; owner data only |
| NTF-026 | NTF | Unread → read idempotent independent of delivery | Unread decrements once; first read timestamp preserved; foreign owner 404 |
| NTF-027 | NTF | Read-all idempotent and owner-scoped | Owner unread zero; unrelated user count unchanged |
| NTF-028 | NTF | Device token fields paired/provider controlled | 400/422 |
| NTF-029 | NTF | Device token fields paired/provider controlled | 400/422 |
| NTF-030 | NTF | Device token fields paired/provider controlled | 400/422 |
| NTF-031 | NTF | Push token ownership, rotation and revoke | Token never returned; foreign cannot rotate; revoke replay safe |
| NTF-032 | NTF | No active device retains inbox; no provider call | No raw-device destination; inbox usable even when no push |
| NTF-033 | NTF | FCM success wire response | Inbox persists; typed failure classified; successful devices not resent; Retry-After honored |
| NTF-034 | NTF | FCM invalid wire response | Inbox persists; typed failure classified; successful devices not resent; Retry-After honored |
| NTF-035 | NTF | FCM mismatch wire response | Inbox persists; typed failure classified; successful devices not resent; Retry-After honored |
| NTF-036 | NTF | FCM permanent wire response | Inbox persists; typed failure classified; successful devices not resent; Retry-After honored |
| NTF-037 | NTF | FCM temporary wire response | Inbox persists; typed failure classified; successful devices not resent; Retry-After honored |
| NTF-038 | NTF | FCM quota wire response | Inbox persists; typed failure classified; successful devices not resent; Retry-After honored |
| NTF-039 | NTF | Mixed devices retry only unresolved device | One success, one invalid, one temporary; terminal destinations sent once |
| NTF-040 | NTF | Concurrent outbox workers deduplicate slow provider sends | One successful send per notification/device version; no duplicate inbox |
| NTF-041 | NTF | Permanent temporary-failure exhaustion dead letters | Bounded retries; not falsely sent; inbox remains; operational queue visible |
| NTF-042 | NTF | Rescue E2E notifications labor_upfront | Offer → assignment → labor → travel → parts → payment → completion notices owner-only |
| NTF-043 | NTF | Rescue E2E notifications after_repair | Offer → assignment → labor → travel → parts → payment → completion notices owner-only |
| PAY-043 | PAY | Real bank transfer + signed external payOS webhook | Explicit evidence required; never inferred from simulated provider success |
| PAY-044 | PAY | Legacy standard maintenance prepayment compatibility | Explicit evidence required; never inferred from simulated provider success |
| PAY-045 | PAY | Provider timeout after link creation and process crash before response | Explicit evidence required; never inferred from simulated provider success |
| MNT-094 | MNT | Maximum duration 480 and adjacent buffered reservation boundary | Explicit evidence required; never inferred from simulated provider success |
| MNT-095 | MNT | Simultaneous cancellation versus offer acceptance | Explicit evidence required; never inferred from simulated provider success |
| MNT-096 | MNT | Repair legacy request missing location | Explicit evidence required; never inferred from simulated provider success |
| NTF-044 | NTF | Android physical receipt foreground/background/app terminated | Explicit evidence required; never inferred from simulated provider success |
| NTF-045 | NTF | iOS physical receipt foreground/background/app terminated | Explicit evidence required; never inferred from simulated provider success |
| NTF-046 | NTF | Permission denied/offline/device reconnect/notification tap | Explicit evidence required; never inferred from simulated provider success |
| NTF-047 | NTF | Logout/account switch does not send previous user notices | Explicit evidence required; never inferred from simulated provider success |
| NTF-048 | NTF | Crash after provider success before receipt commit | Explicit evidence required; never inferred from simulated provider success |
| NTF-049 | NTF | Rotate token during invalidation and expired lease owner fencing | Explicit evidence required; never inferred from simulated provider success |
| NTF-050 | NTF | Missing FCM config must report failure not sent | Explicit evidence required; never inferred from simulated provider success |
